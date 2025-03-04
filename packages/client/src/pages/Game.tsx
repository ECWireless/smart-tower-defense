import { Box, Button, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useState } from 'react';
import { BiSolidCastle } from 'react-icons/bi';
import { GiCannon, GiDefensiveWall, GiMineExplosion } from 'react-icons/gi';
import { useNavigate, useParams } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';

import { PlayAgainModal } from '../components/PlayAgainModal';
import { StatsPanel } from '../components/StatsPanel';
import { SystemModificationDrawer } from '../components/SystemModificationDrawer';
import { TurnSidebar } from '../components/TurnSidebar';
import { Tooltip } from '../components/ui/tooltip';
import { GameProvider, useGame } from '../contexts/GameContext';
import { type Tower } from '../utils/types';

export const GamePage = (): JSX.Element => {
  const { id } = useParams();
  return (
    <GameProvider gameId={id as Entity}>
      <InnerGamePage />
    </GameProvider>
  );
};

export const InnerGamePage = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    activeTowerId,
    allowDrop,
    enemyCastlePosition,
    game,
    handleDragStart,
    installingPosition,
    isInstallingTower,
    isPlayer1,
    isRefreshing,
    myCastlePosition,
    onInstallTower,
    onMoveTower,
    tickCount,
    towers,
    triggerAnimation,
  } = useGame();

  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);
  const [isSystemDrawerOpen, setIsSystemDrawerOpen] = useState(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);

  const onViewTower = useCallback(
    (tower: Tower) => {
      setSelectedTower(tower);
      setIsSystemDrawerOpen(true);
    },
    [setSelectedTower],
  );

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
    <VStack h="100vh" justifyContent="center" p={6} position="relative">
      <Button
        left="50%"
        onClick={() => {
          navigate('/');
        }}
        position="absolute"
        top={4}
        transform="translateX(-50%)"
      >
        Home
      </Button>
      <Box>
        <StatsPanel />
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
                      draggable={isPlayer1}
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
                      draggable={isPlayer1}
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
                  if (
                    myCastlePosition &&
                    enemyCastlePosition &&
                    tower.projectileTrajectory[tickCount]
                  ) {
                    const towerCollision = towers.find(
                      _tower =>
                        _tower.id !== tower.id &&
                        Math.abs(
                          _tower.x - tower.projectileTrajectory[tickCount].x,
                        ) <= 5 &&
                        Math.abs(
                          _tower.y - tower.projectileTrajectory[tickCount].y,
                        ) <= 5,
                    );

                    const enemyCastleCollision =
                      Math.abs(
                        enemyCastlePosition.x -
                          tower.projectileTrajectory[tickCount].x,
                      ) <= 5 &&
                      Math.abs(
                        enemyCastlePosition.y -
                          tower.projectileTrajectory[tickCount].y,
                      ) <= 5;

                    const myCastleCollision =
                      Math.abs(
                        myCastlePosition.x -
                          tower.projectileTrajectory[tickCount].x,
                      ) <= 5 &&
                      Math.abs(
                        myCastlePosition.y -
                          tower.projectileTrajectory[tickCount].y,
                      ) <= 5;

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
                            draggable={!isEnemyTile && isPlayer1}
                            transform={
                              activeTower.owner === game.player2Address
                                ? 'rotateY(180deg)'
                                : 'none'
                            }
                            onClick={() => onViewTower(activeTower)}
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
            <TurnSidebar isSystemDrawerOpen={isSystemDrawerOpen} />
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
