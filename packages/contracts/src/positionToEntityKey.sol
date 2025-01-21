// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

function positionToEntityKey(bytes32 gameId, int16 x, int16 y) pure returns (bytes32) {
  return keccak256(abi.encode(gameId, x, y));
}
