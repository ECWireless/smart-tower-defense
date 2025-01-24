import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "app",
  enums: {
    ActionType: ["Install", "Move", "Modify"],
  },
  tables: {
    Action: {
      schema: {
        id: "bytes32",
        actionType: "ActionType",
        newX: "int16",
        newY: "int16",
        oldX: "int16",
        oldY: "int16",
        projectile: "bool",
      },
      key: ["id"],
    },
    AddressBook: {
      schema: {
        game: "address",
        tower: "address",
        world: "address",
      },
      key: [],
    },
    Castle: "bool",
    Counter: {
      schema: {
        value: "uint32",
      },
      key: [],
    },
    CurrentGame: "bytes32", // Game.id || towerId
    DefaultLogic: {
      schema: {
        value: "address",
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
    GamesByLevel: {
      key: ["level"],
      schema: {
        level: "uint256",
        gameIds: "bytes32[]",
      },
    },
    SavedGame: {
      schema: {
        id: "bytes32", // keccak256(abi.encodePacked(gameId, playerId)) when the template is saved; gameId when the template is loaded for a game
        gameId: "bytes32",
        winner: "address",
        actions: "bytes32[]",
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
        height: "int16",
        width: "int16",
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
        x: "int16",
        y: "int16",
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
        sizeLimit: "uint256",
        bytecode: "bytes",
        sourceCode: "string",
      },
      key: ["id"],
    },
    ProjectileTrajectory: {
      schema: {
        id: "bytes32",
        x: "int16[]",
        y: "int16[]",
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
    WinStreak: "uint256",
  },
});
