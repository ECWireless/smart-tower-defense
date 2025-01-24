// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { AddressBook, Action, ActionData, Castle, CurrentGame, EntityAtPosition, Game, GamesByLevel, GameData, Health, MapConfig, Owner, OwnerTowers, Position, Projectile, ProjectileData, SavedGame, SavedGameData, Username, UsernameTaken, WinStreak } from "../codegen/index.sol";
import { ActionType } from "../codegen/common.sol";
import { TowerDetails } from "../interfaces/Structs.sol";
import { MAX_ACTIONS, MAX_CASTLE_HEALTH, MAX_TOWER_HEALTH, MAX_TICKS } from "../../constants.sol";
import { ProjectileHelpers } from "../Libraries/ProjectileHelpers.sol";
import { EntityHelpers } from "../Libraries/EntityHelpers.sol";
import { GameHelpers } from "../Libraries/GameHelpers.sol";
import "forge-std/console.sol";

contract GameSystem is System {
  function getGameSystemAddress() external view returns (address) {
    return address(this);
  }

  function createGame(bytes32 savedGameId, address player2Address, string memory username) public returns (bytes32) {
    if (savedGameId == 0) {
      bytes32 robId = EntityHelpers.addressToEntityKey(address(0));
      savedGameId = keccak256(abi.encodePacked(bytes32(0), robId));
    }
    address player1Address = _msgSender();
    bytes32 player1 = EntityHelpers.addressToEntityKey(player1Address);
    bytes32 player2 = EntityHelpers.addressToEntityKey(player2Address);

    _validateCreateGame(player1, username);

    uint256 timestamp = block.timestamp;
    bytes32 gameId = keccak256(abi.encodePacked(player1Address, player2Address, timestamp));

    GameData memory newGame = GameData({
      actionCount: MAX_ACTIONS,
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

    bytes32 castle1Id = keccak256(abi.encodePacked(gameId, player1Address, timestamp));
    bytes32 castle2Id = keccak256(abi.encodePacked(gameId, player2Address, timestamp));

    CurrentGame.set(castle1Id, gameId);
    CurrentGame.set(castle2Id, gameId);

    Owner.set(castle1Id, player1Address);
    Owner.set(castle2Id, player2Address);

    OwnerTowers.set(player1, new bytes32[](0));
    OwnerTowers.set(player2, new bytes32[](0));

    Castle.set(castle1Id, true);
    Castle.set(castle2Id, true);

    (int16 mapHeight, int16 mapWidth) = MapConfig.get();

    Position.set(castle1Id, 0, mapHeight / 2);
    Position.set(castle2Id, mapWidth - 5, mapHeight / 2);

    Health.set(castle1Id, MAX_CASTLE_HEALTH, MAX_CASTLE_HEALTH);
    Health.set(castle2Id, MAX_CASTLE_HEALTH, MAX_CASTLE_HEALTH);

    EntityAtPosition.set(EntityHelpers.positionToEntityKey(gameId, 0, mapHeight / 2), castle1Id);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(gameId, mapWidth - 5, mapHeight / 2), castle2Id);

    bytes32[] memory savedGameActions = SavedGame.getActions(savedGameId);
    SavedGameData memory loadedSavedGame = SavedGameData({
      gameId: gameId,
      winner: address(0),
      actions: savedGameActions
    });
    SavedGame.set(gameId, loadedSavedGame);

    return gameId;
  }

  function nextLevel() external returns (bytes32) {
    address player1Address = _msgSender();
    bytes32 player1 = EntityHelpers.addressToEntityKey(player1Address);
    uint256 winStreak = WinStreak.get(player1);
    require(winStreak > 0, "GameSystem: player1 has no win streak");

    uint256 randomNumber = block.prevrandao;
    if (block.chainid == 31337) {
      randomNumber = uint256(block.timestamp);
    }

    bytes32[] memory savedGameIds = GamesByLevel.get(winStreak);
    bytes32 savedGameId = savedGameIds[randomNumber % savedGameIds.length];
    address savedGameWinner = SavedGame.getWinner(savedGameId);

    while (savedGameWinner == player1Address) {
      if (savedGameIds.length == 1) {
        break;
      }
      bytes32[] memory trimmedSavedGameIds = new bytes32[](savedGameIds.length - 1);
      uint256 index = 0;
      for (uint256 i = 0; i < savedGameIds.length; i++) {
        if (savedGameIds[i] != savedGameId) {
          trimmedSavedGameIds[index] = savedGameIds[i];
          index++;
        }
      }
      savedGameIds = trimmedSavedGameIds;
      randomNumber = block.prevrandao;

      if (block.chainid == 31337) {
        randomNumber = uint256(block.timestamp);
      }

      savedGameId = savedGameIds[randomNumber % savedGameIds.length];
      savedGameWinner = SavedGame.getWinner(savedGameId);
    }

    require(savedGameWinner != player1Address, "GameSystem: no valid saved game found");

    string memory username = Username.get(player1);
    createGame(savedGameId, savedGameWinner, username);

    return savedGameId;
  }

  function nextTurn(bytes32 gameId) external {
    GameData memory game = Game.get(gameId);
    require(game.endTimestamp == 0, "GameSystem: game has ended");

    address player1Address = game.player1Address;
    address player2Address = game.player2Address;

    address currentPlayerAddress = game.turn;

    if (game.turn == player1Address) {
      // TODO: Maybe bring back this restriction
      // require(newGame.actionCount == 0, "GameSystem: player has actions remaining");

      bytes32 player1 = EntityHelpers.addressToEntityKey(player1Address);
      bytes32 player2 = EntityHelpers.addressToEntityKey(player2Address);

      bytes32[] memory allTowers = ProjectileHelpers.getAllTowers(player1, player2);
      ProjectileHelpers.clearAllProjectiles(allTowers);
    } else {
      Game.setRoundCount(gameId, game.roundCount + 1);
      ProjectileHelpers.executeRoundResults(gameId);
    }

    Game.setTurn(gameId, currentPlayerAddress == player1Address ? player2Address : player1Address);
    Game.setActionCount(gameId, 1);

    if (Game.getTurn(gameId) == player2Address) {
      _executePlayer2Actions(gameId, player1Address);
    }
  }

  function _validateCreateGame(bytes32 player1, string memory username) internal {
    string memory player1Username = Username.get(player1);
    if (bytes(player1Username).length == 0) {
      bytes32 usernameBytes = keccak256(abi.encodePacked(username));
      require(!UsernameTaken.get(usernameBytes), "GameSystem: username is taken");
      Username.set(player1, username);
      UsernameTaken.set(usernameBytes, true);
    }

    bytes32 currentGameId = CurrentGame.get(player1);
    if (currentGameId != 0) {
      GameData memory currentGame = Game.get(currentGameId);
      require(currentGame.endTimestamp != 0, "GameSystem: player1 has an ongoing game");
    }
  }

  function _executePlayer2Actions(bytes32 gameId, address player1Address) internal {
    bytes32 player1 = EntityHelpers.addressToEntityKey(player1Address);
    uint256 turnCount = Game.getRoundCount(gameId) - 1;

    bytes32[] memory actionIds = SavedGame.getActions(gameId);
    if (actionIds.length > turnCount) {
      address worldAddress = AddressBook.getWorld();
      ActionData memory action = Action.get(actionIds[turnCount]);
      (, int16 width) = MapConfig.get();
      action.newX = width - action.newX;
      action.oldX = width - action.oldX;

      if (action.actionType == ActionType.Install) {
        bytes memory data = abi.encodeWithSignature(
          "app__installTower(bytes32,bool,int16,int16)",
          CurrentGame.get(player1),
          action.projectile,
          action.newX,
          action.newY
        );

        (bool success, ) = worldAddress.call(data);
        require(success, "installTower call failed");
      } else if (action.actionType == ActionType.Move) {
        bytes memory data = abi.encodeWithSignature(
          "app__moveTower(bytes32,bytes32,int16,int16)",
          CurrentGame.get(player1),
          EntityAtPosition.get(EntityHelpers.positionToEntityKey(gameId, action.oldX, action.oldY)),
          action.newX,
          action.newY
        );

        (bool success, ) = worldAddress.call(data);
        require(success, "moveTower call failed");
      } else if (action.actionType == ActionType.Modify) {
        ProjectileData memory projectileData = Projectile.get(actionIds[turnCount]);

        bytes memory data = abi.encodeWithSignature(
          "app__modifyTowerSystem(bytes32,bytes,string)",
          EntityAtPosition.get(EntityHelpers.positionToEntityKey(gameId, action.oldX, action.oldY)),
          projectileData.bytecode,
          projectileData.sourceCode
        );

        (bool success, ) = worldAddress.call(data);
        require(success, "modifyTowerSystem call failed");
      }
    }
  }
}
