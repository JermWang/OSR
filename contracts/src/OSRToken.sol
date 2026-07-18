// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OSRToken
 * @notice Fixed-supply ERC-20 for the Oil Strategic Reserve.
 *
 * The entire supply is minted once in the constructor and there is no mint
 * function, so supply can only ever decrease. This is the on-chain counterpart
 * of TOTAL_SUPPLY in src/lib/economy.ts; the two must agree.
 *
 * Deliberately dependency-free so the deployed bytecode is auditable from this
 * single file with no remapping or library-version drift.
 */
contract OSRToken {
    string public constant name = "Oil Strategic Reserve";
    string public constant symbol = "OSR";
    uint8 public constant decimals = 18;

    /// @notice 229,000,000 OSR. Matches TOTAL_SUPPLY in economy.ts.
    uint256 public constant INITIAL_SUPPLY = 229_000_000 * 1e18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Burn(address indexed from, uint256 value);

    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    /// @param distributor Receives the full supply. Should be a multisig.
    constructor(address distributor) {
        if (distributor == address(0)) revert ZeroAddress();
        totalSupply = INITIAL_SUPPLY;
        balanceOf[distributor] = INITIAL_SUPPLY;
        emit Transfer(address(0), distributor, INITIAL_SUPPLY);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    /// @notice Permanently destroy `value` tokens held by the caller.
    function burn(uint256 value) external {
        _burn(msg.sender, value);
    }

    /// @notice Burn from `from` using the caller's allowance.
    function burnFrom(address from, uint256 value) external {
        _spendAllowance(from, msg.sender, value);
        _burn(from, value);
    }

    function _transfer(address from, address to, uint256 value) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _burn(address from, uint256 value) private {
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - value;
            totalSupply -= value;
        }
        emit Transfer(from, address(0), value);
        emit Burn(from, value);
    }

    function _spendAllowance(address owner, address spender, uint256 value) private {
        uint256 current = allowance[owner][spender];
        if (current != type(uint256).max) {
            if (current < value) revert InsufficientAllowance();
            unchecked {
                allowance[owner][spender] = current - value;
            }
            emit Approval(owner, spender, current - value);
        }
    }
}
