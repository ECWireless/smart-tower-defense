import { Action, ActionData, AddressBook, CurrentGame, EntityAtPosition, Game, GamesByLevel, GameData, MapConfig, Projectile, ProjectileData, SavedGame, TopLevel, Username, UsernameTaken, WinStreak } from "../codegen/index.sol";
import { ActionType } from "../codegen/common.sol";
import { EntityHelpers } from "./EntityHelpers.sol";
import "forge-std/console.sol";

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title GameHelpers
 * @notice This library contains helper functions for GameSystem
 */
library GameHelpers {
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

  function executePlayer2Actions(bytes32 gameId, address player1Address) public {
    bytes32 globalPlayer1 = EntityHelpers.globalAddressToKey(player1Address);
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
          CurrentGame.get(globalPlayer1),
          action.projectile,
          action.newX,
          action.newY
        );

        (bool success, ) = worldAddress.call(data);
        require(success, "installTower call failed");
      } else if (action.actionType == ActionType.Move) {
        bytes memory data = abi.encodeWithSignature(
          "app__moveTower(bytes32,bytes32,int16,int16)",
          CurrentGame.get(globalPlayer1),
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

  function endGame(bytes32 gameId, address winner) public {
    Game.setEndTimestamp(gameId, block.timestamp);
    Game.setWinner(gameId, winner);

    GameData memory game = Game.get(gameId);
    bytes32 globalWinnerId = EntityHelpers.globalAddressToKey(winner);

    uint256 winStreak = WinStreak.get(globalWinnerId) + 1;
    WinStreak.set(globalWinnerId, winStreak);

    address loserAddress = game.player1Address == winner ? game.player2Address : game.player1Address;

    if (loserAddress == game.player1Address) {
      bytes32 globalLoserId = EntityHelpers.globalAddressToKey(loserAddress);
      WinStreak.set(globalLoserId, 0);
    }

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
