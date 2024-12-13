// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { CurrentGame, EntityAtPosition, Game, GameData, Health, MapConfig, Owner, Position, Projectile, Tower } from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";
import { positionToEntityKey } from "../positionToEntityKey.sol";

// TOWER ID
// bytes32 towerId = keccak256(abi.encodePacked(currentGameId, playerAddress, timestamp));

contract TowerSystem is System {
  function installTower(bytes32 potentialGameId, bool projectile, int8 x, int8 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    bytes32 player = addressToEntityKey(playerAddress);

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

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");
    require(x < width / 2, "TowerSystem: x is in enemy territory");

    uint256 timestamp = block.timestamp;
    bytes32 towerId = keccak256(abi.encodePacked(currentGameId, playerAddress, timestamp));

    Tower.set(towerId, true);
    CurrentGame.set(towerId, currentGameId);
    Owner.set(towerId, playerAddress);
    Health.set(towerId, 5, 5);

    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(x, y), towerId);

    if (projectile) {
      Projectile.set(towerId, true);
    }

    currentGame.actionCount -= 1;
    Game.set(currentGameId, currentGame);

    return towerId;
  }

  function moveTower(bytes32 potentialGameId, bytes32 towerId, int8 x, int8 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    bytes32 player = addressToEntityKey(playerAddress);

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

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    (int8 oldX, int8 oldY) = Position.get(towerId);
    EntityAtPosition.set(positionToEntityKey(oldX, oldY), 0);

    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(x, y), towerId);

    currentGame.actionCount -= 1;
    Game.set(currentGameId, currentGame);

    return towerId;
  }
}
