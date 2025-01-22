import { Entity } from '@latticexyz/recs';
import { Address } from 'viem';

export type Castle = {
  id: Entity;
  currentHealth: number;
  maxHealth: number;
  x: number;
  y: number;
};

export type Game = {
  id: Entity;
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
  id: Entity;
  currentHealth: number;
  maxHealth: number;
  owner: Address;
  projectileLogicAddress: Address;
  projectileTrajectory: { x: number; y: number }[];
  x: number;
  y: number;
};
