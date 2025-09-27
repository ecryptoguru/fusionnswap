// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {SimpleWorkingEscrow} from "../src/SimpleWorkingEscrow.sol";

contract DeploySimpleEscrow is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying SimpleWorkingEscrow...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        SimpleWorkingEscrow escrow = new SimpleWorkingEscrow();

        console.log("SimpleWorkingEscrow deployed at:", address(escrow));

        vm.stopBroadcast();
    }
}
