// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Simple Working Escrow
 * @notice A minimal escrow that actually holds and releases ETH properly
 */
contract SimpleWorkingEscrow {
    mapping(bytes32 => EscrowData) public escrows;
    
    struct EscrowData {
        address taker;
        uint256 amount;
        uint256 safetyDeposit;
        bytes32 hashlock;
        bool withdrawn;
    }
    
    event EscrowCreated(bytes32 indexed orderHash, address indexed taker, uint256 amount, bytes32 hashlock);
    event EscrowWithdrawn(bytes32 indexed orderHash, address indexed taker, uint256 amount);
    
    receive() external payable {} // Accept ETH
    
    /**
     * @notice Create an escrow
     * @param orderHash Unique order identifier
     * @param taker Address that can withdraw
     * @param hashlock Hash of the secret
     */
    function createEscrow(
        bytes32 orderHash,
        address taker,
        bytes32 hashlock
    ) external payable {
        require(msg.value > 0, "No ETH sent");
        require(escrows[orderHash].amount == 0, "Escrow already exists");
        
        // Use 90% for amount, 10% for safety deposit
        uint256 amount = (msg.value * 90) / 100;
        uint256 safetyDeposit = msg.value - amount;
        
        escrows[orderHash] = EscrowData({
            taker: taker,
            amount: amount,
            safetyDeposit: safetyDeposit,
            hashlock: hashlock,
            withdrawn: false
        });
        
        emit EscrowCreated(orderHash, taker, amount, hashlock);
    }
    
    /**
     * @notice Withdraw from escrow with secret
     * @param orderHash The order hash
     * @param secret The secret that hashes to hashlock
     */
    function withdraw(bytes32 orderHash, bytes32 secret) external {
        EscrowData storage escrow = escrows[orderHash];
        
        require(escrow.amount > 0, "Escrow does not exist");
        require(!escrow.withdrawn, "Already withdrawn");
        require(msg.sender == escrow.taker, "Only taker can withdraw");
        require(keccak256(abi.encodePacked(secret)) == escrow.hashlock, "Invalid secret");
        
        escrow.withdrawn = true;
        
        uint256 totalAmount = escrow.amount + escrow.safetyDeposit;
        
        (bool success, ) = escrow.taker.call{value: totalAmount}("");
        require(success, "Transfer failed");
        
        emit EscrowWithdrawn(orderHash, escrow.taker, totalAmount);
    }
    
    /**
     * @notice Check escrow details
     */
    function getEscrow(bytes32 orderHash) external view returns (EscrowData memory) {
        return escrows[orderHash];
    }
    
    /**
     * @notice Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
