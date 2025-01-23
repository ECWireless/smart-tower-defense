// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { Action, ActionData, AddressBook, DefaultLogicA, DefaultLogicB, LogicSystemAddress, MapConfig, SavedGame, Username, UsernameTaken } from "../src/codegen/index.sol";
import { ActionType } from "../src/codegen/common.sol";
import { addressToEntityKey } from "../src/addressToEntityKey.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";

import "../src/defaultLogicContracts/DefaultProjectileLogicLeft.sol";
import "../src/defaultLogicContracts/DefaultProjectileLogicRight.sol";

contract PostDeploy is Script {
  function run(address worldAddress) external {
    // Specify a store so that you can use tables directly in PostDeploy
    StoreSwitch.setStoreAddress(worldAddress);

    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    // Start broadcasting transactions from the deployer account
    vm.startBroadcast(deployerPrivateKey);

    address gameSystemAddress = IWorld(worldAddress).app__getGameSystemAddress();
    address towerSystemAddress = IWorld(worldAddress).app__getTowerSystemAddress();
    AddressBook.setGame(gameSystemAddress);
    AddressBook.setTower(towerSystemAddress);
    AddressBook.setWorld(worldAddress);
    MapConfig.set(70, 140);

    // Set logic defaults
    address defaultProjectileLogicLeftAddress = address(new DefaultProjectileLogicLeft());
    DefaultLogicA.set(defaultProjectileLogicLeftAddress);
    address defaultProjectileLogicRightAddress = address(new DefaultProjectileLogicRight());
    DefaultLogicB.set(defaultProjectileLogicRightAddress);

    ActionData[] memory actions = new ActionData[](1);
    actions[0] = ActionData({
      actionType: ActionType.Install,
      newX: 115,
      newY: 35,
      oldX: 0,
      oldY: 0,
      projectile: true
    });

    bytes32[] memory defaultActionIds = new bytes32[](1);
    for (uint256 i = 0; i < actions.length; i++) {
      defaultActionIds[i] = keccak256(
        abi.encodePacked(
          actions[i].actionType,
          actions[i].newX,
          actions[i].newY,
          actions[i].oldX,
          actions[i].oldY,
          actions[i].projectile
        )
      );
      Action.set(defaultActionIds[i], actions[i]);
    }

    bytes32 playerId = addressToEntityKey(address(0));

    bytes32 savedGameId = keccak256(abi.encodePacked(bytes32(0), playerId));
    SavedGame.set(savedGameId, defaultActionIds);

    Username.set(playerId, "ROB");
    bytes32 usernameKey = keccak256(abi.encodePacked("ROB"));
    UsernameTaken.set(usernameKey, true);

    vm.stopBroadcast();
  }
}
