import { Heading, HStack, Input, Tabs, Text, VStack } from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Address, zeroAddress } from 'viem';

import { Button } from '../components/ui/button';
import { Field } from '../components/ui/field';
import { toaster } from '../components/ui/toaster';
import { useMUD } from '../MUDContext';
import { GAMES_PATH } from '../Routes';
import { type Game } from '../utils/types';

export const Home = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    components: { CurrentGame, Game, Username },
    network: { playerEntity },
    systemCalls: { createGame },
  } = useMUD();

  const [username, setUsername] = useState('');
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const games = useEntityQuery([Has(Game)]).map(entity => {
    const _game = getComponentValueStrict(Game, entity);

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

    return {
      id: entity,
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
    };
  }) as Game[];

  const onCreateGame = useCallback(
    async (e: React.FormEvent<HTMLDivElement>) => {
      e.preventDefault();
      try {
        setIsCreatingGame(true);

        let currentGame = getComponentValue(CurrentGame, playerEntity)?.value;
        if (currentGame) {
          const game = getComponentValueStrict(Game, currentGame as Entity);
          if (game.endTimestamp === BigInt(0)) {
            navigate(`${GAMES_PATH}/${currentGame}`);
            return;
          }
        }

        const { error, success } = await createGame(
          zeroAddress,
          username,
          true,
        );

        if (error && !success) {
          throw new Error(error);
        }

        toaster.create({
          title: 'Game Created!',
          type: 'success',
        });

        currentGame = getComponentValue(CurrentGame, playerEntity)?.value;

        if (!currentGame) {
          throw new Error('No recent game found');
        }

        navigate(`${GAMES_PATH}/${currentGame}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Smart contract error: ${(error as Error).message}`);

        toaster.create({
          description: (error as Error).message,
          title: 'Error Creating Game',
          type: 'error',
        });
      } finally {
        setIsCreatingGame(false);
      }
    },
    [createGame, CurrentGame, Game, navigate, playerEntity, username],
  );

  useEffect(() => {
    const savedUsername = getComponentValue(Username, playerEntity)?.value;
    if (savedUsername) {
      setUsername(savedUsername);
      setUsernameSaved(true);
    }
  }, [Username, playerEntity]);

  const activeGames = useMemo(
    () => games.filter(game => game.endTimestamp === BigInt(0)),
    [games],
  );

  const completedGames = useMemo(
    () => games.filter(game => game.endTimestamp !== BigInt(0)),
    [games],
  );

  return (
    <VStack>
      <VStack gapY={20} h="80vh" justifyContent="center" p={6}>
        <Heading size="4xl" textAlign="center" textTransform="uppercase">
          Smart Tower Defense
        </Heading>
        <VStack as="form" onSubmit={onCreateGame} spaceY={4}>
          {usernameSaved ? (
            <Text fontSize="lg" textAlign="center">
              Welcome back, {username}!
            </Text>
          ) : (
            <Field
              disabled={usernameSaved}
              label="Username"
              required={!usernameSaved}
              w="250px"
            >
              <Input
                onChange={e => setUsername(e.target.value)}
                value={username}
              />
            </Field>
          )}
          <Button
            loading={isCreatingGame}
            size="2xl"
            type="submit"
            variant="subtle"
          >
            <FaPlay color="white" />
          </Button>
        </VStack>
      </VStack>
      <Tabs.Root defaultValue="active" mb={10}>
        <Tabs.List>
          <Tabs.Trigger value="active">Active Games</Tabs.Trigger>
          <Tabs.Trigger value="completed">Completed Games</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="active">
          <VStack>
            {activeGames.length === 0 && (
              <Text fontSize="lg" textAlign="center">
                No active games
              </Text>
            )}
            {activeGames.map(game => (
              <HStack
                key={game.id}
                as="button"
                border="1px solid white"
                onClick={() => navigate(`${GAMES_PATH}/${game.id}`)}
                _hover={{
                  bgColor: 'gray.900',
                  cursor: 'pointer',
                }}
              >
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>Start Time</Text>
                  <Text>
                    {new Date(
                      Number(game.startTimestamp) * 1000,
                    ).toLocaleString()}
                  </Text>
                </VStack>
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>Player 1</Text>
                  <Text>{game.player1Username}</Text>
                </VStack>
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>Player 2</Text>
                  <Text>{game.player2Username}</Text>
                </VStack>
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>End Time</Text>
                  <Text>Game in progress</Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </Tabs.Content>
        <Tabs.Content value="completed">
          <VStack>
            {completedGames.length === 0 && (
              <Text fontSize="lg" textAlign="center">
                No completed games
              </Text>
            )}
            {completedGames.map(game => (
              <HStack
                key={game.id}
                as="button"
                border="1px solid white"
                onClick={() => navigate(`${GAMES_PATH}/${game.id}`)}
                _hover={{
                  bgColor: 'gray.900',
                  cursor: 'pointer',
                }}
              >
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>Start Time</Text>
                  <Text>
                    {new Date(
                      Number(game.startTimestamp) * 1000,
                    ).toLocaleString()}
                  </Text>
                </VStack>
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>Player 1</Text>
                  <Text>{game.player1Username}</Text>
                </VStack>
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>Player 2</Text>
                  <Text>{game.player2Username}</Text>
                </VStack>
                <VStack borderRight="1px solid white" gap={0} p={2} w="200px">
                  <Text fontWeight={700}>End Time</Text>
                  <Text>
                    {new Date(
                      Number(game.endTimestamp) * 1000,
                    ).toLocaleString()}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
        </Tabs.Content>
      </Tabs.Root>
    </VStack>
  );
};
