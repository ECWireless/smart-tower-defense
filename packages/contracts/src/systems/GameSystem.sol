// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Castle, CurrentGame, EntityAtPosition, Game, GamesByLevel, GameData, Health, Level, MapConfig, Owner, OwnerTowers, Position, SavedGame, SavedGameData, Username, WinStreak } from "../codegen/index.sol";
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

  function createGame(string memory username, bool resetLevel) public returns (bytes32) {
    address player1Address = _msgSender();
    bytes32 globalPlayer1 = EntityHelpers.globalAddressToKey(player1Address);

    bytes32 savedGameId;

    if (resetLevel) {
      WinStreak.set(globalPlayer1, 0);
    } else {
      savedGameId = GameHelpers.nextLevel(player1Address);
    }

    GameHelpers.validateCreateGame(globalPlayer1, username);

    SavedGameData memory savedGame = SavedGame.get(savedGameId);
    return _initializeGame(player1Address, savedGame.winner, savedGameId, globalPlayer1);
  }

  function _initializeGame(
    address player1Address,
    address player2Address,
    bytes32 savedGameId,
    bytes32 globalPlayer1
  ) internal returns (bytes32) {
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

  function nextTurn(bytes32 gameId) external {
    GameData memory game = Game.get(gameId);
    require(game.endTimestamp == 0, "GameSystem: game has ended");

    address player1Address = game.player1Address;
    address player2Address = game.player2Address;

    address currentPlayerAddress = game.turn;

    if (game.turn == player1Address) {
      // TODO: Maybe bring back this restriction
      // require(newGame.actionCount == 0, "GameSystem: player has actions remaining");

      bytes32 localPlayer1 = EntityHelpers.localAddressToKey(gameId, player1Address);
      bytes32 localPlayer2 = EntityHelpers.localAddressToKey(gameId, player2Address);

      bytes32[] memory allTowers = ProjectileHelpers.getAllTowers(localPlayer1, localPlayer2);
      ProjectileHelpers.clearAllProjectiles(allTowers);
    } else {
      Game.setRoundCount(gameId, game.roundCount + 1);
      ProjectileHelpers.executeRoundResults(gameId);
    }

    Game.setTurn(gameId, currentPlayerAddress == player1Address ? player2Address : player1Address);
    Game.setActionCount(gameId, 1);

    if (Game.getTurn(gameId) == player2Address) {
      GameHelpers.executePlayer2Actions(gameId, player1Address);
    }
  }
}
