// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { getKeysWithValue } from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";

import { IWorld } from "../src/codegen/world/IWorld.sol";
import { Counter } from "../src/codegen/index.sol";
import { CurrentGame, EntityAtPosition, Health, Position, Projectile, Tower, Username, UsernameTaken } from "../src/codegen/index.sol";
import { addressToEntityKey } from "../src/addressToEntityKey.sol";
import { positionToEntityKey } from "../src/positionToEntityKey.sol";

contract TowerTest is MudTest {
  address alice = vm.addr(1);
  address bob = vm.addr(2);
  address rob = address(0);
  bytes constant BYTECODE =
    hex"6080604052348015600e575f80fd5b506102458061001c5f395ff3fe608060405234801561000f575f80fd5b5060043610610029575f3560e01c806342d75a981461002d575b5f80fd5b610047600480360381019061004291906100be565b61005e565b60405161005592919061010b565b60405180910390f35b5f8060018461006d919061015f565b60018461007a91906101b7565b915091509250929050565b5f80fd5b5f815f0b9050919050565b61009d81610089565b81146100a7575f80fd5b50565b5f813590506100b881610094565b92915050565b5f80604083850312156100d4576100d3610085565b5b5f6100e1858286016100aa565b92505060206100f2858286016100aa565b9150509250929050565b61010581610089565b82525050565b5f60408201905061011e5f8301856100fc565b61012b60208301846100fc565b9392505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61016982610089565b915061017483610089565b925082820190507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff808112607f821317156101b1576101b0610132565b5b92915050565b5f6101c182610089565b91506101cc83610089565b92508282039050607f81137fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff808212171561020957610208610132565b5b9291505056fea26469706673582212209dcb7e2fada3005f4ba062f30de9e4e3055709517d528f05fb8b80fbf653e82564736f6c634300081a0033";

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

    address projectileLogicAddress = Projectile.getLogicAddress(towerId);
    assertTrue(projectileLogicAddress != address(0));
  }

  function testInstallWallTower() public {
    vm.prank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");

    vm.prank(alice);
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, false, 3, 3);

    address projectileLogicAddress = Projectile.getLogicAddress(towerId);
    assertFalse(projectileLogicAddress != address(0));
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

  function testModifyTowerSystem() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 6, 6);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__modifyTowerSystem(towerId, BYTECODE, "");
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();

    bytes32 positionEntity = positionToEntityKey(gameId, 9, 3);
    bytes32 enemyTowerId = EntityAtPosition.get(positionEntity);
    uint8 enemyTowerHealth = Health.getCurrentHealth(enemyTowerId);
    assertEq(enemyTowerHealth, 1);
  }

  function testRevertModifyNoTower() public {
    vm.startPrank(alice);
    bytes32 gameId = IWorld(worldAddress).app__createGame(rob, "Alice");

    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    bytes32 positionEntity = positionToEntityKey(gameId, 0, 3);
    bytes32 castleId = EntityAtPosition.get(positionEntity);
    console.logBytes32(castleId);
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
    bytes32 aliceGameId = IWorld(worldAddress).app__createGame(rob, "Alice");
    bytes32 towerId = IWorld(worldAddress).app__installTower(aliceGameId, true, 6, 6);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    IWorld(worldAddress).app__nextTurn(aliceGameId);
    vm.stopPrank();

    vm.startPrank(bob);
    IWorld(worldAddress).app__createGame(rob, "Bob");
    vm.expectRevert(bytes("TowerSystem: game does not match player's ongoing game"));
    IWorld(worldAddress).app__modifyTowerSystem(towerId, BYTECODE, "");
  }
}
