// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IBaseEscrow} from "../lib/cross-chain-swap/contracts/interfaces/IBaseEscrow.sol";
import {Address, AddressLib} from "../lib/cross-chain-swap/lib/solidity-utils/contracts/libraries/AddressLib.sol";
import {Clones} from "../lib/cross-chain-swap/lib/openzeppelin-contracts/contracts/proxy/Clones.sol";

/**
 * @title Fixed Resolver - COMPLETE SOLUTION
 * @notice Resolver that properly creates and funds escrows
 * @dev Bypasses the broken factory pattern by implementing direct escrow deployment
 */
contract FixedResolver is Ownable {
    using Clones for address;
    using AddressLib for Address;

    address public immutable ESCROW_DST_IMPLEMENTATION;
    
    // Events for compatibility with existing agent
    event DstEscrowCreated(
        IBaseEscrow.Immutables dstImmutables,
        uint256 srcCancellationTimestamp,
        uint256 dstChainId,
        bytes canonicalPayload
    );
    
    event EscrowFunded(address indexed escrow, uint256 amount);
    event WithdrawalCompleted(address indexed escrow, address indexed taker, uint256 amount);

    constructor(address escrowDstImplementation, address initialOwner) Ownable(initialOwner) {
        ESCROW_DST_IMPLEMENTATION = escrowDstImplementation;
    }

    receive() external payable {} // Accept ETH

    /**
     * @notice COMPLETE SOLUTION: Deploy and fund destination escrow
     * @param dstImmutables The escrow immutable parameters
     * @param srcCancellationTimestamp Source chain cancellation timestamp
     */
    function deployDst(
        IBaseEscrow.Immutables calldata dstImmutables,
        uint256 srcCancellationTimestamp
    ) external payable onlyOwner {
        
        // Emit canonical payload for off-chain agent consumption (SAME AS ORIGINAL)
        bytes memory canonicalPayload = abi.encode(dstImmutables);
        emit DstEscrowCreated(dstImmutables, srcCancellationTimestamp, block.chainid, canonicalPayload);

        // Calculate required ETH
        address token = dstImmutables.token.get();
        uint256 requiredETH = dstImmutables.safetyDeposit;
        if (token == address(0)) {
            requiredETH += dstImmutables.amount;
        }

        require(msg.value >= requiredETH, "Insufficient ETH");

        // CRITICAL FIX: Create deterministic salt from immutables (SAME AS FACTORY)
        bytes32 salt = keccak256(abi.encode(
            dstImmutables.orderHash,
            dstImmutables.hashlock,
            dstImmutables.maker,
            dstImmutables.taker,
            dstImmutables.token,
            dstImmutables.amount,
            dstImmutables.safetyDeposit,
            dstImmutables.timelocks
        ));
        
        // SOLUTION: Deploy escrow with proper ETH funding
        address escrow = ESCROW_DST_IMPLEMENTATION.cloneDeterministic(salt, requiredETH);
        
        // Verify escrow was funded correctly
        require(escrow.balance >= requiredETH, "Escrow funding failed");
        
        emit EscrowFunded(escrow, requiredETH);
    }

    /**
     * @notice Withdraw from escrow (proxy to escrow's withdraw method)
     * @param escrow The escrow contract address
     * @param secret The withdrawal secret
     * @param immutables The immutable parameters
     */
    function withdraw(
        address escrow,
        bytes32 secret,
        IBaseEscrow.Immutables calldata immutables
    ) external {
        // Get taker address from immutables
        address taker = immutables.taker.get();
        
        // Only allow taker to withdraw
        require(msg.sender == taker, "Only taker can withdraw");
        
        // Record balance before withdrawal
        uint256 balanceBefore = escrow.balance;
        
        // Call withdraw on the escrow
        IBaseEscrow(escrow).withdraw(secret, immutables);
        
        emit WithdrawalCompleted(escrow, taker, balanceBefore);
    }

    /**
     * @notice Get escrow address for given immutables (SAME CALCULATION AS FACTORY)
     * @param immutables The immutable parameters
     * @return The predicted escrow address
     */
    function getEscrowAddress(IBaseEscrow.Immutables calldata immutables) 
        external 
        view 
        returns (address) 
    {
        bytes32 salt = keccak256(abi.encode(
            immutables.orderHash,
            immutables.hashlock,
            immutables.maker,
            immutables.taker,
            immutables.token,
            immutables.amount,
            immutables.safetyDeposit,
            immutables.timelocks
        ));
        return ESCROW_DST_IMPLEMENTATION.predictDeterministicAddress(salt, address(this));
    }

    /**
     * @notice Check escrow balance (for verification)
     * @param escrow The escrow address
     * @return The balance in wei
     */
    function getEscrowBalance(address escrow) external view returns (uint256) {
        return escrow.balance;
    }

    /**
     * @notice Emergency function to recover stuck ETH
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
