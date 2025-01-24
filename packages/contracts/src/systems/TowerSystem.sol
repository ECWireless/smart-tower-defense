// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { Action, ActionData, AddressBook, CurrentGame, DefaultLogic, EntityAtPosition, Game, GameData, Health, MapConfig, Owner, OwnerTowers, Position, Projectile, SavedGame, SavedGameData, Tower } from "../codegen/index.sol";
import { ActionType } from "../codegen/common.sol";
import { DEFAULT_LOGIC_SIZE_LIMIT, MAX_TOWER_HEALTH } from "../../constants.sol";
import { ProjectileHelpers } from "../Libraries/ProjectileHelpers.sol";
import { EntityHelpers } from "../Libraries/EntityHelpers.sol";
import { TowerHelpers } from "../Libraries/TowerHelpers.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// TOWER ID
// bytes32 towerId = keccak256(abi.encodePacked(currentGameId, playerAddress, timestamp));

contract TowerSystem is System {
  function getTowerSystemAddress() external view returns (address) {
    return address(this);
  }

  function installTower(bytes32 potentialGameId, bool projectile, int16 x, int16 y) external returns (bytes32) {
    address playerAddress = _msgSender();

    (int16 actualX, int16 actualY) = ProjectileHelpers.getActualCoordinates(x, y);
    _validateInstallTower(potentialGameId, playerAddress, actualX, actualY);

    uint256 timestamp = block.timestamp;
    address actualPlayerAddress = Game.get(potentialGameId).turn;
    bytes32 towerId = keccak256(abi.encodePacked(potentialGameId, actualPlayerAddress, timestamp));
    _initializeTower(towerId, potentialGameId, actualPlayerAddress, actualX, actualY, projectile);
    TowerHelpers.storeInstallTowerAction(potentialGameId, playerAddress, actualX, actualY, projectile);

    return towerId;
  }

  function moveTower(bytes32 potentialGameId, bytes32 towerId, int16 x, int16 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    _validateMoveTower(potentialGameId, playerAddress, towerId, x, y);

    (int16 oldX, int16 oldY) = Position.get(towerId);

    (int16 actualX, int16 actualY) = ProjectileHelpers.getActualCoordinates(x, y);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(potentialGameId, oldX, oldY), 0);

    Position.set(towerId, actualX, actualY);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(potentialGameId, actualX, actualY), towerId);

    _decrementActionCount(potentialGameId);
    TowerHelpers.storeMoveTowerAction(potentialGameId, playerAddress, towerId, oldX, oldY, actualX, actualY);

    return towerId;
  }

  function modifyTowerSystem(
    bytes32 towerId,
    bytes memory bytecode,
    string memory sourceCode
  ) external returns (address projectileLogicAddress) {
    address playerAddress = _msgSender();
    bytes32 playerGameId = CurrentGame.get(EntityHelpers.addressToEntityKey(playerAddress));
    address gameSystemAddress = AddressBook.getGame();
    if (playerAddress == gameSystemAddress) {
      playerGameId = CurrentGame.get(towerId);
    }

    GameData memory currentGame = Game.get(playerGameId);

    _validModifySystem(playerGameId, gameSystemAddress, towerId, playerAddress);

    address newSystem;
    assembly {
      newSystem := create(0, add(bytecode, 0x20), mload(bytecode))
    }

    uint256 size;
    assembly {
      size := extcodesize(newSystem)
    }

    require(size > 0, "Contract creation failed");
    require(
      size <= DEFAULT_LOGIC_SIZE_LIMIT,
      string(abi.encodePacked("Contract cannot be larger than ", Strings.toString(DEFAULT_LOGIC_SIZE_LIMIT), " bytes"))
    );

    Game.setActionCount(playerGameId, currentGame.actionCount - 1);
    Projectile.set(towerId, address(newSystem), DEFAULT_LOGIC_SIZE_LIMIT, bytecode, sourceCode);

    TowerHelpers.storeModifyTowerAction(playerGameId, playerAddress, towerId, bytecode, newSystem, sourceCode);

    return address(newSystem);
  }

  function getContractSize(bytes memory bytecode) external returns (uint256 size) {
    address newSystem;
    assembly {
      newSystem := create(0, add(bytecode, 0x20), mload(bytecode))
    }

    assembly {
      size := extcodesize(newSystem)
    }
    return size;
  }

  function _validateInstallTower(bytes32 potentialGameId, address playerAddress, int16 x, int16 y) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 player = EntityHelpers.addressToEntityKey(playerAddress);
    bytes32 currentGameId = CurrentGame.get(player);

    if (playerAddress == gameSystemAddress) {
      currentGameId = potentialGameId;
    }

    require(currentGameId != 0, "TowerSystem: player has no ongoing game");
    require(currentGameId == potentialGameId, "TowerSystem: game does not match player's ongoing game");

    GameData memory currentGame = Game.get(currentGameId);
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");

    if (playerAddress == gameSystemAddress) {
      require(currentGame.turn == currentGame.player2Address, "TowerSystem: not player's turn");
    } else {
      require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");
    }

    (int16 height, int16 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    bytes32 positionEntity = EntityAtPosition.get(EntityHelpers.positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    if (playerAddress == gameSystemAddress) {
      require(x > width / 2, "TowerSystem: x position is in enemy territory");
    } else {
      require(x < width / 2, "TowerSystem: x position is in player territory");
    }
  }

  function _validateMoveTower(
    bytes32 potentialGameId,
    address playerAddress,
    bytes32 towerId,
    int16 x,
    int16 y
  ) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 player = EntityHelpers.addressToEntityKey(playerAddress);
    bytes32 currentGameId = CurrentGame.get(player);

    if (playerAddress == gameSystemAddress) {
      currentGameId = potentialGameId;
    }

    require(currentGameId != 0, "TowerSystem: player has no ongoing game");
    require(currentGameId == potentialGameId, "TowerSystem: game does not match player's ongoing game");

    GameData memory currentGame = Game.get(currentGameId);
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");

    if (playerAddress == gameSystemAddress) {
      require(currentGame.turn == currentGame.player2Address, "TowerSystem: not player's turn");
    } else {
      require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");
    }

    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(Tower.get(towerId), "TowerSystem: entity is not a tower");

    (int16 height, int16 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    if (playerAddress == gameSystemAddress) {
      require(Owner.get(towerId) == currentGame.player2Address, "TowerSystem: player does not own tower");
    } else {
      require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");
    }

    bytes32 positionEntity = EntityAtPosition.get(EntityHelpers.positionToEntityKey(currentGameId, x, y));
    require(positionEntity == 0, "TowerSystem: position is occupied");

    if (playerAddress == gameSystemAddress) {
      require(x > width / 2, "TowerSystem: x is in enemy territory");
    } else {
      require(x < width / 2, "TowerSystem: x is in player territory");
    }
  }

  function _initializeTower(
    bytes32 towerId,
    bytes32 gameId,
    address playerAddress,
    int16 x,
    int16 y,
    bool projectile
  ) internal {
    Tower.set(towerId, true);
    CurrentGame.set(towerId, gameId);
    Owner.set(towerId, playerAddress);

    bytes32 player = EntityHelpers.addressToEntityKey(playerAddress);
    _addTowerToPlayer(player, towerId);

    if (projectile) {
      Health.set(towerId, MAX_TOWER_HEALTH, MAX_TOWER_HEALTH);
    } else {
      Health.set(towerId, MAX_TOWER_HEALTH * 2, MAX_TOWER_HEALTH * 2);
    }
    Position.set(towerId, x, y);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(gameId, x, y), towerId);

    address defaultProjectileLogicLeftAddress = DefaultLogic.get();
    Projectile.setLogicAddress(towerId, defaultProjectileLogicLeftAddress);
    Projectile.setSourceCode(
      towerId,
      "contract DefaultProjectileLogic { function getNextProjectilePosition(int16 x, int16 y) public pure returns (int16, int16) { return (x + 5, y); }}"
    );

    Projectile.setSizeLimit(towerId, DEFAULT_LOGIC_SIZE_LIMIT);
    _decrementActionCount(gameId);
  }

  function _addTowerToPlayer(bytes32 player, bytes32 towerId) internal {
    bytes32[] memory playerTowers = OwnerTowers.get(player);
    bytes32[] memory updatedTowers = new bytes32[](playerTowers.length + 1);

    for (uint256 i = 0; i < playerTowers.length; i++) {
      updatedTowers[i] = playerTowers[i];
    }

    updatedTowers[playerTowers.length] = towerId;
    OwnerTowers.set(player, updatedTowers);
  }

  function _decrementActionCount(bytes32 gameId) internal {
    Game.setActionCount(gameId, Game.getActionCount(gameId) - 1);
  }

  function _validModifySystem(
    bytes32 gameId,
    address gameSystemAddress,
    bytes32 towerId,
    address playerAddress
  ) internal {
    bytes32 towerGameId = CurrentGame.get(towerId);
    GameData memory currentGame = Game.get(gameId);

    require(gameId != 0, "TowerSystem: player has no ongoing game");
    require(gameId == towerGameId, "TowerSystem: game does not match player's ongoing game");

    if (playerAddress == gameSystemAddress) {
      require(Owner.get(towerId) == currentGame.player2Address, "TowerSystem: player does not own tower");
    } else {
      require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");
    }

    if (playerAddress == gameSystemAddress) {
      require(currentGame.turn == currentGame.player2Address, "TowerSystem: not player's turn");
    } else {
      require(currentGame.turn == playerAddress, "TowerSystem: not player's turn");
    }

    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(Tower.get(towerId), "TowerSystem: entity is not a tower");
    require(Health.getCurrentHealth(towerId) > 0, "TowerSystem: tower is destroyed");

    (int16 oldX, int16 oldY) = Position.get(towerId);

    bytes memory data = abi.encodeWithSignature("getNextProjectilePosition(int16,int16)", oldX, oldY);
    address projectileAddress = Projectile.getLogicAddress(towerId);
    (bool success, bytes memory returndata) = projectileAddress.call(data);
    require(success, "getNextProjectilePosition call failed");
    (oldX, oldY) = abi.decode(returndata, (int16, int16));

    (success, returndata) = projectileAddress.call(data);
    require(success, "getNextProjectilePosition call failed");
    (int16 newX, int16 newY) = abi.decode(returndata, (int16, int16));

    uint16 distance = ProjectileHelpers.chebyshevDistance(
      uint256(int256(oldX)),
      uint256(int256(oldY)),
      uint256(int256(newX)),
      uint256(int256(newY))
    );
    require(distance <= 1, "TowerSystem: projectile speed exceeds rules");
  }
}
