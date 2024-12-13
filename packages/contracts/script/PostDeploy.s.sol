// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { LogicSystemAddress, MapConfig, SavedGame } from "../src/codegen/index.sol";
import { addressToEntityKey } from "../src/addressToEntityKey.sol";
import { ActionType, Action } from "../src/interfaces/Structs.sol";
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

    MapConfig.set(7, 14);

    Action[] memory actions = new Action[](2);
    actions[0] = Action({
      towerX: 0,
      towerY: 0,
      actionType: ActionType.Install,
      projectile: true,
      newTowerX: 11,
      newTowerY: 3
    });

    actions[1] = Action({
      towerX: 11,
      towerY: 3,
      actionType: ActionType.Move,
      projectile: true,
      newTowerX: 10,
      newTowerY: 3
    });

    bytes32[] memory defaultActions = new bytes32[](2);
    for (uint256 i = 0; i < actions.length; i++) {
      defaultActions[i] = keccak256(abi.encodePacked(
        actions[i].towerX,
        actions[i].towerY,
        actions[i].actionType,
        actions[i].projectile,
        actions[i].newTowerX,
        actions[i].newTowerY
      ));
    }

    bytes32 playerId = addressToEntityKey(address(0));
    SavedGame.set(playerId, defaultActions);

    vm.stopBroadcast();
  }
}
