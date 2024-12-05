// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";

contract LogicSystem is System {
  function getLogicSystemAddress() external view returns (address) {
    return address(this);
  }

  function applyStateChange(uint32 currentState) external pure returns (uint32) {
    return currentState + 1;
  }
}
