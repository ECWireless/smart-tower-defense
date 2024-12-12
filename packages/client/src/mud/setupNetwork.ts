/*
 * The MUD client code is built on top of viem
 * (https://viem.sh/docs/getting-started.html).
 * This line imports the functions we need from it.
 */
import {
  ContractWrite,
  createBurnerAccount,
  transportObserver,
} from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { createClient as createFaucetClient } from '@latticexyz/faucet';
import { encodeEntity, syncToRecs } from '@latticexyz/store-sync/recs';
/*
 * Import our MUD config, which includes strong types for
 * our tables and other config options. We use this to generate
 * things like RECS components and get back strong types for them.
 *
 * See https://mud.dev/templates/typescript/contracts#mudconfigts
 * for the source of this information.
 */
import mudConfig from 'contracts/mud.config';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
import {
  ClientConfig,
  createPublicClient,
  createWalletClient,
  fallback,
  getContract,
  Hex,
  http,
  parseEther,
  webSocket,
} from 'viem';
import { garnet } from 'viem/chains';

import { getNetworkConfig } from './getNetworkConfig';
import { world } from './world';

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function setupNetwork() {
  const networkConfig = await getNetworkConfig();

  /*
   * Create a viem public (read only) client
   * (https://viem.sh/docs/clients/public.html)
   */
  const clientOptions = {
    chain: networkConfig.chain,
    transport: transportObserver(fallback([webSocket(), http()])),
    pollingInterval: 1000,
  } as const satisfies ClientConfig;

  const publicClient = createPublicClient(clientOptions);

  /*
   * Create an observable for contract writes that we can
   * pass into MUD dev tools for transaction observability.
   */
  const write$ = new Subject<ContractWrite>();

  /*
   * Create a temporary wallet and a viem client for it
   * (see https://viem.sh/docs/clients/wallet.html).
   */
  const burnerAccount = createBurnerAccount(networkConfig.privateKey as Hex);
  const burnerWalletClient = createWalletClient({
    ...clientOptions,
    account: burnerAccount,
  })
    .extend(transactionQueue())
    .extend(writeObserver({ onWrite: write => write$.next(write) }));

  if (networkConfig.chain.id === garnet.id) {
    const address = burnerAccount.address;
    // eslint-disable-next-line no-console
    console.info('[Dev Faucet]: Player address -> ', address);

    const faucetClient = createFaucetClient({
      url: 'https://ultimate-dominion-faucet.onrender.com/trpc',
    });

    const requestDrip = async () => {
      const balance = await publicClient.getBalance({ address });
      // eslint-disable-next-line no-console
      console.info(`[Dev Faucet]: Player balance -> ${balance}`);
      const lowBalance = balance < parseEther('0.00001');
      if (lowBalance) {
        // eslint-disable-next-line no-console
        console.info('[Dev Faucet]: Balance is low, dripping funds to player');

        await faucetClient.drip.mutate({
          address,
        });
      }
    };

    requestDrip();
    // Request a drip every 20 seconds
    setInterval(requestDrip, 20000);
  }

  /*
   * Create an object for communicating with the deployed World.
   */
  const worldContract = getContract({
    address: networkConfig.worldAddress as Hex,
    abi: IWorldAbi,
    client: { public: publicClient, wallet: burnerWalletClient },
  });

  /*
   * Sync on-chain state into RECS and keeps our client in sync.
   * Uses the MUD indexer if available, otherwise falls back
   * to the viem publicClient to make RPC calls to fetch MUD
   * events from the chain.
   */
  const { components, latestBlock$, storedBlockLogs$, waitForTransaction } =
    await syncToRecs({
      world,
      config: mudConfig,
      address: networkConfig.worldAddress as Hex,
      publicClient,
      startBlock: BigInt(networkConfig.initialBlockNumber),
    });

  return {
    world,
    components,
    playerEntity: encodeEntity(
      { address: 'address' },
      { address: burnerWalletClient.account.address },
    ),
    publicClient,
    walletClient: burnerWalletClient,
    latestBlock$,
    storedBlockLogs$,
    waitForTransaction,
    worldContract,
    write$: write$.asObservable().pipe(share()),
  };
}
