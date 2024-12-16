// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { Action, ActionData, AddressBook, LogicSystemAddress, MapConfig, SavedGame, Username, UsernameTaken } from "../src/codegen/index.sol";
import { ActionType } from "../src/codegen/common.sol";
import { addressToEntityKey } from "../src/addressToEntityKey.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";

contract PostDeploy is Script {
  function run(address worldAddress) external {
    // Specify a store so that you can use tables directly in PostDeploy
    StoreSwitch.setStoreAddress(worldAddress);

    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    // Start broadcasting transactions from the deployer account
    vm.startBroadcast(deployerPrivateKey);

    address logicSystemAddress = IWorld(worldAddress).app__getLogicSystemAddress();
    LogicSystemAddress.set(logicSystemAddress);
    console.log("Logic System Address:", logicSystemAddress);

    IWorld(worldAddress).app__runStateChange();

    address gameSystemAddress = IWorld(worldAddress).app__getGameSystemAddress();
    address towerSystemAddress = IWorld(worldAddress).app__getTowerSystemAddress();
    AddressBook.setGame(gameSystemAddress);
    AddressBook.setTower(towerSystemAddress);
    AddressBook.setWorld(worldAddress);
    MapConfig.set(7, 14);

    ActionData[] memory actions = new ActionData[](3);
    actions[0] = ActionData({ actionType: ActionType.Install, newX: 11, newY: 3, oldX: 0, oldY: 0, projectile: false });
    actions[1] = ActionData({ actionType: ActionType.Move, newX: 9, newY: 3, oldX: 11, oldY: 3, projectile: false });
    actions[2] = ActionData({ actionType: ActionType.Install, oldX: 0, oldY: 0, newX: 8, newY: 2, projectile: true });

    bytes32[] memory defaultActionIds = new bytes32[](3);
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
    SavedGame.set(playerId, defaultActionIds);
    Username.set(playerId, "ROB");
    bytes32 usernameKey = keccak256(abi.encodePacked("ROB"));
    UsernameTaken.set(usernameKey, true);

    vm.stopBroadcast();
  }
}
