// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, IOSRToken} from "./Auth.sol";

/**
 * @title OSRTreasury
 * @notice Sink for the protocol's treasury share of every OSR burn and for the
 *         ETH action fees. Holds value only; it has no game logic.
 *
 * Withdrawals are owner-only and emit events so the off-chain treasury-events
 * feed can be reconciled against chain state.
 */
contract OSRTreasury is Ownable {
    event EthReceived(address indexed from, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    error TransferFailed();
    error NothingToWithdraw();

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }

    function withdrawEth(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > address(this).balance) revert NothingToWithdraw();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit EthWithdrawn(to, amount);
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert NothingToWithdraw();
        if (!IOSRToken(token).transfer(to, amount)) revert TransferFailed();
        emit TokenWithdrawn(token, to, amount);
    }
}
