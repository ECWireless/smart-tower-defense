// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { AddressBook, CurrentGame, EntityAtPosition, Game, GameData, Health, MapConfig, Owner, OwnerTowers, Position, Projectile, Tower } from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";
import { positionToEntityKey } from "../positionToEntityKey.sol";
import { MAX_TOWER_HEALTH } from "../../constants.sol";

// TOWER ID
// bytes32 towerId = keccak256(abi.encodePacked(currentGameId, playerAddress, timestamp));

contract TowerSystem is System {
  function getTowerSystemAddress() external view returns (address) {
    return address(this);
  }

  function installTower(bytes32 potentialGameId, bool projectile, int8 x, int8 y) public returns (bytes32) {
    address playerAddress = _msgSender();
    _validateInstallTower(potentialGameId, playerAddress, x, y);

    uint256 timestamp = block.timestamp;
    address actualPlayerAddress = Game.get(potentialGameId).turn;
    bytes32 towerId = keccak256(abi.encodePacked(potentialGameId, actualPlayerAddress, timestamp));
    _initializeTower(towerId, potentialGameId, actualPlayerAddress, x, y, projectile);

    return towerId;
  }

  function moveTower(bytes32 potentialGameId, bytes32 towerId, int8 x, int8 y) public returns (bytes32) {
    address playerAddress = _msgSender();
    _validateMoveTower(potentialGameId, playerAddress, towerId, x, y);

    (int8 oldX, int8 oldY) = Position.get(towerId);
    EntityAtPosition.set(positionToEntityKey(potentialGameId, oldX, oldY), 0);

    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(potentialGameId, x, y), towerId);

    _decrementActionCount(potentialGameId);

    return towerId;
  }

  function _validateInstallTower(bytes32 potentialGameId, address playerAddress, int8 x, int8 y) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 player = addressToEntityKey(playerAddress);
    bytes32 currentGameId = CurrentGame.get(player);

    if (playerAddress == gameSystemAddress) {
      currentGameId = potentialGameId;
    }

    require(currentGameId != 0, "TowerSystem: player has no ongoing game");
    require(currentGameId == potentialGameId, "TowerSystem: game does not match player's ongoing game");

    GameData memory currentGame = Game.get(currentGameId);
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");

    if (playerAddress == gameSystemAddress) {
      require(currentGame.turn == currentGame.player2Address, "TowerSystem: not player's turn");
    } else {
      require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");
    }

    (int8 height, int8 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    if (playerAddress == gameSystemAddress) {
      require(x > width / 2, "TowerSystem: x position is in enemy territory");
    } else {
      require(x < width / 2, "TowerSystem: x position is in player territory");
    }
  }

  function _validateMoveTower(
    bytes32 potentialGameId,
    address playerAddress,
    bytes32 towerId,
    int8 x,
    int8 y
  ) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 player = addressToEntityKey(playerAddress);
    bytes32 currentGameId = CurrentGame.get(player);

    if (playerAddress == gameSystemAddress) {
      currentGameId = potentialGameId;
    }

    require(currentGameId != 0, "TowerSystem: player has no ongoing game");
    require(currentGameId == potentialGameId, "TowerSystem: game does not match player's ongoing game");

    GameData memory currentGame = Game.get(currentGameId);
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");

    if (playerAddress == gameSystemAddress) {
      require(currentGame.turn == currentGame.player2Address, "TowerSystem: not player's turn");
    } else {
      require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");
    }

    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(Tower.get(towerId), "TowerSystem: entity is not a tower");

    (int8 height, int8 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    if (playerAddress == gameSystemAddress) {
      require(Owner.get(towerId) == currentGame.player2Address, "TowerSystem: player does not own tower");
    } else {
      require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");
    }

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    if (playerAddress == gameSystemAddress) {
      require(x > width / 2, "TowerSystem: x is in enemy territory");
    } else {
      require(x < width / 2, "TowerSystem: x is in player territory");
    }
  }

  function _initializeTower(
    bytes32 towerId,
    bytes32 gameId,
    address playerAddress,
    int8 x,
    int8 y,
    bool projectile
  ) internal {
    Tower.set(towerId, true);
    CurrentGame.set(towerId, gameId);
    Owner.set(towerId, playerAddress);

    bytes32 player = addressToEntityKey(playerAddress);
    _addTowerToPlayer(player, towerId);

    Health.set(towerId, MAX_TOWER_HEALTH, MAX_TOWER_HEALTH);
    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(gameId, x, y), towerId);

    if (projectile) {
      Projectile.set(towerId, true);
    }

    _decrementActionCount(gameId);
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

  function _decrementActionCount(bytes32 gameId) internal {
    Game.setActionCount(gameId, Game.getActionCount(gameId) - 1);
  }
}
