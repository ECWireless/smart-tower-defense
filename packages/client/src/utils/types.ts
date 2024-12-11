import { Address } from "viem";

export type Game = {
  id: string;
  endTimestamp: bigint;
  player1: Address;
  player2: Address;
  startTimestamp: bigint;
};
