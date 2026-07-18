// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Ownable
 * @notice Two-step ownership transfer. Two-step because a typo in a one-step
 *         transfer permanently bricks admin control of a value-holding contract.
 */
abstract contract Ownable {
    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAddress();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

/**
 * @title Pausable
 * @notice Owner-controlled circuit breaker for the action surface.
 */
abstract contract Pausable is Ownable {
    bool public paused;

    event PausedSet(bool paused);

    error IsPaused();

    modifier whenNotPaused() {
        if (paused) revert IsPaused();
        _;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedSet(value);
    }
}

/**
 * @title EIP712Verifier
 * @notice Minimal EIP-712 domain plus ECDSA recovery.
 *
 * The domain separator is rebuilt when chainid changes so signatures cannot be
 * replayed across a fork.
 */
abstract contract EIP712Verifier is Ownable {
    bytes32 private constant _TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private immutable _hashedName;
    bytes32 private immutable _hashedVersion;
    uint256 private immutable _cachedChainId;
    bytes32 private immutable _cachedDomainSeparator;

    /// @notice Backend key authorised to sign vouchers. Rotatable by the owner.
    address public voucherSigner;

    /// @notice Consumed voucher nonces, keyed by hash. Replay protection.
    mapping(bytes32 => bool) public voucherUsed;

    event VoucherSignerChanged(address indexed from, address indexed to);

    error BadSignature();
    error VoucherExpired();
    error VoucherAlreadyUsed();

    constructor(string memory domainName, string memory version, address signer) {
        _hashedName = keccak256(bytes(domainName));
        _hashedVersion = keccak256(bytes(version));
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
        if (signer == address(0)) revert ZeroAddress();
        voucherSigner = signer;
        emit VoucherSignerChanged(address(0), signer);
    }

    function setVoucherSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert ZeroAddress();
        emit VoucherSignerChanged(voucherSigner, signer);
        voucherSigner = signer;
    }

    function domainSeparator() public view returns (bytes32) {
        return block.chainid == _cachedChainId ? _cachedDomainSeparator : _buildDomainSeparator();
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(_TYPE_HASH, _hashedName, _hashedVersion, block.chainid, address(this)));
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /**
     * @dev Verify the voucher signature, enforce its deadline, and burn its
     *      nonce so the same voucher can never be redeemed twice.
     */
    function _consumeVoucher(bytes32 structHash, uint256 deadline, bytes calldata signature) internal {
        if (block.timestamp > deadline) revert VoucherExpired();
        bytes32 digest = _hashTypedData(structHash);
        if (voucherUsed[digest]) revert VoucherAlreadyUsed();
        if (_recover(digest, signature) != voucherSigner) revert BadSignature();
        voucherUsed[digest] = true;
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert BadSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        // Reject the upper half of the curve order: signature malleability.
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert BadSignature();
        }
        if (v != 27 && v != 28) revert BadSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();
        return signer;
    }
}

interface IOSRToken {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    /// @dev Burns from the caller's own balance.
    function burn(uint256 value) external;
    function burnFrom(address from, uint256 value) external;
    function balanceOf(address account) external view returns (uint256);
}
