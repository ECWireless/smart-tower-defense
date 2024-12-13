// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Castle, CurrentGame, EntityAtPosition, Health, Game, GameData, Owner, OwnerTowers, Position, Projectile } from "../codegen/index.sol";
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
      turn: player1Address
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

    Health.set(castle1Id, 10, 10);
    Health.set(castle2Id, 10, 10);

    EntityAtPosition.set(positionToEntityKey(0, 3), castle1Id);
    EntityAtPosition.set(positionToEntityKey(13, 3), castle2Id);

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

    GameData memory newGame = Game.get(gameId);

    if (newGame.turn == player1Address) {
      require(newGame.actionCount == 0, "GameSystem: player has actions remaining");
    } else {
      newGame.roundCount += 1;
      _executeRoundResults(gameId);
    }

    newGame.turn = currentPlayer == player1Address ? player2Address : player1Address;
    newGame.actionCount = 1;
    Game.set(gameId, newGame);
  }

  function _executeRoundResults(bytes32 gameId) internal {
    address player1Address = Game.getPlayer1Address(gameId);
    address player2Address = Game.getPlayer2Address(gameId);

    bytes32 player1 = addressToEntityKey(player1Address);
    bytes32 player2 = addressToEntityKey(player2Address);
    
    // 1. Get all towers
    bytes32[] memory towers1 = OwnerTowers.get(player1);
    bytes32[] memory towers2 = OwnerTowers.get(player2);

    bytes32[] memory allTowers = new bytes32[](towers1.length + towers2.length);

    uint256 index = 0;
    for (uint256 i = 0; i < towers1.length; i++) {
      allTowers[index] = towers1[i];
      index += 1;
    }

    for (uint256 i = 0; i < towers2.length; i++) {
      allTowers[index] = towers2[i];
      index += 1;
    }

    // 2. Get details for all towers
    TowerDetails[] memory towers = new TowerDetails[](allTowers.length);
    for (uint256 i = 0; i < allTowers.length; i++) {
      bytes32 towerId = allTowers[i];
      uint8 x = Position.getX(towerId);
      uint8 y = Position.getY(towerId);
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

    // 3. Loop through 20 ticks, checking for collisions based on:
    //     - the tower's position
    //     - the trajectory formula
    //     - and the position of other entities
    uint256 tick = 0;
    while (tick < 20) {
      for (uint256 i = 0; i < towers.length; i++) {
        TowerDetails memory tower = towers[i];

        if (tower.health == 0) {
          continue;
        }

        if (!tower.projectile) {
          continue;
        }

        (uint8 newX, uint8 newY) = _getProjectilePosition(tower.projectileX, tower.projectileY);

        for (uint256 j = 0; j < towers.length; j++) {
          TowerDetails memory otherTower = towers[j];

          if (otherTower.health == 0) {
            continue;
          }

          if (!otherTower.projectile) {
            continue;
          }

          if (newX == otherTower.projectileX && newY == otherTower.projectileY) {
            // 3.1. If 2 projectiles collide, remove both projectiles
            towers[i].projectile = false;

            towers[j].projectile = false;
          }
        }

        bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(newX, newY));

        if (positionEntity != 0) {
          uint8 newHealth = Health.getCurrentHealth(positionEntity) - 1;
          if (Castle.get(positionEntity)) {
            // 3.2. If a projectile hits a castle, apply 1 damage to the castle and remove the projectile
            Health.setCurrentHealth(positionEntity, newHealth);
            towers[i].projectile = false;
          } else {
            // 3.3. If a projectile hits a tower, apply 1 damage to the tower and remove the projectile
            Health.setCurrentHealth(positionEntity, newHealth);
            towers[i].projectile = false;

            if (newHealth == 0) {
              // 3.4. If the tower has 0 health, remove the tower
              address ownerAddress = Owner.get(positionEntity);
              bytes32 owner = addressToEntityKey(ownerAddress);
              bytes32[] memory ownerTowers = OwnerTowers.get(owner);
              bytes32[] memory updatedTowers = new bytes32[](ownerTowers.length - 1);

              index = 0;
              for (uint256 j = 0; j < ownerTowers.length; j++) {
                if (ownerTowers[j] != positionEntity) {
                  updatedTowers[index] = ownerTowers[j];
                  index += 1;
                }
              }

              OwnerTowers.set(owner, updatedTowers);

              Owner.set(positionEntity, address(0));
              Health.set(positionEntity, 0, 5);
              EntityAtPosition.set(positionToEntityKey(newX, newY), 0);
            }
          }
        } else {
          towers[i].projectileX = newX;
          towers[i].projectileY = newY;
        }
      }

      tick += 1;
    }
  }

  function _getProjectilePosition(uint8 x, uint8 y) internal pure returns (uint8, uint8) {
    return (x + 1, y);
  }
}
