import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "app",
  tables: {
    Counter: {
      schema: {
        value: "uint32",
      },
      key: [],
    },
    Game: {
      schema: {
        id: "bytes32",
        endTimestamp: "uint256",
        player1: "address",
        player2: "address",
        startTimestamp: "uint256",
      },
      key: ["id"],
    },
    LogicSystemAddress: {
      schema: {
        value: "address",
      },
      key: [],
    },
    RecentGame: "bytes32", // Game.id
  },
});
