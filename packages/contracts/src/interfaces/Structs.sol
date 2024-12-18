// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

struct TowerDetails {
  bytes32 id;
  uint8 health;
  address projectileLogic;
  int8 projectileX;
  int8 projectileY;
  int8 x;
  int8 y;
}
