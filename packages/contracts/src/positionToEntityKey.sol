// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

function positionToEntityKey(uint8 x, uint8 y) pure returns (bytes32) {
  return keccak256(abi.encode(x, y));
}