// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import {
  CurrentGame,
  EntityAtPosition,
  Game,
  GameData,
  Health,
  MapConfig,
  Owner,
  OwnerTowers,
  Position,
  Projectile,
  Tower
} from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";
import { positionToEntityKey } from "../positionToEntityKey.sol";

// TOWER ID
// bytes32 towerId = keccak256(abi.encodePacked(currentGameId, playerAddress, timestamp));

contract TowerSystem is System {
  function installTower(bytes32 potentialGameId, bool projectile, int8 x, int8 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    bytes32 player = addressToEntityKey(playerAddress);

    _validateInstallTower(potentialGameId, playerAddress, player, x, y);

    uint256 timestamp = block.timestamp;
    bytes32 towerId = keccak256(abi.encodePacked(potentialGameId, playerAddress, timestamp));

    _initializeTower(towerId, potentialGameId, playerAddress, player, x, y, projectile);

    return towerId;
  }

  function moveTower(bytes32 potentialGameId, bytes32 towerId, int8 x, int8 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    bytes32 player = addressToEntityKey(playerAddress);

    _validateMoveTower(potentialGameId, playerAddress, player, towerId, x, y);

    (int8 oldX, int8 oldY) = Position.get(towerId);
    EntityAtPosition.set(positionToEntityKey(potentialGameId, oldX, oldY), 0);

    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(potentialGameId, x, y), towerId);

    _decrementActionCount(player);

    return towerId;
  }

  function _validateInstallTower(
    bytes32 potentialGameId,
    address playerAddress,
    bytes32 player,
    int8 x,
    int8 y
  ) internal view {
    bytes32 currentGameId = CurrentGame.get(player);
    require(currentGameId != 0, "TowerSystem: player has no ongoing game");
    require(currentGameId == potentialGameId, "TowerSystem: game does not match player's ongoing game");

    GameData memory currentGame = Game.get(currentGameId);
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");

    (int8 height, int8 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");
    require(x < width / 2, "TowerSystem: x is in enemy territory");
  }

  function _validateMoveTower(
    bytes32 potentialGameId,
    address playerAddress,
    bytes32 player,
    bytes32 towerId,
    int8 x,
    int8 y
  ) internal view {
    bytes32 currentGameId = CurrentGame.get(player);
    require(currentGameId != 0, "TowerSystem: player has no ongoing game");
    require(currentGameId == potentialGameId, "TowerSystem: game does not match player's ongoing game");

    GameData memory currentGame = Game.get(currentGameId);
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");

    require(Tower.get(towerId), "TowerSystem: entity is not a tower");

    (int8 height, int8 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");
  }

  function _initializeTower(
    bytes32 towerId,
    bytes32 gameId,
    address playerAddress,
    bytes32 player,
    int8 x,
    int8 y,
    bool projectile
  ) internal {
    Tower.set(towerId, true);
    CurrentGame.set(towerId, gameId);
    Owner.set(towerId, playerAddress);

    _addTowerToPlayer(player, towerId);

    Health.set(towerId, 2, 2);
    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(gameId, x, y), towerId);

    if (projectile) {
      Projectile.set(towerId, true);
    }

    _decrementActionCount(player);
  }

  function _addTowerToPlayer(bytes32 player, bytes32 towerId) internal {
    bytes32[] memory playerTowers = OwnerTowers.get(player);
    bytes32[] memory updatedTowers = new bytes32[](playerTowers.length + 1);

    for (uint256 i = 0; i < playerTowers.length; i++) {
      updatedTowers[i] = playerTowers[i];
    }

    updatedTowers[playerTowers.length] = towerId;
    OwnerTowers.set(player, updatedTowers);
  }

  function _decrementActionCount(bytes32 player) internal {
    bytes32 currentGameId = CurrentGame.get(player);
    GameData memory currentGame = Game.get(currentGameId);
    currentGame.actionCount -= 1;
    Game.set(currentGameId, currentGame);
  }
}
