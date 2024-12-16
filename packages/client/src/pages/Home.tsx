import { Heading, Input, Text, VStack } from '@chakra-ui/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
} from '@latticexyz/recs';
import { useCallback, useEffect, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { zeroAddress } from 'viem';

import { Button } from '../components/ui/button';
import { Field } from '../components/ui/field';
import { toaster } from '../components/ui/toaster';
import { useMUD } from '../MUDContext';
import { GAMES_PATH } from '../Routes';

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

        const { error, success } = await createGame(zeroAddress, username);

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

  return (
    <VStack gapY={20} h="100vh" justifyContent="center" p={6}>
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
  );
};
