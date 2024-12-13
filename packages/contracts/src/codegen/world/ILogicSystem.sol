// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/* Autogenerated file. Do not edit manually. */

/**
 * @title ILogicSystem
 * @author MUD (https://mud.dev) by Lattice (https://lattice.xyz)
 * @dev This interface is automatically generated from the corresponding system contract. Do not edit manually.
 */
interface ILogicSystem {
  function app__getLogicSystemAddress() external view returns (address);

  function app__applyStateChange(uint32 currentState) external pure returns (uint32);
}
