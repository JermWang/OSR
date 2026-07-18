// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Pausable, EIP712Verifier, IOSRToken} from "./Auth.sol";

/**
 * @title OSRVault
 * @notice Holds the undistributed emission reserve and pays operator claims.
 *
 * Accrual is computed off-chain (it depends on elapsed time, network grow
 * power, gear and the halving schedule — all far too costly to track per-block
 * on-chain). The backend signs a ClaimVoucher for the settled amount and the
 * operator redeems it here. The vault is therefore the single on-chain point
 * where emission actually leaves the reserve.
 *
 * Because a compromised signer key would otherwise drain the reserve, payouts
 * are bounded twice: a hard per-voucher ceiling and a rolling window budget.
 * Both are owner-tunable and both are enforced regardless of signature validity.
 */
contract OSRVault is Pausable, EIP712Verifier {
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("ClaimVoucher(address operator,uint256 amount,uint256 nonce,uint256 deadline)");

    IOSRToken public immutable osr;

    /// @notice Hard ceiling on a single redemption.
    uint256 public maxClaimPerVoucher;
    /// @notice Maximum OSR redeemable within one rolling window.
    uint256 public windowBudget;
    /// @notice Rolling window length in seconds.
    uint256 public windowSeconds;

    uint256 public windowStart;
    uint256 public windowSpent;

    event Claimed(address indexed operator, uint256 amount, uint256 indexed nonce);
    event LimitsChanged(uint256 maxClaimPerVoucher, uint256 windowBudget, uint256 windowSeconds);
    event ReserveWithdrawn(address indexed to, uint256 amount);

    error AmountZero();
    error ExceedsPerVoucherLimit();
    error ExceedsWindowBudget();
    error TransferFailed();
    error InsufficientReserve();

    constructor(
        address initialOwner,
        address token,
        address signer,
        uint256 maxClaim,
        uint256 budget,
        uint256 window
    ) Ownable(initialOwner) EIP712Verifier("OSR Vault", "1", signer) {
        if (token == address(0)) revert ZeroAddress();
        osr = IOSRToken(token);
        maxClaimPerVoucher = maxClaim;
        windowBudget = budget;
        windowSeconds = window;
        windowStart = block.timestamp;
        emit LimitsChanged(maxClaim, budget, window);
    }

    function setLimits(uint256 maxClaim, uint256 budget, uint256 window) external onlyOwner {
        maxClaimPerVoucher = maxClaim;
        windowBudget = budget;
        windowSeconds = window;
        emit LimitsChanged(maxClaim, budget, window);
    }

    /// @notice Reserve still available to pay claims.
    function reserveBalance() external view returns (uint256) {
        return osr.balanceOf(address(this));
    }

    /**
     * @notice Redeem a backend-signed claim voucher.
     * @dev Anyone may submit, but funds always go to voucher.operator, so a
     *      relayer cannot redirect a payout.
     */
    function claim(
        address operator,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused {
        if (amount == 0) revert AmountZero();
        if (operator == address(0)) revert ZeroAddress();
        if (amount > maxClaimPerVoucher) revert ExceedsPerVoucherLimit();

        _consumeVoucher(
            keccak256(abi.encode(CLAIM_TYPEHASH, operator, amount, nonce, deadline)),
            deadline,
            signature
        );

        // Roll the window forward before charging against it.
        if (block.timestamp >= windowStart + windowSeconds) {
            windowStart = block.timestamp;
            windowSpent = 0;
        }
        if (windowSpent + amount > windowBudget) revert ExceedsWindowBudget();
        windowSpent += amount;

        if (osr.balanceOf(address(this)) < amount) revert InsufficientReserve();
        if (!osr.transfer(operator, amount)) revert TransferFailed();

        emit Claimed(operator, amount, nonce);
    }

    /// @notice Owner escape hatch for migrations. Emits for reconciliation.
    function withdrawReserve(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (!osr.transfer(to, amount)) revert TransferFailed();
        emit ReserveWithdrawn(to, amount);
    }
}
