// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MoonMaceToken} from "../contracts/MoonMaceToken.sol";
import {MoonMaceStaking} from "../contracts/MoonMaceStaking.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_FOUNDRY");
        address deployer = vm.addr(deployerPrivateKey);
        address moonMaceTokenAddress = vm.envAddress("MONAD_MOONMACE_TOKEN");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Get MoonMaceToken contract instance
        MoonMaceToken mcMON = MoonMaceToken(moonMaceTokenAddress);
        console.log("MoonMaceToken address:", address(mcMON));
        
        // Deploy MoonMaceStaking implementation
        MoonMaceStaking impl = new MoonMaceStaking();
        console.log("MoonMaceStaking implementation deployed at:", address(impl));
        
        // Encode initialize(address) call data
        bytes memory initData = abi.encodeWithSelector(
            MoonMaceStaking.initialize.selector,
            address(mcMON)
        );
        
        // Deploy TransparentUpgradeableProxy
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            deployer, // admin
            initData
        );
        
        MoonMaceStaking moonMaceStaking = MoonMaceStaking(address(proxy));
        console.log("MoonMaceStaking proxy deployed at:", address(moonMaceStaking));
        
        // Set minter
        mcMON.setMinter(address(moonMaceStaking), true);
        console.log("Minter set to:", address(moonMaceStaking));
        
        // Configure staking contract
        moonMaceStaking.setAllowNormalUnstake(true);
        moonMaceStaking.setAllowInstantUnstake(true);
        moonMaceStaking.setAllowClaim(true);
        moonMaceStaking.setStakeAssetCap(10000 ether);
        console.log("Staking contract configured");
        
        // Perform initial stake
        moonMaceStaking.stake{value: 0.001 ether}();
        console.log("Initial stake completed: 0.001 ether");
        
        vm.stopBroadcast();
    }
}

