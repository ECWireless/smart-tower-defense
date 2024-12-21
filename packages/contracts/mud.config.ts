import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "app",
  enums: {
    ActionType: ["Install", "Move", "Modify"],
  },
  tables: {
    AddressBook: {
      schema: {
        game: "address",
        tower: "address",
        world: "address",
      },
      key: [],
    },
    Action: {
      schema: {
        id: "bytes32",
        actionType: "ActionType",
        newX: "int8",
        newY: "int8",
        oldX: "int8",
        oldY: "int8",
        projectile: "bool",
      },
      key: ["id"],
    },
    Castle: "bool",
    Counter: {
      schema: {
        value: "uint32",
      },
      key: [],
    },
    CurrentGame: "bytes32", // Game.id || towerId
    DefaultLogicA: {
      // DefaultProjectileLogicLeft address
      schema: {
        value: "address",
      },
      key: [],
      codegen: {
        dataStruct: false,
      },
    },
    DefaultLogicB: {
      // DefaultProjectileLogicRight address
      schema: {
        vlue: "address",
      },
      key: [],
      codegen: {
        dataStruct: false,
      },
    },
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
    SavedGame: "bytes32[]",
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
    Projectile: {
      schema: {
        id: "bytes32", // ID is the tower ID,
        logicAddress: "address",
        sourceCode: "string",
      },
      key: ["id"],
    },
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
    Username: "string",
    UsernameTaken: {
      schema: {
        usernameBytes: "bytes32",
        value: "bool",
      },
      key: ["usernameBytes"],
    },
  },
});
