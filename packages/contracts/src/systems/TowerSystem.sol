// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { AddressBook, CurrentGame, EntityAtPosition, Game, GameData, Position, Projectile } from "../codegen/index.sol";
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

    (x, y) = ProjectileHelpers.getActualCoordinates(x, y);
    TowerHelpers.validateInstallTower(potentialGameId, playerAddress, x, y);

    uint256 timestamp = block.timestamp;
    address actualPlayerAddress = Game.get(potentialGameId).turn;
    bytes32 towerId = keccak256(abi.encodePacked(potentialGameId, actualPlayerAddress, timestamp));
    TowerHelpers.initializeTower(towerId, potentialGameId, actualPlayerAddress, x, y, projectile);
    TowerHelpers.storeInstallTowerAction(potentialGameId, playerAddress, x, y, projectile);

    return towerId;
  }

  function moveTower(bytes32 potentialGameId, bytes32 towerId, int16 x, int16 y) external returns (bytes32) {
    address playerAddress = _msgSender();
    TowerHelpers.validateMoveTower(potentialGameId, playerAddress, towerId, x, y);

    (int16 oldX, int16 oldY) = Position.get(towerId);

    (int16 actualX, int16 actualY) = ProjectileHelpers.getActualCoordinates(x, y);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(potentialGameId, oldX, oldY), 0);

    Position.set(towerId, actualX, actualY);
    EntityAtPosition.set(EntityHelpers.positionToEntityKey(potentialGameId, actualX, actualY), towerId);

    TowerHelpers.decrementActionCount(potentialGameId);
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

    TowerHelpers.validModifySystem(playerGameId, gameSystemAddress, towerId, playerAddress);

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
}
