// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { AddressBook, CurrentGame, DefaultLogicA, DefaultLogicB, EntityAtPosition, Game, GameData, Health, MapConfig, Owner, OwnerTowers, Position, Projectile, Tower } from "../codegen/index.sol";
import { addressToEntityKey } from "../addressToEntityKey.sol";
import { positionToEntityKey } from "../positionToEntityKey.sol";
import { DEFAULT_LOGIC_SIZE_LIMIT, MAX_TOWER_HEALTH } from "../../constants.sol";
import { ProjectileHelpers } from "../Libraries/ProjectileHelpers.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// TOWER ID
// bytes32 towerId = keccak256(abi.encodePacked(currentGameId, playerAddress, timestamp));

contract TowerSystem is System {
  function getTowerSystemAddress() external view returns (address) {
    return address(this);
  }

  function installTower(bytes32 potentialGameId, bool projectile, int8 x, int8 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    _validateInstallTower(potentialGameId, playerAddress, x, y);

    uint256 timestamp = block.timestamp;
    address actualPlayerAddress = Game.get(potentialGameId).turn;
    bytes32 towerId = keccak256(abi.encodePacked(potentialGameId, actualPlayerAddress, timestamp));
    _initializeTower(towerId, potentialGameId, actualPlayerAddress, x, y, projectile);

    return towerId;
  }

  function moveTower(bytes32 potentialGameId, bytes32 towerId, int8 x, int8 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    _validateMoveTower(potentialGameId, playerAddress, towerId, x, y);

    (int8 oldX, int8 oldY) = Position.get(towerId);
    EntityAtPosition.set(positionToEntityKey(potentialGameId, oldX, oldY), 0);

    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(potentialGameId, x, y), towerId);

    _decrementActionCount(potentialGameId);

    return towerId;
  }

  function modifyTowerSystem(
    bytes32 towerId,
    bytes memory bytecode,
    string memory sourceCode
  ) external returns (address projectileLogicAddress) {
    address player = _msgSender();
    bytes32 playerGameId = CurrentGame.get(addressToEntityKey(player));
    GameData memory currentGame = Game.get(playerGameId);

    _validModifySystem(towerId, player);

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
    Projectile.set(towerId, address(newSystem), DEFAULT_LOGIC_SIZE_LIMIT, sourceCode);
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

  function _validateInstallTower(bytes32 potentialGameId, address playerAddress, int8 x, int8 y) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 player = addressToEntityKey(playerAddress);
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

    (int8 height, int8 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(currentGameId, x, y));
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
    int8 x,
    int8 y
  ) internal view {
    address gameSystemAddress = AddressBook.getGame();
    bytes32 player = addressToEntityKey(playerAddress);
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

    (int8 height, int8 width) = MapConfig.get();
    require(x >= 0 && x < width, "TowerSystem: x is out of bounds");
    require(y >= 0 && y < height, "TowerSystem: y is out of bounds");

    if (playerAddress == gameSystemAddress) {
      require(Owner.get(towerId) == currentGame.player2Address, "TowerSystem: player does not own tower");
    } else {
      require(Owner.get(towerId) == playerAddress, "TowerSystem: player does not own tower");
    }

    bytes32 positionEntity = EntityAtPosition.get(positionToEntityKey(currentGameId, x, y));
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
    int8 x,
    int8 y,
    bool projectile
  ) internal {
    Tower.set(towerId, true);
    CurrentGame.set(towerId, gameId);
    Owner.set(towerId, playerAddress);

    bytes32 player = addressToEntityKey(playerAddress);
    _addTowerToPlayer(player, towerId);

    Health.set(towerId, MAX_TOWER_HEALTH, MAX_TOWER_HEALTH);
    Position.set(towerId, x, y);
    EntityAtPosition.set(positionToEntityKey(gameId, x, y), towerId);

    (, int8 width) = MapConfig.get();
    if (projectile && x < width / 2) {
      address defaultProjectileLogicLeftAddress = DefaultLogicA.get();
      Projectile.setLogicAddress(towerId, defaultProjectileLogicLeftAddress);
      Projectile.setSourceCode(
        towerId,
        "contract DefaultProjectileLogic { function getNextProjectilePosition(int8 x, int8 y) public pure returns (int8, int8) { return (x + 1, y); }}"
      );
    }

    if (projectile && x > width / 2) {
      address defaultProjectileLogicRightAddress = DefaultLogicB.get();
      Projectile.setLogicAddress(towerId, defaultProjectileLogicRightAddress);
      Projectile.setSourceCode(
        towerId,
        "contract DefaultProjectileLogic { function getNextProjectilePosition(int8 x, int8 y) public pure returns (int8, int8) { return (x - 1, y); }}"
      );
    }

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

  function _validModifySystem(bytes32 towerId, address player) internal {
    bytes32 playerGameId = CurrentGame.get(addressToEntityKey(player));
    bytes32 towerGameId = CurrentGame.get(towerId);
    GameData memory currentGame = Game.get(playerGameId);

    require(playerGameId != 0, "TowerSystem: player has no ongoing game");
    require(playerGameId == towerGameId, "TowerSystem: game does not match player's ongoing game");
    require(Owner.get(towerId) == player, "TowerSystem: not tower owner");
    require(currentGame.endTimestamp == 0, "TowerSystem: game has ended");
    require(currentGame.actionCount > 0, "TowerSystem: player has no actions remaining");
    require(currentGame.turn == player, "TowerSystem: not player's turn");
    require(Tower.get(towerId), "TowerSystem: entity is not a tower");
    require(Health.getCurrentHealth(towerId) > 0, "TowerSystem: tower is destroyed");

    (int8 oldX, int8 oldY) = Position.get(towerId);

    bytes memory data = abi.encodeWithSignature("getNextProjectilePosition(int8,int8)", oldX, oldY);
    address projectileAddress = Projectile.getLogicAddress(towerId);
    (bool success, bytes memory returndata) = projectileAddress.call(data);
    require(success, "getNextProjectilePosition call failed");
    (oldX, oldY) = abi.decode(returndata, (int8, int8));

    (success, returndata) = projectileAddress.call(data);
    require(success, "getNextProjectilePosition call failed");
    (int8 newX, int8 newY) = abi.decode(returndata, (int8, int8));

    uint16 distance = ProjectileHelpers.chebyshevDistance(
      uint256(int256(oldX)),
      uint256(int256(oldY)),
      uint256(int256(newX)),
      uint256(int256(newY))
    );
    require(distance == 1, "TowerSystem: projectile speed exceeds rules");
  }
}
