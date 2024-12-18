// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { getKeysWithValue } from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";

import { IWorld } from "../src/codegen/world/IWorld.sol";
import { Counter } from "../src/codegen/index.sol";
import { CurrentGame, EntityAtPosition, Position, ProjectileLogic, Tower, Username, UsernameTaken } from "../src/codegen/index.sol";
import { addressToEntityKey } from "../src/addressToEntityKey.sol";
import { positionToEntityKey } from "../src/positionToEntityKey.sol";

contract TowerTest is MudTest {
  address alice = vm.addr(1);
  address bob = vm.addr(2);
  address rob = address(0);

  function testInstallTower() public {
    vm.prank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");

    vm.prank(alice);
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 3, 3);

    (int8 x, int8 y) = Position.get(towerId);
    assertEq(x, 3);
    assertEq(y, 3);

    bytes32 entityKey = positionToEntityKey(gameId, x, y);
    bytes32 entity = EntityAtPosition.get(entityKey);
    assertEq(entity, towerId);

    bool isTower = Tower.get(towerId);
    assertTrue(isTower);

    address projectileLogic = ProjectileLogic.get(towerId);
    assertTrue(projectileLogic != address(0));
  }

  function testInstallWallTower() public {
    vm.prank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");

    vm.prank(alice);
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, false, 3, 3);

    address projectileLogic = ProjectileLogic.get(towerId);
    assertFalse(projectileLogic != address(0));
  }

  function testRevertInstallNoGame() public {
    vm.expectRevert(bytes("TowerSystem: player has no ongoing game"));
    vm.prank(alice);
    IWorld(worldAddress).app__installTower(0, true, 3, 3);
  }

  function testRevertInstallPositionIsOccupied() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    IWorld(worldAddress).app__installTower(gameId, true, 3, 3);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    vm.expectRevert(bytes("TowerSystem: position is occupied"));
    IWorld(worldAddress).app__installTower(gameId, true, 3, 3);
    vm.stopPrank();
  }

  function testRevertInstallNotPlayerGame() public {
    vm.startPrank(alice);
    bytes32 aliceGameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    IWorld(worldAddress).app__installTower(aliceGameId, true, 3, 3);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    vm.stopPrank();

    vm.startPrank(bob);
    IWorld(worldAddress).app__createGame(rob, "Bob");
    vm.expectRevert(bytes("TowerSystem: game does not match player's ongoing game"));
    IWorld(worldAddress).app__installTower(aliceGameId, true, 3, 3);
  }

  function testMoveTower() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 3, 3);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__moveTower(gameId, towerId, 4, 4);

    (int8 x, int8 y) = Position.get(towerId);
    assertEq(x, 4);
    assertEq(y, 4);

    bytes32 entityKey = positionToEntityKey(gameId, x, y);
    bytes32 entity = EntityAtPosition.get(entityKey);
    assertEq(entity, towerId);
  }

  function testRevertMoveNoTower() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    IWorld(worldAddress).app__installTower(gameId, true, 3, 3);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    bytes32 fakeTowerId = keccak256(abi.encodePacked("fake"));
    vm.expectRevert(bytes("TowerSystem: entity is not a tower"));
    IWorld(worldAddress).app__moveTower(gameId, fakeTowerId, 4, 4);
    vm.stopPrank();
  }

  function testRevertMoveNoGame() public {
    vm.expectRevert(bytes("TowerSystem: player has no ongoing game"));
    vm.prank(alice);
    IWorld(worldAddress).app__moveTower(0, 0, 4, 4);
  }

  function testRevertMovePositionIsOccupied() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 3, 3);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__installTower(gameId, true, 4, 4);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    vm.expectRevert(bytes("TowerSystem: position is occupied"));
    IWorld(worldAddress).app__moveTower(gameId, towerId, 4, 4);
  }

  function testRevertMoveNotPlayerGame() public {
    vm.startPrank(alice);
    bytes32 aliceGameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(aliceGameId, true, 3, 3);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    vm.stopPrank();

    vm.startPrank(bob);
    IWorld(worldAddress).app__createGame(rob, "Bob");
    vm.expectRevert(bytes("TowerSystem: game does not match player's ongoing game"));
    IWorld(worldAddress).app__moveTower(aliceGameId, towerId, 4, 4);
  }
}
