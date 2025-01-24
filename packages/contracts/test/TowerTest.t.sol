// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { getKeysWithValue } from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";

import { IWorld } from "../src/codegen/world/IWorld.sol";
import { Counter } from "../src/codegen/index.sol";
import { CurrentGame, EntityAtPosition, Health, Position, Projectile, Tower, Username, UsernameTaken } from "../src/codegen/index.sol";
import { EntityHelpers } from "../src/Libraries/EntityHelpers.sol";

contract TowerTest is MudTest {
  address alice = vm.addr(1);
  address bob = vm.addr(2);
  address rob = address(0);

  bytes32 robId = EntityHelpers.addressToEntityKey(rob);
  bytes32 defaultSavedGameId = keccak256(abi.encodePacked(bytes32(0), robId));
  bytes constant BYTECODE =
    hex"6080604052348015600e575f5ffd5b506102488061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c8063cae93eb91461002d575b5f5ffd5b610047600480360381019061004291906100bf565b61005e565b60405161005592919061010c565b60405180910390f35b5f5f60018461006d9190610160565b60018461007a91906101b9565b915091509250929050565b5f5ffd5b5f8160010b9050919050565b61009e81610089565b81146100a8575f5ffd5b50565b5f813590506100b981610095565b92915050565b5f5f604083850312156100d5576100d4610085565b5b5f6100e2858286016100ab565b92505060206100f3858286016100ab565b9150509250929050565b61010681610089565b82525050565b5f60408201905061011f5f8301856100fd565b61012c60208301846100fd565b9392505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61016a82610089565b915061017583610089565b925082820190507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff80008112617fff821317156101b3576101b2610133565b5b92915050565b5f6101c382610089565b91506101ce83610089565b92508282039050617fff81137fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff80008212171561020c5761020b610133565b5b9291505056fea2646970667358221220ce99c3e5e762de0a056f89a7edc1f3fd0b073a97bb3c924e932a6f0a45c842cd64736f6c634300081c0033";

  function testInstallTower() public {
    vm.prank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");

    vm.prank(alice);
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 35, 35);

    (int16 x, int16 y) = Position.get(towerId);
    assertEq(x, 35);
    assertEq(y, 35);

    bytes32 entityKey = EntityHelpers.positionToEntityKey(gameId, x, y);
    bytes32 entity = EntityAtPosition.get(entityKey);
    assertEq(entity, towerId);

    bool isTower = Tower.get(towerId);
    assertTrue(isTower);

    address projectileLogicAddress = Projectile.getLogicAddress(towerId);
    assertTrue(projectileLogicAddress != address(0));
  }

  function testInstallWallTower() public {
    vm.prank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");

    vm.prank(alice);
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, false, 35, 35);

    address projectileLogicAddress = Projectile.getLogicAddress(towerId);
    assertFalse(projectileLogicAddress != address(0));
  }

  function testRevertInstallNoGame() public {
    vm.expectRevert(bytes("TowerSystem: player has no ongoing game"));
    vm.prank(alice);
    IWorld(worldAddress).app__installTower(0, true, 35, 35);
  }

  function testRevertInstallPositionIsOccupied() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    IWorld(worldAddress).app__installTower(gameId, true, 35, 35);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    vm.expectRevert(bytes("TowerSystem: position is occupied"));
    IWorld(worldAddress).app__installTower(gameId, true, 35, 35);
    vm.stopPrank();
  }

  function testRevertInstallNotPlayerGame() public {
    vm.startPrank(alice);
    bytes32 aliceGameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    IWorld(worldAddress).app__installTower(aliceGameId, true, 35, 35);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    vm.stopPrank();

    vm.startPrank(bob);
    IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Bob");
    vm.expectRevert(bytes("TowerSystem: game does not match player's ongoing game"));
    IWorld(worldAddress).app__installTower(aliceGameId, true, 35, 35);
  }

  function testMoveTower() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 35, 35);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__moveTower(gameId, towerId, 45, 45);

    (int16 x, int16 y) = Position.get(towerId);
    assertEq(x, 45);
    assertEq(y, 45);

    bytes32 entityKey = EntityHelpers.positionToEntityKey(gameId, x, y);
    bytes32 entity = EntityAtPosition.get(entityKey);
    assertEq(entity, towerId);
  }

  function testRevertMoveNoTower() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    IWorld(worldAddress).app__installTower(gameId, true, 35, 35);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    bytes32 fakeTowerId = keccak256(abi.encodePacked("fake"));
    vm.expectRevert(bytes("TowerSystem: entity is not a tower"));
    IWorld(worldAddress).app__moveTower(gameId, fakeTowerId, 45, 45);
    vm.stopPrank();
  }

  function testRevertMoveNoGame() public {
    vm.expectRevert(bytes("TowerSystem: player has no ongoing game"));
    vm.prank(alice);
    IWorld(worldAddress).app__moveTower(0, 0, 45, 45);
  }

  function testRevertMovePositionIsOccupied() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 35, 35);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__installTower(gameId, true, 45, 45);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    vm.expectRevert(bytes("TowerSystem: position is occupied"));
    IWorld(worldAddress).app__moveTower(gameId, towerId, 45, 45);
  }

  function testRevertMoveNotPlayerGame() public {
    vm.startPrank(alice);
    bytes32 aliceGameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(aliceGameId, true, 35, 35);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    vm.stopPrank();

    vm.startPrank(bob);
    IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Bob");
    vm.expectRevert(bytes("TowerSystem: game does not match player's ongoing game"));
    IWorld(worldAddress).app__moveTower(aliceGameId, towerId, 45, 45);
  }

  function testModifyTowerSystem() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 65, 65);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__modifyTowerSystem(towerId, BYTECODE, "");
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();

    bytes32 positionEntity = EntityHelpers.positionToEntityKey(gameId, 95, 35);
    bytes32 enemyTowerId = EntityAtPosition.get(positionEntity);
    uint8 enemyTowerHealth = Health.getCurrentHealth(enemyTowerId);
    assertEq(enemyTowerHealth, 1);
  }

  function testRevertModifyNoTower() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");

    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    bytes32 positionEntity = EntityHelpers.positionToEntityKey(gameId, 0, 35);
    bytes32 castleId = EntityAtPosition.get(positionEntity);

    vm.expectRevert(bytes("TowerSystem: entity is not a tower"));
    IWorld(worldAddress).app__modifyTowerSystem(castleId, BYTECODE, "");
    vm.stopPrank();
  }

  function testRevertModifyNoGame() public {
    vm.expectRevert(bytes("TowerSystem: player has no ongoing game"));
    vm.prank(alice);
    IWorld(worldAddress).app__modifyTowerSystem(0, BYTECODE, "");
  }

  function testRevertModifyNotPlayerGame() public {
    vm.startPrank(alice);
    bytes32 aliceGameId = IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(aliceGameId, true, 65, 65);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    vm.stopPrank();

    vm.startPrank(bob);
    IWorld(worldAddress).app__createGame(defaultSavedGameId, rob, "Bob");
    vm.expectRevert(bytes("TowerSystem: game does not match player's ongoing game"));
    IWorld(worldAddress).app__modifyTowerSystem(towerId, BYTECODE, "");
  }
}
