// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

struct TowerDetails {
  bytes32 id;
  uint8 health;
  address projectileAddress;
  int16 projectileX;
  int16 projectileY;
  int16 x;
  int16 y;
}
