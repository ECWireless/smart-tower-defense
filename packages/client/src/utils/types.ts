import { Address } from 'viem';

export type Game = {
  id: string;
  actionCount: number;
  endTimestamp: bigint;
  player1: Address;
  player2: Address;
  roundCount: number;
  startTimestamp: bigint;
  turn: Address;
};

export type Tower = {
  id: string;
  currentHealth: number;
  maxHealth: number;
  projectile: boolean;
  x: number;
  y: number;
};
