// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Castle, CurrentGame, EntityAtPosition, Game, GameData, Owner, Position } from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";
import { positionToEntityKey } from "../positionToEntityKey.sol";

contract GameSystem is System {
  function createGame(address player2Address) external returns (bytes32) {
    address player1Address = _msgSender();
    bytes32 player1 = addressToEntityKey(player1Address);

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
      player1: player1Address,
      player2: player2Address,
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

    Castle.set(castle1Id, true);
    Castle.set(castle2Id, true);

    Position.set(castle1Id, 0, 3);
    Position.set(castle2Id, 13, 3);

    EntityAtPosition.set(positionToEntityKey(0, 3), castle1Id);
    EntityAtPosition.set(positionToEntityKey(13, 3), castle2Id);

    return gameId;
  }

  function nextTurn(bytes32 gameId) external {
    GameData memory game = Game.get(gameId);
    require(game.endTimestamp == 0, "GameSystem: game has ended");

    address player1 = game.player1;
    address player2 = game.player2;

    address currentPlayer = game.turn;

    if (player2 != address(0)) {
      require(_msgSender() == currentPlayer, "GameSystem: it's not your turn");
    }

    GameData memory newGame = Game.get(gameId);

    if (newGame.turn == player1) {
      require(newGame.actionCount == 0, "GameSystem: player has actions remaining");
    } else {
      newGame.roundCount += 1;
    }

    newGame.turn = currentPlayer == player1 ? player2 : player1;
    newGame.actionCount = 1;
    Game.set(gameId, newGame);
  }
}
