// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Action, ActionData, AddressBook, CurrentGame, DefaultLogic, EntityAtPosition, Game, GameData, Health, MapConfig, Owner, OwnerTowers, Position, Projectile, SavedGame, SavedGameData, Tower } from "../codegen/index.sol";
import { ActionType } from "../codegen/common.sol";
import { TowerDetails } from "../interfaces/Structs.sol";
import { EntityHelpers } from "./EntityHelpers.sol";
import { GameHelpers } from "./GameHelpers.sol";
import { ProjectileHelpers } from "./ProjectileHelpers.sol";
import { DEFAULT_LOGIC_SIZE_LIMIT, MAX_TOWER_HEALTH } from "../../constants.sol";

/**
 * @title TowerHelpers
 * @notice This library contains helper functions for TowerSystem
 */
library TowerHelpers {
  function validateInstallTower(bytes32 potentialGameId, address playerAddress, int16 x, int16 y) public view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 globalPlayerId = EntityHelpers.globalAddressToKey(playerAddress);
    bytes32 currentGameId = CurrentGame.get(globalPlayerId);

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

    (int16 height, int16 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    bytes32 positionEntity = EntityAtPosition.get(EntityHelpers.positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    if (playerAddress == gameSystemAddress) {
      require(x > width / 2, "TowerSystem: x position is in enemy territory");
    } else {
      require(x < width / 2, "TowerSystem: x position is in player territory");
    }
  }

  function validateMoveTower(
    bytes32 potentialGameId,
    address playerAddress,
    bytes32 towerId,
    int16 x,
    int16 y
  ) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 globalPlayerId = EntityHelpers.globalAddressToKey(playerAddress);
    bytes32 currentGameId = CurrentGame.get(globalPlayerId);

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

    (int16 height, int16 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    if (playerAddress == gameSystemAddress) {
      require(Owner.get(towerId) == currentGame.player2Address, "TowerSystem: player does not own tower");
    } else {
      require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");
    }

    bytes32 positionEntity = EntityAtPosition.get(EntityHelpers.positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    if (playerAddress == gameSystemAddress) {
      require(x > width / 2, "TowerSystem: x is in enemy territory");
    } else {
      require(x < width / 2, "TowerSystem: x is in player territory");
    }
  }

  function initializeTower(
    bytes32 towerId,
    bytes32 gameId,
    address playerAddress,
    int16 x,
    int16 y,
    bool projectile
  ) public {
    Tower.set(towerId, true);
    CurrentGame.set(towerId, gameId);
    Owner.set(towerId, playerAddress);

    _addTowerToPlayer(gameId, playerAddress, towerId);

    if (projectile) {
      Health.set(towerId, MAX_TOWER_HEALTH, MAX_TOWER_HEALTH);

      address defaultProjectileLogicLeftAddress = DefaultLogic.get();
      Projectile.setLogicAddress(towerId, defaultProjectileLogicLeftAddress);
      Projectile.setSourceCode(
        towerId,
        "contract DefaultProjectileLogic { function getNextProjectilePosition(int16 x, int16 y) public pure returns (int16, int16) { return (x + 5, y); }}"
      );
      Projectile.setSizeLimit(towerId, DEFAULT_LOGIC_SIZE_LIMIT);
    } else {
      Health.set(towerId, MAX_TOWER_HEALTH * 2, MAX_TOWER_HEALTH * 2);
    }
    Position.set(towerId, x, y);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(gameId, x, y), towerId);

    decrementActionCount(gameId);
  }

  function _addTowerToPlayer(bytes32 gameId, address playerAddress, bytes32 towerId) internal {
    bytes32 localPlayerId = EntityHelpers.localAddressToKey(gameId, playerAddress);

    bytes32[] memory playerTowers = OwnerTowers.get(localPlayerId);
    bytes32[] memory updatedTowers = new bytes32[](playerTowers.length + 1);

    for (uint256 i = 0; i < playerTowers.length; i++) {
      updatedTowers[i] = playerTowers[i];
    }

    updatedTowers[playerTowers.length] = towerId;
    OwnerTowers.set(localPlayerId, updatedTowers);
  }

  function decrementActionCount(bytes32 gameId) public {
    Game.setActionCount(gameId, Game.getActionCount(gameId) - 1);
  }

  function validModifySystem(bytes32 gameId, address gameSystemAddress, bytes32 towerId, address playerAddress) public {
    bytes32 towerGameId = CurrentGame.get(towerId);
    GameData memory currentGame = Game.get(gameId);

    require(gameId != 0, "TowerSystem: player has no ongoing game");
    require(gameId == towerGameId, "TowerSystem: game does not match player's ongoing game");

    if (playerAddress == gameSystemAddress) {
      require(Owner.get(towerId) == currentGame.player2Address, "TowerSystem: player does not own tower");
    } else {
      require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");
    }

    if (playerAddress == gameSystemAddress) {
      require(currentGame.turn == currentGame.player2Address, "TowerSystem: not player's turn");
    } else {
      require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");
    }

    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(Tower.get(towerId), "TowerSystem: entity is not a tower");
    require(Health.getCurrentHealth(towerId) > 0, "TowerSystem: tower is destroyed");

    (int16 oldX, int16 oldY) = Position.get(towerId);

    bytes memory data = abi.encodeWithSignature("getNextProjectilePosition(int16,int16)", oldX, oldY);
    address projectileAddress = Projectile.getLogicAddress(towerId);
    (bool success, bytes memory returndata) = projectileAddress.call(data);
    require(success, "getNextProjectilePosition call failed");
    (oldX, oldY) = abi.decode(returndata, (int16, int16));

    (success, returndata) = projectileAddress.call(data);
    require(success, "getNextProjectilePosition call failed");
    (int16 newX, int16 newY) = abi.decode(returndata, (int16, int16));

    uint16 distance = ProjectileHelpers.chebyshevDistance(
      uint256(int256(oldX)),
      uint256(int256(oldY)),
      uint256(int256(newX)),
      uint256(int256(newY))
    );
    require(distance <= 1, "TowerSystem: projectile speed exceeds rules");
  }

  function storeInstallTowerAction(
    bytes32 gameId,
    address playerAddress,
    int16 newX,
    int16 newY,
    bool hasProjectile
  ) public {
    address gameSystemAddress = AddressBook.getGame();
    if (playerAddress != gameSystemAddress) {
      bytes32 globalPlayerId = EntityHelpers.globalAddressToKey(playerAddress);
      bytes32 savedGameId = keccak256(abi.encodePacked(gameId, globalPlayerId));

      ActionData[] memory actions = new ActionData[](1);
      actions[0] = ActionData({
        actionType: ActionType.Install,
        newX: newX,
        newY: newY,
        oldX: 0,
        oldY: 0,
        projectile: hasProjectile
      });

      bytes32[] memory savedGameActionIds = SavedGame.getActions(savedGameId);
      bytes32[] memory newSavedGameActionIds = new bytes32[](savedGameActionIds.length + actions.length);

      for (uint256 i = 0; i < savedGameActionIds.length; i++) {
        newSavedGameActionIds[i] = savedGameActionIds[i];
      }

      for (uint256 i = 0; i < actions.length; i++) {
        newSavedGameActionIds[savedGameActionIds.length + i] = keccak256(
          abi.encodePacked(
            actions[i].actionType,
            actions[i].newX,
            actions[i].newY,
            actions[i].oldX,
            actions[i].oldY,
            actions[i].projectile
          )
        );
        Action.set(newSavedGameActionIds[savedGameActionIds.length + i], actions[i]);
      }

      SavedGameData memory savedGame = SavedGameData({
        gameId: gameId,
        winner: playerAddress,
        actions: newSavedGameActionIds
      });

      SavedGame.set(savedGameId, savedGame);
    }
  }

  function storeMoveTowerAction(
    bytes32 gameId,
    address playerAddress,
    bytes32 towerId,
    int16 oldX,
    int16 oldY,
    int16 newX,
    int16 newY
  ) public {
    address gameSystemAddress = AddressBook.getGame();
    if (playerAddress != gameSystemAddress) {
      bytes32 globalPlayerId = EntityHelpers.globalAddressToKey(playerAddress);
      bytes32 savedGameId = keccak256(abi.encodePacked(gameId, globalPlayerId));

      bool hasProjectile = Projectile.getLogicAddress(towerId) != address(0);

      ActionData[] memory actions = new ActionData[](1);
      actions[0] = ActionData({
        actionType: ActionType.Move,
        newX: newX,
        newY: newY,
        oldX: oldX,
        oldY: oldY,
        projectile: hasProjectile
      });

      bytes32[] memory savedGameActionIds = SavedGame.getActions(savedGameId);
      bytes32[] memory newSavedGameActionIds = new bytes32[](savedGameActionIds.length + actions.length);

      for (uint256 i = 0; i < savedGameActionIds.length; i++) {
        newSavedGameActionIds[i] = savedGameActionIds[i];
      }

      for (uint256 i = 0; i < actions.length; i++) {
        newSavedGameActionIds[savedGameActionIds.length + i] = keccak256(
          abi.encodePacked(
            actions[i].actionType,
            actions[i].newX,
            actions[i].newY,
            actions[i].oldX,
            actions[i].oldY,
            actions[i].projectile
          )
        );
        Action.set(newSavedGameActionIds[savedGameActionIds.length + i], actions[i]);
      }

      SavedGame.setActions(savedGameId, newSavedGameActionIds);
    }
  }

  function storeModifyTowerAction(
    bytes32 gameId,
    address playerAddress,
    bytes32 towerId,
    bytes memory bytecode,
    address systemAddress,
    string memory sourceCode
  ) public {
    address gameSystemAddress = AddressBook.getGame();
    if (playerAddress != gameSystemAddress) {
      bytes32 globalPlayerId = EntityHelpers.globalAddressToKey(playerAddress);
      bytes32 savedGameId = keccak256(abi.encodePacked(gameId, globalPlayerId));

      (int16 oldX, int16 oldY) = Position.get(towerId);
      bool hasProjectile = Projectile.getLogicAddress(towerId) != address(0);

      ActionData[] memory actions = new ActionData[](1);
      actions[0] = ActionData({
        actionType: ActionType.Modify,
        newX: oldX,
        newY: oldY,
        oldX: oldX,
        oldY: oldY,
        projectile: hasProjectile
      });

      bytes32[] memory savedGameActionIds = SavedGame.getActions(savedGameId);
      bytes32[] memory newSavedGameActionIds = new bytes32[](savedGameActionIds.length + actions.length);

      for (uint256 i = 0; i < savedGameActionIds.length; i++) {
        newSavedGameActionIds[i] = savedGameActionIds[i];
      }

      for (uint256 i = 0; i < actions.length; i++) {
        newSavedGameActionIds[savedGameActionIds.length + i] = keccak256(
          abi.encodePacked(
            actions[i].actionType,
            actions[i].newX,
            actions[i].newY,
            actions[i].oldX,
            actions[i].oldY,
            actions[i].projectile
          )
        );
        Action.set(newSavedGameActionIds[savedGameActionIds.length + i], actions[i]);

        _setActionProjectile(newSavedGameActionIds[savedGameActionIds.length + i], systemAddress, bytecode, sourceCode);
      }

      SavedGame.setActions(savedGameId, newSavedGameActionIds);
    }
  }

  function _setActionProjectile(
    bytes32 actionId,
    address systemAddress,
    bytes memory bytecode,
    string memory sourceCode
  ) internal {
    Projectile.set(actionId, systemAddress, DEFAULT_LOGIC_SIZE_LIMIT, bytecode, sourceCode);
  }
}
