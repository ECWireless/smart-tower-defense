// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Game, GameData, RecentGame } from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";

contract GameSystem is System {
  function createGame(address player2Address) external returns (bytes32) {
    address player1Address = _msgSender();
    bytes32 player1 = addressToEntityKey(player1Address);

    bytes32 recentGameId = RecentGame.get(player1);

    if (recentGameId != 0) {
      GameData memory recentGame = Game.get(recentGameId);
      require(recentGame.endTimestamp != 0, "GameSystem: player1 has an ongoing game");
    }

    uint256 timestamp = block.timestamp;

    bytes32 gameId = keccak256(abi.encodePacked(player1Address, player2Address, timestamp));
    Game.set(gameId, GameData({ endTimestamp: 0, player1: player1Address, player2: player2Address, startTimestamp: timestamp }));
    RecentGame.set(player1, gameId);

    return gameId;
  }
}
