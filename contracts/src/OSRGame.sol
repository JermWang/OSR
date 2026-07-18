// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Pausable, EIP712Verifier, IOSRToken} from "./Auth.sol";

/**
 * @title OSRGame
 * @notice On-chain action surface for the Oil Strategic Reserve.
 *
 * Every action that costs an operator value — minting a node, upgrading one,
 * opening a crate, upgrading or expediting the compound — routes through
 * execute(). The contract performs the real ERC-20 movement (burn / treasury /
 * reserve split) and the real ETH fee transfer, then emits ActionExecuted.
 *
 * The backend watches for that event, verifies the receipt (see
 * src/lib/receipts.ts), and only then applies the corresponding game-state
 * change. Costs are carried in a backend-signed voucher because they depend on
 * off-chain state (node level, compound level, crate pricing) that this
 * contract deliberately does not track. The voucher fixes amounts and expiry;
 * the contract enforces that exactly those amounts move, and that each voucher
 * is redeemable once.
 *
 * What this means for trust: the backend chooses the price, but it cannot
 * fabricate a payment. Every unit of OSR burned or moved here is real.
 */
contract OSRGame is Pausable, EIP712Verifier {
    enum Action {
        MintNode,
        UpgradeNode,
        OpenCrate,
        UpgradeCompound,
        ExpediteCompound
    }

    bytes32 public constant ACTION_TYPEHASH =
        keccak256(
            "ActionVoucher(address operator,uint8 action,bytes32 detail,uint256 osrAmount,uint16 burnBps,uint16 treasuryBps,uint256 feeWei,uint256 nonce,uint256 deadline)"
        );

    uint16 internal constant BPS_DENOMINATOR = 10_000;

    IOSRToken public immutable osr;
    address public treasury;
    address public vault;

    event ActionExecuted(
        address indexed operator,
        Action indexed action,
        bytes32 indexed detail,
        uint256 osrAmount,
        uint256 burned,
        uint256 toTreasury,
        uint256 toReserve,
        uint256 feeWei,
        uint256 nonce
    );
    event SinksChanged(address treasury, address vault);

    error BadSplit();
    error WrongFee(uint256 expected, uint256 received);
    error TransferFailed();

    constructor(
        address initialOwner,
        address token,
        address treasury_,
        address vault_,
        address signer
    ) Ownable(initialOwner) EIP712Verifier("OSR Game", "1", signer) {
        if (token == address(0) || treasury_ == address(0) || vault_ == address(0)) {
            revert ZeroAddress();
        }
        osr = IOSRToken(token);
        treasury = treasury_;
        vault = vault_;
        emit SinksChanged(treasury_, vault_);
    }

    function setSinks(address treasury_, address vault_) external onlyOwner {
        if (treasury_ == address(0) || vault_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        vault = vault_;
        emit SinksChanged(treasury_, vault_);
    }

    /**
     * @notice Execute a priced game action.
     * @param detail Opaque action payload (family key, node id, slot). The
     *        contract never interprets it; it is echoed into the event so the
     *        backend can bind the receipt to the exact intent it priced.
     * @param burnBps Share of osrAmount destroyed outright.
     * @param treasuryBps Share sent to the treasury. The remainder goes to the
     *        vault as undistributed reserve.
     */
    function execute(
        Action action,
        bytes32 detail,
        uint256 osrAmount,
        uint16 burnBps,
        uint16 treasuryBps,
        uint256 feeWei,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external payable whenNotPaused {
        if (uint256(burnBps) + uint256(treasuryBps) > BPS_DENOMINATOR) revert BadSplit();
        if (msg.value != feeWei) revert WrongFee(feeWei, msg.value);

        // Bind the voucher to msg.sender: a voucher priced for one operator can
        // never be replayed by another.
        _consumeVoucher(
            keccak256(
                abi.encode(
                    ACTION_TYPEHASH,
                    msg.sender,
                    uint8(action),
                    detail,
                    osrAmount,
                    burnBps,
                    treasuryBps,
                    feeWei,
                    nonce,
                    deadline
                )
            ),
            deadline,
            signature
        );

        uint256 burned;
        uint256 toTreasury;
        uint256 toReserve;

        if (osrAmount > 0) {
            // Pull the full amount in first, then split from our own balance so
            // a partial split can never leave tokens stranded on the operator.
            if (!osr.transferFrom(msg.sender, address(this), osrAmount)) revert TransferFailed();

            burned = (osrAmount * burnBps) / BPS_DENOMINATOR;
            toTreasury = (osrAmount * treasuryBps) / BPS_DENOMINATOR;
            // Remainder rather than a third percentage, so rounding dust always
            // lands in the reserve instead of being lost.
            toReserve = osrAmount - burned - toTreasury;

            // burn(), not burnFrom(): the tokens are already ours, and
            // burnFrom would require this contract to hold an allowance
            // against itself.
            if (burned > 0) osr.burn(burned);
            if (toTreasury > 0 && !osr.transfer(treasury, toTreasury)) revert TransferFailed();
            if (toReserve > 0 && !osr.transfer(vault, toReserve)) revert TransferFailed();
        }

        if (msg.value > 0) {
            (bool ok, ) = payable(treasury).call{value: msg.value}("");
            if (!ok) revert TransferFailed();
        }

        emit ActionExecuted(
            msg.sender,
            action,
            detail,
            osrAmount,
            burned,
            toTreasury,
            toReserve,
            msg.value,
            nonce
        );
    }
}
