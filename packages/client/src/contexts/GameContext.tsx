import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Address, zeroAddress, zeroHash } from 'viem';

import { toaster } from '../components/ui/toaster';
import { useMUD } from '../MUDContext';
import type { Castle, Game, Tower } from '../utils/types';

const MAX_TICKS = 140;

type GameContextType = {
  activeTowerId: string;
  allowDrop: (e: React.DragEvent) => void;
  enemyCastlePosition: Castle;
  game: Game | null;
  handleDragStart: (
    e: React.DragEvent,
    towerId: string,
    type: 'offense' | 'defense',
  ) => void;
  installingPosition: { x: number; y: number } | null;
  isInstallingTower: boolean;
  isRefreshing: boolean;
  myCastlePosition: Castle;
  onInstallTower: (e: React.DragEvent, row: number, col: number) => void;
  onMoveTower: (e: React.DragEvent, row: number, col: number) => void;
  refreshGame: () => void;
  setTowers: (towers: Tower[]) => void;
  setTriggerAnimation: (value: boolean) => void;
  tickCount: number;
  towers: Tower[];
  triggerAnimation: boolean;
};

const GameContext = createContext<GameContextType>({
  activeTowerId: zeroHash,
  allowDrop: () => {},
  enemyCastlePosition: {
    id: zeroHash as Entity,
    currentHealth: 0,
    maxHealth: 0,
    x: 0,
    y: 0,
  },
  game: null,
  handleDragStart: () => {},
  installingPosition: null,
  isInstallingTower: false,
  isRefreshing: false,
  myCastlePosition: {
    id: zeroHash as Entity,
    currentHealth: 0,
    maxHealth: 0,
    x: 0,
    y: 0,
  },
  onInstallTower: () => {},
  onMoveTower: () => {},
  refreshGame: async () => {},
  setTowers: () => {},
  setTriggerAnimation: () => {},
  tickCount: 0,
  towers: [],
  triggerAnimation: false,
});

export type GameProviderProps = {
  children: ReactNode;
  gameId: Entity;
};

export const GameProvider = ({
  children,
  gameId,
}: GameProviderProps): JSX.Element => {
  const {
    components: {
      Castle,
      CurrentGame,
      Game: GameComponent,
      Health,
      Owner,
      Position,
      Projectile,
      ProjectileTrajectory,
      Tower,
      Username,
    },
    systemCalls: { installTower, moveTower },
  } = useMUD();

  const [game, setGame] = useState<Game | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(true);

  const [activeTowerId, setActiveTowerId] = useState<string>(zeroHash);
  const [isInstallingTower, setIsInstallingTower] = useState(false);
  const [installingPosition, setInstallingPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activePiece, setActivePiece] = useState<
    'offense' | 'defense' | 'none'
  >('none');

  const [towers, setTowers] = useState<Tower[]>([]);
  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  const myCastlePosition = useEntityQuery([
    Has(Castle),
    HasValue(CurrentGame, { value: game?.id }),
    HasValue(Owner, { value: game?.player1Address }),
  ]).map(entity => {
    const _myCastlePosition = getComponentValueStrict(Position, entity);
    const _myCastleHealth = getComponentValueStrict(Health, entity);
    return {
      id: entity,
      currentHealth: _myCastleHealth.currentHealth,
      maxHealth: _myCastleHealth.maxHealth,
      x: _myCastlePosition.x,
      y: _myCastlePosition.y,
    };
  })[0];

  const enemyCastlePosition = useEntityQuery([
    Has(Castle),
    HasValue(CurrentGame, { value: game?.id }),
    HasValue(Owner, { value: game?.player2Address }),
  ]).map(entity => {
    const _enemyCastlePosition = getComponentValueStrict(Position, entity);
    const _enemyCastleHealth = getComponentValueStrict(Health, entity);
    return {
      id: entity,
      currentHealth: _enemyCastleHealth.currentHealth,
      maxHealth: _enemyCastleHealth.maxHealth,
      x: _enemyCastlePosition.x,
      y: _enemyCastlePosition.y,
    };
  })[0];

  const fetchGame = useCallback(() => {
    if (!gameId) return;
    const _game = getComponentValue(GameComponent, gameId as Entity);
    if (_game) {
      const player1Entity = encodeEntity(
        { playerAddress: 'address' },
        { playerAddress: _game.player1Address as Address },
      );
      const player2Entity = encodeEntity(
        { playerAddress: 'address' },
        { playerAddress: _game.player2Address as Address },
      );
      const _player1Username = getComponentValueStrict(
        Username,
        player1Entity,
      ).value;
      const _player2Username = getComponentValueStrict(
        Username,
        player2Entity,
      ).value;

      setGame({
        id: gameId,
        actionCount: _game.actionCount,
        endTimestamp: _game.endTimestamp,
        player1Address: _game.player1Address as Address,
        player1Username: _player1Username,
        player2Address: _game.player2Address as Address,
        player2Username: _player2Username,
        roundCount: _game.roundCount,
        startTimestamp: _game.startTimestamp,
        turn: _game.turn as Address,
        winner: _game.winner as Address,
      });

      const _towers = Array.from(
        runQuery([Has(Tower), HasValue(CurrentGame, { value: gameId })]),
      ).map(entity => {
        const health = getComponentValueStrict(Health, entity);
        const owner = getComponentValueStrict(Owner, entity).value;
        const position = getComponentValueStrict(Position, entity);
        const projectileTrajectoryUnformatted = getComponentValue(
          ProjectileTrajectory,
          entity,
        );

        const projectileTrajectory = [];
        if (projectileTrajectoryUnformatted) {
          for (let i = 0; i < projectileTrajectoryUnformatted.x.length; i++) {
            projectileTrajectory.push({
              x: projectileTrajectoryUnformatted.x[i],
              y: projectileTrajectoryUnformatted.y[i],
            });
          }
        }

        return {
          id: entity,
          currentHealth: health.currentHealth,
          maxHealth: health.maxHealth,
          owner: owner as Address,
          projectileLogicAddress: (getComponentValue(Projectile, entity)
            ?.logicAddress ?? zeroAddress) as Address,
          projectileTrajectory,
          x: position.x,
          y: position.y,
        };
      });
      setTowers(_towers.filter(tower => tower.currentHealth > 0));
    }
    setIsLoadingGame(false);
  }, [
    CurrentGame,
    GameComponent,
    gameId,
    Health,
    Owner,
    Position,
    Projectile,
    ProjectileTrajectory,
    Tower,
    Username,
  ]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  const onInstallTower = useCallback(
    async (e: React.DragEvent, row: number, col: number) => {
      e.preventDefault();
      try {
        setIsInstallingTower(true);
        setInstallingPosition({ x: col, y: row });

        if (activeTowerId !== zeroHash) {
          throw new Error('Active tower selected. Please move it instead.');
        }

        if (!game) {
          throw new Error('Game not found.');
        }

        const hasProjectile = activePiece === 'offense';

        const { error, success } = await installTower(
          game.id,
          hasProjectile,
          col * 10,
          row * 10,
        );

        if (error && !success) {
          throw new Error(error);
        }

        toaster.create({
          title: 'Tower Installed!',
          type: 'success',
        });

        fetchGame();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Smart contract error: ${(error as Error).message}`);

        toaster.create({
          description: (error as Error).message,
          title: 'Error Installing Tower',
          type: 'error',
        });
      } finally {
        setIsInstallingTower(false);
        setInstallingPosition(null);
      }
    },
    [activePiece, activeTowerId, game, installTower, fetchGame],
  );

  const onMoveTower = useCallback(
    async (e: React.DragEvent, row: number, col: number) => {
      e.preventDefault();
      try {
        setIsInstallingTower(true);
        setInstallingPosition({ x: col, y: row });

        if (activeTowerId === zeroHash) {
          throw new Error('No active tower selected.');
        }

        if (!game) {
          throw new Error('Game not found.');
        }

        const { error, success } = await moveTower(
          game.id,
          activeTowerId,
          col * 10,
          row * 10,
        );

        if (error && !success) {
          throw new Error(error);
        }

        toaster.create({
          title: 'Tower Moved!',
          type: 'success',
        });

        fetchGame();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Smart contract error: ${(error as Error).message}`);

        toaster.create({
          description: (error as Error).message,
          title: 'Error Moving Tower',
          type: 'error',
        });
      } finally {
        setIsInstallingTower(false);
        setInstallingPosition(null);
      }
    },
    [activeTowerId, game, moveTower, fetchGame],
  );

  const allowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, towerId: string, type: 'offense' | 'defense') => {
      setActiveTowerId(towerId);
      setActivePiece(type);
      e.dataTransfer.setData('text/plain', 'piece'); // Arbitrary data to identify the piece
    },
    [],
  );

  useEffect(() => {
    if (!game) return () => {};
    if (game.turn !== game.player2Address) return () => {};
    if (!triggerAnimation) return () => {};

    const _towers = Array.from(
      runQuery([Has(Tower), HasValue(CurrentGame, { value: game.id })]),
    ).map(entity => {
      const projectileTrajectoryUnformatted = getComponentValue(
        ProjectileTrajectory,
        entity,
      );

      const projectileTrajectory = [];
      if (projectileTrajectoryUnformatted) {
        for (let i = 0; i < projectileTrajectoryUnformatted.x.length; i++) {
          projectileTrajectory.push({
            x: projectileTrajectoryUnformatted.x[i],
            y: projectileTrajectoryUnformatted.y[i],
          });
        }
      }

      return {
        id: entity,
        projectileTrajectory,
      };
    });

    setTowers(prev => {
      const _test = prev.map(tower => {
        const towerWithNewProjectile = _towers.find(
          newTower => newTower.id === tower.id,
        );
        if (towerWithNewProjectile) {
          return {
            ...tower,
            projectileTrajectory: towerWithNewProjectile.projectileTrajectory,
          };
        }
        return tower;
      });
      return _test;
    });

    let _tickCount = 0;
    const interval = setInterval(() => {
      if (_tickCount >= MAX_TICKS - 1) {
        setTriggerAnimation(false);
        setTickCount(0);
        fetchGame();
        return;
      }
      _tickCount += 1;
      setTickCount(prev => (prev + 1) % MAX_TICKS);
    }, 10);
    return () => clearInterval(interval);
  }, [
    CurrentGame,
    fetchGame,
    game,
    Health,
    Position,
    Projectile,
    ProjectileTrajectory,
    Owner,
    Tower,
    triggerAnimation,
  ]);

  return (
    <GameContext.Provider
      value={{
        activeTowerId,
        allowDrop,
        enemyCastlePosition,
        game,
        handleDragStart,
        installingPosition,
        isInstallingTower,
        isRefreshing: isLoadingGame,
        myCastlePosition,
        onInstallTower,
        onMoveTower,
        refreshGame: fetchGame,
        setTowers,
        setTriggerAnimation,
        tickCount,
        towers,
        triggerAnimation,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => useContext(GameContext);
