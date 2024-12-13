// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

enum ActionType {
  Install,
  Move,
  Modify
}

struct TowerDetails {
  bytes32 id;
  uint8 health;
  bool projectile;
  int8 projectileX;
  int8 projectileY;
  int8 x;
  int8 y;
}

struct Action {
  int8 towerX;
  int8 towerY;
  ActionType actionType;
  bool projectile;
  int8 newTowerX;
  int8 newTowerY;
}
