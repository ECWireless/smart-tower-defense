// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

contract DefaultProjectileLogic {
  function getNextProjectilePosition(int16 x, int16 y) public pure returns (int16, int16) {
    return (x + 5, y);
  }
}
