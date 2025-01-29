// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { getKeysWithValue } from "@latticexyz/world-modules/src/modules/keyswithvalue/getKeysWithValue.sol";

import { IWorld } from "../src/codegen/world/IWorld.sol";
import { Counter } from "../src/codegen/index.sol";
import { CurrentGame, Game, GameData, Level, Username, UsernameTaken, WinStreak } from "../src/codegen/index.sol";
import { EntityHelpers } from "../src/Libraries/EntityHelpers.sol";

contract GameTest is MudTest {
  address aliceAddress = vm.addr(1);
  address bobAddress = vm.addr(2);
  address robAddress = address(0);

  bytes constant BYTECODE =
    hex"6080604052348015600e575f5ffd5b506101ef8061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c8063cae93eb91461002d575b5f5ffd5b610047600480360381019061004291906100bf565b61005e565b60405161005592919061010c565b60405180910390f35b5f5f60058461006d9190610160565b60028461007a9190610160565b915091509250929050565b5f5ffd5b5f8160010b9050919050565b61009e81610089565b81146100a8575f5ffd5b50565b5f813590506100b981610095565b92915050565b5f5f604083850312156100d5576100d4610085565b5b5f6100e2858286016100ab565b92505060206100f3858286016100ab565b9150509250929050565b61010681610089565b82525050565b5f60408201905061011f5f8301856100fd565b61012c60208301846100fd565b9392505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61016a82610089565b915061017583610089565b925082820190507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff80008112617fff821317156101b3576101b2610133565b5b9291505056fea2646970667358221220b6537f6bf1ca7ac4afafd7133c251d6b0b155b45a5576490f217e48fef76c3fe64736f6c634300081c0033";

  function endGame(address player, bytes32 gameId) public {
    vm.startPrank(player);
    IWorld(worldAddress).app__installTower(gameId, true, 35, 35);

    // Need to go through 8 turns to end the game
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();
  }

  function testCreateGame() public {
    vm.prank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);

    bytes32 aliceCurrentGame = CurrentGame.get(EntityHelpers.globalAddressToKey(aliceAddress));
    bytes32 robCurrentGame = CurrentGame.get(EntityHelpers.globalAddressToKey(robAddress));

    assertEq(aliceCurrentGame, gameId);
    assertEq(robCurrentGame, 0);
  }

  function testUsernameNotTaken() public {
    vm.prank(aliceAddress);
    IWorld(worldAddress).app__createGame("Alice", true);

    string memory username = Username.get(EntityHelpers.globalAddressToKey(aliceAddress));
    assertEq(username, "Alice");

    bytes32 usernameBytes = keccak256(abi.encodePacked(username));
    bool taken = UsernameTaken.get(usernameBytes);
    assertTrue(taken);
  }

  function testUsernameCannotChange() public {
    vm.prank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);
    endGame(aliceAddress, gameId);

    vm.prank(aliceAddress);
    IWorld(worldAddress).app__createGame("Bob", true);

    string memory username = Username.get(EntityHelpers.globalAddressToKey(aliceAddress));
    assertEq(username, "Alice");
  }

  function testRevertUsernameTaken() public {
    vm.prank(aliceAddress);
    IWorld(worldAddress).app__createGame("Alice", true);

    vm.expectRevert(bytes("GameSystem: username is taken"));
    vm.prank(bobAddress);
    IWorld(worldAddress).app__createGame("Alice", true);
  }

  function testRevertGameOngoing() public {
    vm.prank(aliceAddress);
    IWorld(worldAddress).app__createGame("Alice", true);

    vm.expectRevert(bytes("GameSystem: player1 has an ongoing game"));
    vm.prank(aliceAddress);
    IWorld(worldAddress).app__createGame("Alice", true);
  }

  function testNextTurn() public {
    vm.startPrank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);

    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();

    GameData memory game = Game.get(gameId);
    assertEq(game.actionCount, 1);
    assertEq(game.turn, robAddress);
    assertEq(game.roundCount, 1);
  }

  function testNextRound() public {
    vm.startPrank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);

    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();

    GameData memory game = Game.get(gameId);
    assertEq(game.actionCount, 1);
    assertEq(game.turn, aliceAddress);
    assertEq(game.roundCount, 2);
  }

  function testWinFirstGame() public {
    vm.prank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);
    endGame(aliceAddress, gameId);

    uint256 endTimestamp = Game.get(gameId).endTimestamp;
    assert(endTimestamp > 0);

    address winnerAddress = Game.get(gameId).winner;
    assertEq(winnerAddress, aliceAddress);
  }

  function testNextLevel() public {
    vm.prank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);
    endGame(aliceAddress, gameId);

    vm.prank(bobAddress);
    gameId = IWorld(worldAddress).app__createGame("Bob", true);
    endGame(bobAddress, gameId);
    
    vm.prank(aliceAddress);
    gameId = IWorld(worldAddress).app__createGame("Alice", false);

    uint256 winStreak = WinStreak.get(EntityHelpers.globalAddressToKey(aliceAddress));
    assertEq(winStreak, 1);

    uint256 level = Level.get(gameId);
    assertEq(level, 1);
  }

  function testWinSecondGame() public {
    vm.prank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);
    endGame(aliceAddress, gameId);

    vm.prank(bobAddress);
    gameId = IWorld(worldAddress).app__createGame("Bob", true);
    endGame(bobAddress, gameId);

    vm.startPrank(aliceAddress);
    gameId = IWorld(worldAddress).app__createGame("Alice", false);
    
    IWorld(worldAddress).app__installTower(gameId, false, 35, 35);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    bytes32 towerId = IWorld(worldAddress).app__installTower(gameId, true, 65, 5);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);

    IWorld(worldAddress).app__modifyTowerSystem(towerId, BYTECODE, "");
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();

    uint256 endTimestamp = Game.get(gameId).endTimestamp;
    assert(endTimestamp > 0);

    address winnerAddress = Game.get(gameId).winner;
    assertEq(winnerAddress, aliceAddress);

    uint256 winStreak = WinStreak.get(EntityHelpers.globalAddressToKey(aliceAddress));
    assertEq(winStreak, 2);
  }

  function testLoseSecondGame() public {
    vm.prank(aliceAddress);
    bytes32 gameId = IWorld(worldAddress).app__createGame("Alice", true);
    endGame(aliceAddress, gameId);

    vm.prank(bobAddress);
    gameId = IWorld(worldAddress).app__createGame("Bob", true);
    endGame(bobAddress, gameId);

    vm.startPrank(aliceAddress);
    gameId = IWorld(worldAddress).app__createGame("Alice", false);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    IWorld(worldAddress).app__nextTurn(gameId);
    vm.stopPrank();

    uint256 endTimestamp = Game.get(gameId).endTimestamp;
    assert(endTimestamp > 0);

    address winnerAddress = Game.get(gameId).winner;
    assertEq(winnerAddress, bobAddress);

    uint256 winStreak = WinStreak.get(EntityHelpers.globalAddressToKey(aliceAddress));
    assertEq(winStreak, 0);
  }
}
