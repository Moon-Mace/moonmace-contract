// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../MoonMaceStaking.sol";

contract MoonMaceStakingTest is MoonMaceStaking {

    function _getPeriod() public override pure returns (uint256) {
        return 1 minutes;
    }
    
}