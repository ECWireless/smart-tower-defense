// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title EntityHelpers
 * @notice This library contains helper functions for converting certain data types into bytes32 entities
 */
library EntityHelpers {
  // ID of the player entity outside of a specific game
  function globalAddressToKey(address addr) public pure returns (bytes32) {
    return bytes32(uint256(uint160(addr)));
  }
  // ID of the player entity within a specific game
  function localAddressToKey(bytes32 gameId, address addr) public pure returns (bytes32) {
    return keccak256(abi.encode(gameId, addr));
  }

  function positionToEntityKey(bytes32 gameId, int16 x, int16 y) public pure returns (bytes32) {
    return keccak256(abi.encode(gameId, x, y));
  }
}
