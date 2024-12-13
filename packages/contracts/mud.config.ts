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
        actionCount: "uint8",
        endTimestamp: "uint256",
        player1Address: "address",
        player2Address: "address",
        roundCount: "uint8",
        startTimestamp: "uint256",
        turn: "address",
        winner: "address",
      },
      key: ["id"],
    },
    Health: {
      schema: {
        id: "bytes32",
        currentHealth: "uint8",
        maxHealth: "uint8",
      },
      key: ["id"],
      codegen: {
        dataStruct: false,
      },
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
    OwnerTowers: "bytes32[]",
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
    ProjectileTrajectory: {
      schema: {
        id: "bytes32",
        x: "int8[]",
        y: "int8[]",
      },
      key: ["id"],
      codegen: {
        dataStruct: false,
      },
    },
    Tower: "bool",
  },
});
