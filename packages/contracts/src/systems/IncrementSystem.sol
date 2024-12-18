// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { System } from "@latticexyz/world/src/System.sol";
import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { Counter, LogicSystemAddress } from "../codegen/index.sol";
import { SystemSwitch } from "@latticexyz/world-modules/src/utils/SystemSwitch.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { ILogicSystem } from "../codegen/world/ILogicSystem.sol";

contract IncrementSystem is System {
  function deploySystem(bytes memory bytecode) external {
    address newSystem;

    assembly {
      newSystem := create(0, add(bytecode, 0x20), mload(bytecode))
      if iszero(extcodesize(newSystem)) {
        revert(0, 0)
      }
    }

    uint256 size;
    assembly {
      size := extcodesize(newSystem)
    }

    require(size <= 500, "Contract cannot be larger than 500 bytes");

    LogicSystemAddress.set(address(newSystem));
  }

  function getContractSize() external view returns (uint256) {
    address logicSystemAddress = LogicSystemAddress.get();

    uint256 size;
    assembly {
      size := extcodesize(logicSystemAddress)
    }
    return size;
  }

  function runStateChange() public {
    uint32 counter = Counter.get();
    address logicSystemAddress = LogicSystemAddress.get();

    bytes memory data = abi.encodeWithSignature("applyStateChange(uint32)", counter);

    (bool success, bytes memory returndata) = logicSystemAddress.delegatecall(data);
    require(success, "Delegatecall failed");

    counter = abi.decode(returndata, (uint32));
    Counter.set(counter);
  }
}
