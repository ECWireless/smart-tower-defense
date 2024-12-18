import { Address } from 'viem';

export type Game = {
  id: string;
  actionCount: number;
  endTimestamp: bigint;
  player1Address: Address;
  player1Username: string;
  player2Address: Address;
  player2Username: string;
  roundCount: number;
  startTimestamp: bigint;
  turn: Address;
  winner: Address;
};

export type Tower = {
  id: string;
  currentHealth: number;
  maxHealth: number;
  owner: Address;
  projectileLogic: Address;
  projectileTrajectory: { x: number; y: number }[];
  x: number;
  y: number;
};
