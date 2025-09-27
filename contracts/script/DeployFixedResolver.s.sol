// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {FixedResolver} from "../src/FixedResolver.sol";

contract DeployFixedResolver is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying Fixed Resolver (COMPLETE SOLUTION)...");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Use the existing EscrowDst implementation
        address escrowDstImplementation = 0x4E8C66d574CCDBd82722642bFd74D4CC22C881AE;
        
        FixedResolver fixedResolver = new FixedResolver(
            escrowDstImplementation,
            deployer // owner
        );

        console.log("Fixed Resolver deployed at:", address(fixedResolver));
        console.log("EscrowDst implementation:", escrowDstImplementation);
        console.log("Owner:", deployer);

        vm.stopBroadcast();
    }
}
