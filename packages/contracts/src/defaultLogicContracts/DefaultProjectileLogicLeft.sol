// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

contract DefaultProjectileLogicLeft {
  function getNextProjectilePosition(int8 x, int8 y) public pure returns (int8, int8) {
    return (x + 1, y);
  }
}
