import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "app",
  tables: {
    Castle: "bool",
    Counter: {
      schema: {
        value: "uint32",
      },
      key: [],
    },
    CurrentGame: "bytes32", // Game.id || towerId
    EntityAtPosition: "bytes32",
    Game: {
      schema: {
        id: "bytes32", // keccak256(abi.encodePacked(player1Address, player2Address, timestamp));
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
    MapConfig: {
      schema: {
        height: "int8",
        width: "int8",
      },
      key: [],
      codegen: {
        dataStruct: false,
      },
    },
    Owner: "address",
    Position: {
      schema: {
        id: "bytes32",
        x: "int8",
        y: "int8",
      },
      key: ["id"],
      codegen: {
        dataStruct: false,
      },
    },
    Projectile: "bool",
    Tower: "bool",
  },
});
