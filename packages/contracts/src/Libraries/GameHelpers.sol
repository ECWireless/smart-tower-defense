import { Action, ActionData, Castle, CurrentGame, EntityAtPosition, Game, GamesByLevel, GameData, Health, Level, MapConfig, Owner, OwnerTowers, Position, Projectile, ProjectileData, SavedGame, SavedGameData, TopLevel, Username, UsernameTaken, WinStreak } from "../codegen/index.sol";
import { ActionType } from "../codegen/common.sol";
import { EntityHelpers } from "./EntityHelpers.sol";
import { MAX_ACTIONS, MAX_CASTLE_HEALTH } from "../../constants.sol";
import "forge-std/console.sol";

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title GameHelpers
 * @notice This library contains helper functions for GameSystem
 */
library GameHelpers {
  function initializeGame(
    address player1Address,
    address player2Address,
    bytes32 savedGameId,
    bytes32 globalPlayer1
  ) public returns (bytes32) {
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
    CurrentGame.set(globalPlayer1, gameId);

    bytes32 castle1Id = keccak256(abi.encodePacked(gameId, player1Address, timestamp));
    bytes32 castle2Id = keccak256(abi.encodePacked(gameId, player2Address, timestamp));

    CurrentGame.set(castle1Id, gameId);
    CurrentGame.set(castle2Id, gameId);

    Owner.set(castle1Id, player1Address);
    Owner.set(castle2Id, player2Address);

    bytes32 localPlayer1 = EntityHelpers.localAddressToKey(gameId, player1Address);
    bytes32 localPlayer2 = EntityHelpers.localAddressToKey(gameId, player2Address);
    OwnerTowers.set(localPlayer1, new bytes32[](0));
    OwnerTowers.set(localPlayer2, new bytes32[](0));

    Castle.set(castle1Id, true);
    Castle.set(castle2Id, true);

    (int16 mapHeight, int16 mapWidth) = MapConfig.get();
    Position.set(castle1Id, 5, mapHeight / 2);
    Position.set(castle2Id, mapWidth - 5, mapHeight / 2);

    Health.set(castle1Id, MAX_CASTLE_HEALTH, MAX_CASTLE_HEALTH);
    Health.set(castle2Id, MAX_CASTLE_HEALTH, MAX_CASTLE_HEALTH);

    EntityAtPosition.set(EntityHelpers.positionToEntityKey(gameId, 5, mapHeight / 2), castle1Id);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(gameId, mapWidth - 5, mapHeight / 2), castle2Id);

    bytes32[] memory savedGameActions = SavedGame.getActions(savedGameId);
    SavedGameData memory loadedSavedGame = SavedGameData({
      gameId: gameId,
      winner: address(0),
      actions: savedGameActions
    });
    SavedGame.set(gameId, loadedSavedGame);

    Level.set(gameId, WinStreak.get(globalPlayer1));

    return gameId;
  }

  function nextLevel(address player1Address) public view returns (bytes32) {
    bytes32 globalPlayer1 = EntityHelpers.globalAddressToKey(player1Address);
    uint256 winStreak = WinStreak.get(globalPlayer1);
    require(winStreak > 0, "GameSystem: player1 has no win streak");

    uint256 randomNumber = block.chainid == 31337 ? block.timestamp : block.prevrandao;

    bytes32[] memory savedGameIds = GamesByLevel.get(winStreak);
    require(savedGameIds.length > 0, "GameSystem: no saved games available");

    bytes32 savedGameId;
    address savedGameWinner;

    uint256 savedGameOriginalLength = savedGameIds.length;

    for (uint256 i = 0; i < savedGameOriginalLength; i++) {
      // Pick a random saved game
      uint256 index = randomNumber % savedGameIds.length;
      savedGameId = savedGameIds[index];
      savedGameWinner = SavedGame.getWinner(savedGameId);

      // If the winner is not the player, return the game ID
      if (savedGameWinner != player1Address) {
        return savedGameId;
      }

      // Remove the checked game ID from the array
      savedGameIds[index] = savedGameIds[savedGameIds.length - 1];
      assembly {
        mstore(savedGameIds, sub(mload(savedGameIds), 1))
      }

      // Update random number for the next iteration
      randomNumber = uint256(keccak256(abi.encode(randomNumber, index)));
    }

    revert("GameSystem: no valid saved game found");
  }

  function validateCreateGame(bytes32 globalPlayer1, string memory username) public {
    string memory player1Username = Username.get(globalPlayer1);
    if (bytes(player1Username).length == 0) {
      bytes32 usernameBytes = keccak256(abi.encodePacked(username));
      require(!UsernameTaken.get(usernameBytes), "GameSystem: username is taken");
      Username.set(globalPlayer1, username);
      UsernameTaken.set(usernameBytes, true);
    }

    bytes32 currentGameId = CurrentGame.get(globalPlayer1);
    if (currentGameId != 0) {
      GameData memory currentGame = Game.get(currentGameId);
      require(currentGame.endTimestamp != 0, "GameSystem: player1 has an ongoing game");
    }
  }

  function executePlayer2Actions(address worldAddress, bytes32 gameId, address player1Address) public {
    bytes32 globalPlayer1 = EntityHelpers.globalAddressToKey(player1Address);
    uint8 roundCount = Game.getRoundCount(gameId) - 1;
    uint8 actionCount = Game.getActionCount(gameId);
    uint256 actionIdIndex = (roundCount * MAX_ACTIONS) + (MAX_ACTIONS - actionCount);

    bytes32[] memory actionIds = SavedGame.getActions(gameId);
    if (actionIdIndex >= actionIds.length) {
      return;
    }

    ActionData memory action = Action.get(actionIds[actionIdIndex]);
    (, int16 width) = MapConfig.get();
    action.newX = width - action.newX;
    action.oldX = width - action.oldX;

    if (action.actionType == ActionType.Install) {
      bytes memory data = abi.encodeWithSignature(
        "app__installTower(bytes32,bool,int16,int16)",
        CurrentGame.get(globalPlayer1),
        action.projectile,
        action.newX,
        action.newY
      );

      (bool success, ) = worldAddress.call(data);
      require(success, "installTower call failed");
    } else if (action.actionType == ActionType.Move) {
      bytes32 towerEntity = EntityAtPosition.get(EntityHelpers.positionToEntityKey(gameId, action.oldX, action.oldY));
      uint8 towerHealth = Health.getCurrentHealth(towerEntity);
      if (towerHealth == 0) {
        return;
      }

      bytes memory data = abi.encodeWithSignature(
        "app__moveTower(bytes32,bytes32,int16,int16)",
        CurrentGame.get(globalPlayer1),
        towerEntity,
        action.newX,
        action.newY
      );

      (bool success, ) = worldAddress.call(data);
      require(success, "moveTower call failed");
    } else if (action.actionType == ActionType.Modify) {
      ProjectileData memory projectileData = Projectile.get(actionIds[actionIdIndex]);
      bytes32 towerEntity = EntityAtPosition.get(EntityHelpers.positionToEntityKey(gameId, action.oldX, action.oldY));
      uint8 towerHealth = Health.getCurrentHealth(towerEntity);
      if (towerHealth == 0) {
        return;
      }

      bytes memory data = abi.encodeWithSignature(
        "app__modifyTowerSystem(bytes32,bytes,string)",
        towerEntity,
        projectileData.bytecode,
        projectileData.sourceCode
      );

      (bool success, ) = worldAddress.call(data);
      require(success, "modifyTowerSystem call failed");
    }
  }

  function endGame(bytes32 gameId, address winner) public {
    require(Game.getWinner(gameId) == address(0), "GameSystem: game has already ended");
    require(Game.getEndTimestamp(gameId) == 0, "GameSystem: game has already ended");

    Game.setEndTimestamp(gameId, block.timestamp);
    Game.setWinner(gameId, winner);

    (int16 mapHeight, int16 mapWidth) = MapConfig.get();

    bytes32 player1CastleId = EntityHelpers.positionToEntityKey(gameId, 5, mapHeight / 2);
    bytes32 player2CastleId = EntityHelpers.positionToEntityKey(gameId, mapWidth - 5, mapHeight / 2);

    bool isWinnerPlayer1 = Game.get(gameId).player1Address == winner;
    bytes32 loserCastleId = isWinnerPlayer1 ? player2CastleId : player1CastleId;

    uint8 loserCastleHealth = Health.getCurrentHealth(loserCastleId);
    require(loserCastleHealth == 0, "GameSystem: loser castle health is not zero");

    GameData memory game = Game.get(gameId);
    address loserAddress = game.player1Address == winner ? game.player2Address : game.player1Address;

    if (loserAddress == game.player1Address) {
      bytes32 globalLoserId = EntityHelpers.globalAddressToKey(loserAddress);
      WinStreak.set(globalLoserId, 0);
    } else {
      bytes32 globalWinnerId = EntityHelpers.globalAddressToKey(winner);
      uint256 winStreak = WinStreak.get(globalWinnerId) + 1;
      WinStreak.set(globalWinnerId, winStreak);

      bytes32 savedGameId = keccak256(abi.encodePacked(gameId, globalWinnerId));
      bytes32[] memory gamesByLevel = GamesByLevel.get(winStreak);

      if (gamesByLevel.length == 0) {
        TopLevel.set(winStreak);
      }

      bytes32[] memory updatedGamesByLevel = new bytes32[](gamesByLevel.length + 1);
      for (uint256 i = 0; i < gamesByLevel.length; i++) {
        updatedGamesByLevel[i] = gamesByLevel[i];

        if (gamesByLevel[i] == savedGameId) {
          return;
        }
      }
      updatedGamesByLevel[updatedGamesByLevel.length - 1] = savedGameId;
      GamesByLevel.set(winStreak, updatedGamesByLevel);
    }
  }
}
