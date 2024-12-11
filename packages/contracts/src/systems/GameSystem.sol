// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Game } from "../codegen/index.sol";

contract GameSystem is System {
  function createGame(address player2) external returns (bytes32) {
    address player1 = _msgSender();
    uint256 timestamp = block.timestamp;

    bytes32 gameId = keccak256(abi.encodePacked(player1, player2, timestamp));
    Game.set(gameId, 0, player1, player2, timestamp);

    return gameId;
  }
}
