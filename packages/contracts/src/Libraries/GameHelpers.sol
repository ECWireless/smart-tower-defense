import { Game, GamesByLevel, GameData, WinStreak } from "../codegen/index.sol";
import { EntityHelpers } from "./EntityHelpers.sol";

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

/**
 * @title GameHelpers
 * @notice This library contains helper functions for GameSystem
 */
library GameHelpers {
  function endGame(bytes32 gameId, address winner) public {
    Game.setEndTimestamp(gameId, block.timestamp);
    Game.setWinner(gameId, winner);

    bytes32 winnerId = EntityHelpers.addressToEntityKey(winner);
    uint256 winStreak = WinStreak.get(winnerId) + 1;
    WinStreak.set(winnerId, winStreak);

    GameData memory game = Game.get(gameId);
    address loserAddress = game.player1Address == winner ? game.player2Address : game.player1Address;

    if (loserAddress == game.player1Address) {
      bytes32 loserId = EntityHelpers.addressToEntityKey(loserAddress);
      WinStreak.set(loserId, 0);
    }

    bytes32 savedGameId = keccak256(abi.encodePacked(gameId, winnerId));
    bytes32[] memory gamesByLevel = GamesByLevel.get(winStreak);

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
