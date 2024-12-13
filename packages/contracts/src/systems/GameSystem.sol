// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import {
  Castle,
  CurrentGame,
  EntityAtPosition,
  Health,
  Game,
  GameData,
  Owner,
  OwnerTowers,
  Position,
  Projectile,
  ProjectileTrajectory
} from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";
import { positionToEntityKey } from "../positionToEntityKey.sol";
import { TowerDetails } from "../interfaces/Structs.sol";

contract GameSystem is System {
  function createGame(address player2Address) external returns (bytes32) {
    address player1Address = _msgSender();
    bytes32 player1 = addressToEntityKey(player1Address);
    bytes32 player2 = addressToEntityKey(player2Address);

    bytes32 currentGameId = CurrentGame.get(player1);

    if (currentGameId != 0) {
      GameData memory currentGame = Game.get(currentGameId);
      require(currentGame.endTimestamp != 0, "GameSystem: player1 has an ongoing game");
    }

    uint256 timestamp = block.timestamp;

    bytes32 gameId = keccak256(abi.encodePacked(player1Address, player2Address, timestamp));

    GameData memory newGame = GameData({
      actionCount: 1,
      endTimestamp: 0,
      player1Address: player1Address,
      player2Address: player2Address,
      roundCount: 1,
      startTimestamp: timestamp,
      turn: player1Address,
      winner: address(0)
    });
    Game.set(gameId, newGame);
    CurrentGame.set(player1, gameId);

    bytes32 castle1Id = keccak256(abi.encodePacked(currentGameId, player1Address, timestamp));
    bytes32 castle2Id = keccak256(abi.encodePacked(currentGameId, player2Address, timestamp));

    CurrentGame.set(castle1Id, gameId);
    CurrentGame.set(castle2Id, gameId);

    Owner.set(castle1Id, player1Address);
    Owner.set(castle2Id, player2Address);

    OwnerTowers.set(player1, new bytes32[](0));
    OwnerTowers.set(player2, new bytes32[](0));

    Castle.set(castle1Id, true);
    Castle.set(castle2Id, true);

    Position.set(castle1Id, 0, 3);
    Position.set(castle2Id, 13, 3);

    Health.set(castle1Id, 2, 2);
    Health.set(castle2Id, 2, 2);

    EntityAtPosition.set(positionToEntityKey(gameId, 0, 3), castle1Id);
    EntityAtPosition.set(positionToEntityKey(gameId, 13, 3), castle2Id);

    return gameId;
  }

  function nextTurn(bytes32 gameId) external {
    GameData memory game = Game.get(gameId);
    require(game.endTimestamp == 0, "GameSystem: game has ended");

    address player1Address = game.player1Address;
    address player2Address = game.player2Address;

    address currentPlayer = game.turn;

    if (player2Address != address(0)) {
      require(_msgSender() == currentPlayer, "GameSystem: it's not your turn");
    }

    if (game.turn == player1Address) {
      // TODO: Maybe bring back this restriction
      //   require(newGame.actionCount == 0, "GameSystem: player has actions remaining");

      bytes32 player1 = addressToEntityKey(player1Address);
      bytes32 player2 = addressToEntityKey(player2Address);

      bytes32[] memory allTowers = _getAllTowers(player1, player2);
      _clearAllProjectiles(allTowers);
    } else {
      Game.setRoundCount(gameId, game.roundCount + 1);
      _executeRoundResults(gameId);
    }

    Game.setTurn(gameId, currentPlayer == player1Address ? player2Address : player1Address);
    Game.setActionCount(gameId, 1);
  }

  function _executeRoundResults(bytes32 gameId) internal {
    address player1Address = Game.getPlayer1Address(gameId);
    address player2Address = Game.getPlayer2Address(gameId);

    bytes32 player1 = addressToEntityKey(player1Address);
    bytes32 player2 = addressToEntityKey(player2Address);

    bytes32[] memory allTowers = _getAllTowers(player1, player2);
    TowerDetails[] memory towers = _getTowerDetails(allTowers);

    _simulateTicks(towers);
  }

  function _clearAllProjectiles(bytes32[] memory allTowers) internal {
    for (uint256 i = 0; i < allTowers.length; i++) {
      bytes32 towerId = allTowers[i];
      ProjectileTrajectory.set(towerId, new int8[](0), new int8[](0));
    }
  }

  function _getAllTowers(bytes32 player1, bytes32 player2) internal view returns (bytes32[] memory) {
    bytes32[] memory towers1 = OwnerTowers.get(player1);
    bytes32[] memory towers2 = OwnerTowers.get(player2);

    bytes32[] memory allTowers = new bytes32[](towers1.length + towers2.length);
    uint256 index = 0;

    for (uint256 i = 0; i < towers1.length; i++) {
      allTowers[index++] = towers1[i];
    }

    for (uint256 i = 0; i < towers2.length; i++) {
      allTowers[index++] = towers2[i];
    }

    return allTowers;
  }

  function _getTowerDetails(bytes32[] memory allTowers) internal view returns (TowerDetails[] memory) {
    TowerDetails[] memory towers = new TowerDetails[](allTowers.length);

    for (uint256 i = 0; i < allTowers.length; i++) {
      bytes32 towerId = allTowers[i];
      int8 x = Position.getX(towerId);
      int8 y = Position.getY(towerId);

      towers[i] = TowerDetails({
        id: towerId,
        health: Health.getCurrentHealth(towerId),
        projectile: Projectile.get(towerId),
        projectileX: x,
        projectileY: y,
        x: x,
        y: y
      });
    }

    return towers;
  }

  function _simulateTicks(TowerDetails[] memory towers) internal {
    for (uint256 tick = 0; tick < 12; tick++) {
      _processTick(towers);
    }
  }

  function _processTick(TowerDetails[] memory towers) internal {
    for (uint256 i = 0; i < towers.length; i++) {
      TowerDetails memory tower = towers[i];

      if (tower.health == 0 || !tower.projectile) {
        continue;
      }

      (int8 newProjectileX, int8 newProjectileY) = _getProjectilePosition(tower.projectileX, tower.projectileY);

      if (newProjectileX > 13) {
        towers[i].projectile = false;
        continue;
      }

      (int8[] memory previousXTrajectory, int8[] memory previousYTrajectory) = ProjectileTrajectory.get(tower.id);

      // Add the new position after the last position in the trajectory array
      int8[] memory newXTrajectory = new int8[](previousXTrajectory.length + 1);
      int8[] memory newYTrajectory = new int8[](previousYTrajectory.length + 1);

      for (uint256 j = 0; j < previousXTrajectory.length; j++) {
        newXTrajectory[j] = previousXTrajectory[j];
        newYTrajectory[j] = previousYTrajectory[j];
      }

      newXTrajectory[previousXTrajectory.length] = newProjectileX;
      newYTrajectory[previousYTrajectory.length] = newProjectileY;

      ProjectileTrajectory.set(tower.id, newXTrajectory, newYTrajectory);

      for (uint256 j = 0; j < towers.length; j++) {
        if (_checkProjectileCollision(towers, i, j, newProjectileX, newProjectileY)) {
          break;
        }
      }

      _handleProjectileMovement(towers, i, newProjectileX, newProjectileY);
    }
  }

  function _checkProjectileCollision(
      TowerDetails[] memory towers,
      uint256 i,
      uint256 j,
      int8 newProjectileX,
      int8 newProjectileY
  ) internal pure returns (bool) {
      if (i == j || towers[j].health == 0 || !towers[j].projectile) {
          return false;
      }

      if (newProjectileX == towers[j].projectileX && newProjectileY == towers[j].projectileY) {
          towers[i].projectile = false;
          towers[j].projectile = false;
          return true;
      }

      return false;
  }

  function _handleProjectileMovement(
      TowerDetails[] memory towers,
      uint256 i,
      int8 newProjectileX,
      int8 newProjectileY
  ) internal {
    bytes32 gameId = CurrentGame.get(towers[i].id);
    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(gameId, newProjectileX, newProjectileY));

    if (positionEntity != 0) {
      _handleCollision(towers, i, positionEntity);
    } else {
      towers[i].projectileX = newProjectileX;
      towers[i].projectileY = newProjectileY;
    }
  }

  function _handleCollision(TowerDetails[] memory towers, uint256 i, bytes32 positionEntity) internal {
    uint8 newHealth = Health.getCurrentHealth(positionEntity) - 1;

    if (Castle.get(positionEntity)) {
      Health.setCurrentHealth(positionEntity, newHealth);
      towers[i].projectile = false;

      if (newHealth == 0) {
        bytes32 gameId = CurrentGame.get(towers[i].id);
        Game.setEndTimestamp(gameId, block.timestamp);
        Game.setWinner(gameId, Owner.get(towers[i].id));
      }
    } else {
      Health.setCurrentHealth(positionEntity, newHealth);
      towers[i].projectile = false;

      if (newHealth == 0) {
        _removeDestroyedTower(positionEntity);
      }
    }
  }

  function _removeDestroyedTower(bytes32 positionEntity) internal {
      address ownerAddress = Owner.get(positionEntity);
      bytes32 owner = addressToEntityKey(ownerAddress);

      bytes32[] memory ownerTowers = OwnerTowers.get(owner);
      bytes32[] memory updatedTowers = new bytes32[](ownerTowers.length - 1);
      uint256 index = 0;

      for (uint256 i = 0; i < ownerTowers.length; i++) {
        if (ownerTowers[i] != positionEntity) {
          updatedTowers[index++] = ownerTowers[i];
        }
      }

      bytes32 gameId = CurrentGame.get(positionEntity);

      OwnerTowers.set(owner, updatedTowers);
      Owner.set(positionEntity, address(0));
      Health.set(positionEntity, 0, 5);
      EntityAtPosition.set(positionToEntityKey(gameId, Position.getX(positionEntity), Position.getY(positionEntity)), 0);
      Position.set(positionEntity, -1, -1);
  }

  function _getProjectilePosition(int8 x, int8 y) internal pure returns (int8, int8) {
    return (x + 1, y);
  }
}
