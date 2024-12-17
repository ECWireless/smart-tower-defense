import { Entity } from '@latticexyz/recs';
import { uuid } from '@latticexyz/utils';
import { BaseError, ContractFunctionRevertedError } from 'viem';

import { ClientComponents } from './createClientComponents';
/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */
import { SetupNetworkResult } from './setupNetwork';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

const getContractError = (error: BaseError): string => {
  const revertError = error.walk(
    e => e instanceof ContractFunctionRevertedError,
  );
  if (revertError instanceof ContractFunctionRevertedError) {
    const args = revertError.data?.args ?? [];
    return (args[0] as string) ?? 'An error occurred calling the contract.';
  }
  return 'An error occurred calling the contract.';
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSystemCalls(
  /*
   * The parameter list informs TypeScript that:
   *
   * - The first parameter is expected to be a
   *   SetupNetworkResult, as defined in setupNetwork.ts
   *
   *   Out of this parameter, we only care about two fields:
   *   - worldContract (which comes from getContract, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L63-L69).
   *
   *   - waitForTransaction (which comes from syncToRecs, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   *
   * - From the second parameter, which is a ClientComponent,
   *   we only care about Counter. This parameter comes to use
   *   through createClientComponents.ts, but it originates in
   *   syncToRecs
   *   (https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   */
  { worldContract, waitForTransaction }: SetupNetworkResult,
  { Position }: ClientComponents,
) {
  const createGame = async (player2: string, username: string) => {
    try {
      const tx = await worldContract.write.app__createGame([
        player2 as `0x${string}`,
        username,
      ]);
      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to create game.',
        success,
      };
    } catch (error) {
      return {
        error: getContractError(error as BaseError),
        success: false,
      };
    }
  };

  const deploySystem = async (bytecode: string) => {
    try {
      const tx = await worldContract.write.app__deploySystem([
        bytecode as `0x${string}`,
      ]);
      await waitForTransaction(tx);

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to deploy system.',
        success,
      };
    } catch (error) {
      return {
        error: getContractError(error as BaseError),
        success: false,
      };
    }
  };

  const getContractSize = async () => {
    const size = await worldContract.read.app__getContractSize();
    return size;
  };

  const installTower = async (
    potentialGameId: string,
    projectile: boolean,
    x: number,
    y: number,
  ) => {
    try {
      const tx = await worldContract.write.app__installTower([
        potentialGameId as `0x${string}`,
        projectile,
        x,
        y,
      ]);
      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to install tower.',
        success,
      };
    } catch (error) {
      return {
        error: getContractError(error as BaseError),
        success: false,
      };
    }
  };

  const moveTower = async (
    gameId: string,
    towerId: string,
    x: number,
    y: number,
  ) => {
    const positionId = uuid();

    try {
      Position.addOverride(positionId, {
        entity: towerId as Entity,
        value: { x, y },
      });

      const tx = await worldContract.write.app__moveTower([
        gameId as `0x${string}`,
        towerId as `0x${string}`,
        x,
        y,
      ]);
      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to move tower.',
        success,
      };
    } catch (error) {
      return {
        error: getContractError(error as BaseError),
        success: false,
      };
    } finally {
      Position.removeOverride(positionId);
    }
  };

  const nextTurn = async (gameId: string) => {
    try {
      const tx = await worldContract.write.app__nextTurn([
        gameId as `0x${string}`,
      ]);
      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to change turn.',
        success,
      };
    } catch (error) {
      return {
        error: getContractError(error as BaseError),
        success: false,
      };
    }
  };

  const runStateChange = async () => {
    try {
      const tx = await worldContract.write.app__runStateChange();
      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to run state change.',
        success,
      };
    } catch (error) {
      return {
        error: getContractError(error as BaseError),
        success: false,
      };
    }
  };

  return {
    createGame,
    deploySystem,
    getContractSize,
    installTower,
    moveTower,
    nextTurn,
    runStateChange,
  };
}
