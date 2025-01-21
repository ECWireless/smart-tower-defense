import { Box, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
} from '@latticexyz/recs';
import { useCallback, useEffect, useState } from 'react';
import { BiSolidCastle } from 'react-icons/bi';
import { GiCannon, GiDefensiveWall, GiMineExplosion } from 'react-icons/gi';
import { useParams } from 'react-router-dom';
import { Address, zeroAddress, zeroHash } from 'viem';

import { PlayAgainModal } from '../components/PlayAgainModal';
import { StatsPanel } from '../components/StatsPanel';
import { SystemModificationDrawer } from '../components/SystemModificationDrawer';
import { TurnSidebar } from '../components/TurnSidebar';
import { toaster } from '../components/ui/toaster';
import { Tooltip } from '../components/ui/tooltip';
import { GameProvider, useGame } from '../contexts/GameContext';
import { useMUD } from '../MUDContext';
import { type Tower } from '../utils/types';

const MAX_TICKS = 140;

export const GamePage = (): JSX.Element => {
  const { id } = useParams();
  return (
    <GameProvider gameId={id as Entity}>
      <InnerGamePage />
    </GameProvider>
  );
};

export const InnerGamePage = (): JSX.Element => {
  const {
    components: {
      Castle,
      CurrentGame,
      Health,
      Owner,
      Position,
      Projectile,
      ProjectileTrajectory,
      Tower,
    },
    systemCalls: { installTower, moveTower },
  } = useMUD();
  const { game, isRefreshing, refreshGame } = useGame();

  const [activeTowerId, setActiveTowerId] = useState<string>(zeroHash);
  const [isInstallingTower, setIsInstallingTower] = useState(false);
  const [installingPosition, setInstallingPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activePiece, setActivePiece] = useState<
    'offense' | 'defense' | 'none'
  >('none');

  const [triggerAnimation, setTriggerAnimation] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);
  const [isSystemDrawerOpen, setIsSystemDrawerOpen] = useState(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);

  const myCastlePosition = useEntityQuery([
    Has(Castle),
    HasValue(CurrentGame, { value: game?.id }),
    HasValue(Owner, { value: game?.player1Address }),
  ]).map(entity => {
    const _myCastlePosition = getComponentValueStrict(Position, entity);
    const _myCastleHealth = getComponentValueStrict(Health, entity);
    return {
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
      currentHealth: _enemyCastleHealth.currentHealth,
      maxHealth: _enemyCastleHealth.maxHealth,
      x: _enemyCastlePosition.x,
      y: _enemyCastlePosition.y,
    };
  })[0];

  const towers: Tower[] = useEntityQuery([
    Has(Tower),
    HasValue(CurrentGame, { value: game?.id }),
  ]).map(entity => {
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

        refreshGame();
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
    [activePiece, activeTowerId, game, installTower, refreshGame],
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

        refreshGame();
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
    [activeTowerId, game, moveTower, refreshGame],
  );

  const onViewTower = useCallback(
    (tower: Tower) => {
      setSelectedTower(tower);
      setIsSystemDrawerOpen(true);
    },
    [setSelectedTower],
  );

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (
    e: React.DragEvent,
    towerId: string,
    type: 'offense' | 'defense',
  ) => {
    setActiveTowerId(towerId);
    setActivePiece(type);
    e.dataTransfer.setData('text/plain', 'piece'); // Arbitrary data to identify the piece
  };

  useEffect(() => {
    if (!game) return () => {};
    if (game.turn !== game.player1Address) return () => {};
    if (!triggerAnimation) return () => {};

    const interval = setInterval(() => {
      if (tickCount >= MAX_TICKS - 1) {
        setTriggerAnimation(false);
        setTickCount(0);
        return;
      }
      setTickCount(prev => (prev + 1) % MAX_TICKS);
    }, 1);
    return () => clearInterval(interval);
  }, [game, tickCount, triggerAnimation]);

  useEffect(() => {
    if (!game) return;
    if (game.winner === zeroAddress && game.endTimestamp === BigInt(0)) return;

    setIsGameOverModalOpen(true);
  }, [game]);

  if (isRefreshing) {
    return (
      <VStack h="100vh" justifyContent="center">
        <Spinner borderWidth="4px" size="xl" />
      </VStack>
    );
  }

  if (!game) {
    return (
      <VStack h="100vh" justifyContent="center">
        <Text fontSize="3xl" fontWeight={700} textTransform="uppercase">
          Game not found
        </Text>
      </VStack>
    );
  }

  return (
    <VStack h="100vh" justifyContent="center" p={6}>
      <Box>
        <StatsPanel game={game} />
        <Box>
          <HStack alignItems="stretch" gap={2} h="100%">
            <Box bgColor="white" display="flex" w={120}>
              <Box borderRight="2px solid black" h="100%" w="50%">
                <VStack
                  borderBottom="2px solid black"
                  h={16}
                  justifyContent="center"
                >
                  <Tooltip
                    closeDelay={200}
                    content="Offensive Tower"
                    openDelay={200}
                  >
                    <Box
                      draggable="true"
                      onDragStart={e => handleDragStart(e, zeroHash, 'offense')}
                    >
                      <GiCannon color="blue" size={26} />
                    </Box>
                  </Tooltip>
                </VStack>
              </Box>
              <Box h="100%" w="50%">
                <VStack
                  borderBottom="2px solid black"
                  h={16}
                  justifyContent="center"
                >
                  <Tooltip
                    closeDelay={200}
                    content="Defensive Tower"
                    openDelay={200}
                  >
                    <Box
                      draggable="true"
                      onDragStart={e => handleDragStart(e, zeroHash, 'defense')}
                    >
                      <GiDefensiveWall color="blue" size={20} />
                    </Box>
                  </Tooltip>
                </VStack>
              </Box>
            </Box>

            <Box
              display="grid"
              gridTemplateColumns="repeat(14, 1fr)"
              gridTemplateRows="repeat(7, 1fr)"
              h="300px"
              position="relative"
              w="600px"
            >
              {triggerAnimation &&
                towers.map(tower => {
                  if (tower.projectileTrajectory[tickCount]) {
                    const towerCollision = towers.find(
                      _tower =>
                        _tower.id !== tower.id &&
                        Math.abs(
                          _tower.x - tower.projectileTrajectory[tickCount].x,
                        ) < 10 &&
                        Math.abs(
                          _tower.y - tower.projectileTrajectory[tickCount].y,
                        ) < 10,
                    );

                    const enemyCastleCollision =
                      Math.abs(
                        enemyCastlePosition.x -
                          tower.projectileTrajectory[tickCount].x,
                      ) < 10 &&
                      Math.abs(
                        enemyCastlePosition.y -
                          tower.projectileTrajectory[tickCount].y,
                      ) < 10;

                    const myCastleCollision =
                      Math.abs(
                        myCastlePosition.x -
                          tower.projectileTrajectory[tickCount].x,
                      ) < 10 &&
                      Math.abs(
                        myCastlePosition.y -
                          tower.projectileTrajectory[tickCount].y,
                      ) < 10;

                    let collisionEntity:
                      | Tower
                      | {
                          currentHealth: number;
                          maxHealth: number;
                          x: number;
                          y: number;
                        }
                      | null = towerCollision ?? null;

                    if (myCastleCollision) {
                      collisionEntity = myCastlePosition;
                    }

                    if (enemyCastleCollision) {
                      collisionEntity = enemyCastlePosition;
                    }

                    if (collisionEntity) {
                      return (
                        <Box
                          id={`projectile-${tower.id}`}
                          key={`projectile-${tower.id}`}
                          alignItems="center"
                          display="flex"
                          h="calc(100% / 7)"
                          justifyContent="center"
                          left={`calc((100% / 14) * ${collisionEntity.x / 10})`}
                          position="absolute"
                          top={`calc((100% / 7) * ${collisionEntity.y / 10})`}
                          transform="translateX(-50%) translateY(-50%)"
                          w="calc(100% / 14)"
                          zIndex={1}
                        >
                          <GiMineExplosion color="red" size={20} />
                        </Box>
                      );
                    }

                    return (
                      <Box
                        id={`projectile-${tower.id}`}
                        key={`projectile-${tower.id}`}
                        alignItems="center"
                        display="flex"
                        h="calc(100% / 7)"
                        justifyContent="center"
                        left={`calc((100% / 14) * ${tower.projectileTrajectory[tickCount].x / 10})`}
                        position="absolute"
                        top={`calc((100% / 7) * ${tower.projectileTrajectory[tickCount].y / 10})`}
                        transform="translateX(-50%) translateY(-50%)"
                        w="calc(100% / 14)"
                        zIndex={1}
                      >
                        <Box bgColor="red" borderRadius="50%" h={2} w={2} />
                      </Box>
                    );
                  } else {
                    return null;
                  }
                })}
              {Array.from({ length: 98 }).map((_, index) => {
                const row = Math.floor(index / 14);
                const col = index % 14;
                const isMiddleLine = index % 14 === 7;

                const myCastlePositionX = Math.floor(
                  (myCastlePosition?.x ?? 10) / 10,
                );
                const myCastlePositionY = Math.floor(
                  (myCastlePosition?.y ?? 10) / 10,
                );

                const enemyCastlePositionX = Math.floor(
                  (enemyCastlePosition?.x ?? 10) / 10,
                );
                const enemyCastlePositionY = Math.floor(
                  (enemyCastlePosition?.y ?? 10) / 10,
                );

                const myCastle =
                  row === myCastlePositionY && col === myCastlePositionX;
                const enemyCastle =
                  row === enemyCastlePositionY && col === enemyCastlePositionX;

                const isEnemyTile = col > 6;

                const activeTower = towers.find(
                  tower =>
                    Math.floor(tower.x / 10) === col &&
                    Math.floor(tower.y / 10) === row,
                );

                const canInstall =
                  !activeTower && !myCastle && !enemyCastle && !isEnemyTile;

                const isInstalling =
                  !!(
                    installingPosition?.x === col &&
                    installingPosition?.y === row
                  ) && isInstallingTower;

                return (
                  <Box
                    bg="green.300"
                    border="1px solid black"
                    borderLeft={isMiddleLine ? '2px solid black' : 'none'}
                    h="100%"
                    key={index}
                    onDrop={e =>
                      activeTowerId === zeroHash
                        ? onInstallTower(e, row, col)
                        : onMoveTower(e, row, col)
                    }
                    onDragOver={canInstall ? allowDrop : undefined}
                    w="100%"
                  >
                    {isInstalling && (
                      <Box
                        alignItems="center"
                        color="white"
                        display="flex"
                        h="100%"
                        justifyContent="center"
                        w="100%"
                      >
                        <Spinner borderWidth="2px" size="sm" />
                      </Box>
                    )}

                    {!!activeTower && (
                      <Box
                        alignItems="center"
                        color="white"
                        display="flex"
                        h="100%"
                        justifyContent="center"
                        w="100%"
                      >
                        <Tooltip
                          closeDelay={200}
                          content={`${
                            activeTower.projectileLogicAddress !== zeroAddress
                              ? 'Offensive Tower'
                              : 'Defensive Tower'
                          } - Health: ${activeTower.currentHealth}/${activeTower.maxHealth}`}
                          openDelay={200}
                        >
                          <Box
                            draggable={!isEnemyTile}
                            transform={
                              activeTower.owner === game.player2Address
                                ? 'rotateY(180deg)'
                                : 'none'
                            }
                            onClick={() =>
                              isEnemyTile ? undefined : onViewTower(activeTower)
                            }
                            onDragStart={e =>
                              handleDragStart(
                                e,
                                activeTower.id,
                                activeTower.projectileLogicAddress !==
                                  zeroAddress
                                  ? 'offense'
                                  : 'defense',
                              )
                            }
                          >
                            {activeTower.projectileLogicAddress !==
                            zeroAddress ? (
                              <GiCannon
                                color={
                                  activeTower.owner === game.player1Address
                                    ? 'blue'
                                    : 'orange'
                                }
                                size={26}
                              />
                            ) : (
                              <GiDefensiveWall
                                color={
                                  activeTower.owner === game.player1Address
                                    ? 'blue'
                                    : 'orange'
                                }
                                size={20}
                              />
                            )}
                          </Box>
                        </Tooltip>
                      </Box>
                    )}

                    {myCastle && (
                      <Tooltip
                        closeDelay={200}
                        content={`Your Castle - Health: ${myCastlePosition?.currentHealth}/${myCastlePosition?.maxHealth}`}
                        openDelay={200}
                      >
                        <Box
                          alignItems="center"
                          color="white"
                          display="flex"
                          h="100%"
                          justifyContent="center"
                          w="100%"
                        >
                          <BiSolidCastle color="blue" size={20} />
                        </Box>
                      </Tooltip>
                    )}

                    {enemyCastle && (
                      <Tooltip
                        closeDelay={200}
                        content={`Enemy Castle - Health: ${enemyCastlePosition?.currentHealth}/${enemyCastlePosition?.maxHealth}`}
                        openDelay={200}
                      >
                        <Box
                          alignItems="center"
                          color="white"
                          display="flex"
                          h="100%"
                          justifyContent="center"
                          w="100%"
                        >
                          <BiSolidCastle color="orange" size={20} />
                        </Box>
                      </Tooltip>
                    )}
                  </Box>
                );
              })}
            </Box>
            <TurnSidebar setTriggerAnimation={setTriggerAnimation} />
          </HStack>
        </Box>
      </Box>
      {selectedTower && (
        <SystemModificationDrawer
          isSystemDrawerOpen={isSystemDrawerOpen}
          setIsSystemDrawerOpen={setIsSystemDrawerOpen}
          tower={selectedTower}
        />
      )}
      <PlayAgainModal
        isGameOverModalOpen={isGameOverModalOpen}
        setIsGameOverModalOpen={setIsGameOverModalOpen}
      />
    </VStack>
  );
};
