import { Box, Heading, HStack, Text, VStack } from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { FaInfoCircle, FaPlay } from 'react-icons/fa';
import { zeroAddress } from 'viem';

import { useGame } from '../contexts/GameContext';
import { useMUD } from '../MUDContext';
import { Button } from './ui/button';
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { toaster } from './ui/toaster';

export const TurnSidebar: React.FC = () => {
  const {
    systemCalls: { nextTurn },
  } = useMUD();
  const { game, refreshGame, setTriggerAnimation } = useGame();

  const [isChangingTurn, setIsChangingTurn] = useState(false);

  const onNextTurn = useCallback(async () => {
    try {
      setIsChangingTurn(true);

      if (!game) {
        throw new Error('Game not found.');
      }

      const { error, success } = await nextTurn(game.id);

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: 'Turn Changed!',
        type: 'success',
      });

      if (game.turn === game.player2Address) {
        setTriggerAnimation(true);
      } else {
        refreshGame();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Smart contract error: ${(error as Error).message}`);

      toaster.create({
        description: (error as Error).message,
        title: 'Error Changing Turn',
        type: 'error',
      });
    } finally {
      setIsChangingTurn(false);
    }
  }, [game, nextTurn, refreshGame, setTriggerAnimation]);

  const canChangeTurn = useMemo(() => {
    if (!game) return false;
    if (game.turn === zeroAddress) return true;
    return game.turn === game.player1Address && game.actionCount === 0;
  }, [game]);

  return (
    <VStack bgColor="white" color="black" p={2} w={120}>
      <HStack justifyContent="center">
        <Text fontSize="sm">NEXT</Text>
        <Button
          loading={isChangingTurn}
          onClick={onNextTurn}
          p={0}
          variant="ghost"
          _hover={{
            bgColor: 'gray.200',
          }}
          _disabled={{
            bgColor: 'gray.500',
          }}
        >
          <FaPlay color={canChangeTurn ? 'green' : 'black'} />
        </Button>
      </HStack>
      <HStack justifyContent="center">
        <Text fontSize="sm">TIMER</Text>
        <Text fontWeight={900}>5:00</Text>
      </HStack>
      <DialogRoot>
        <DialogBackdrop />
        <DialogTrigger
          as={Button}
          _hover={{
            bgColor: 'gray.200',
          }}
        >
          <FaInfoCircle color="black" />
        </DialogTrigger>
        <DialogContent bgColor="white" color="black">
          <DialogCloseTrigger bgColor="black" />
          <DialogHeader>
            <DialogTitle textTransform="uppercase">How to Play</DialogTitle>
          </DialogHeader>
          <DialogBody maxH="80vh" overflowY="auto">
            <VStack alignItems="start">
              <Heading fontSize="lg">Overview</Heading>
              <Text>
                Smart Tower Defense builds off of concepts of{' '}
                <strong>Autonomous Worlds</strong>
                and <strong>Digital Physics</strong>.
              </Text>
              <Text>
                The primary way of playing the game is by{' '}
                <strong>modifying the sytem logic of your towers</strong>. For
                instance, you can change the formula for your tower&apos;s
                projectile trajectory, which can be as simple as a straight line
                or as complex as a parabolic arc.
              </Text>
              <Text>
                The game is designed to be a{' '}
                <strong>self-evolving system</strong>. Players create levels for
                other players simply by playing. If you beat 5 levels, for
                instance, then lose on the 6th, then your game (your actions) is
                saved as a level 6 game for other players to face. The top
                player is the one whose game has never been beaten.
              </Text>
              <Heading fontSize="lg">Basic Gameplay</Heading>
              <Box as="ol" listStyleType="decimal" listStylePosition="inside">
                <li>
                  You have 10 <strong>rounds</strong> to bring your
                  opponent&apos;s castle health to 0.
                </li>
                <li>
                  Each round has 2 <strong>turns</strong>: yours, then your
                  opponent&apos;s.
                </li>
                <li>
                  Each turn, you can perform 1 <strong>action</strong>: install
                  a tower, move a tower, or modify a tower&apos;s system logic.
                </li>
                <li>
                  After your opponent&apos;s turn, round results will render.
                  These are the results of your tower&apos;s system logic (like
                  shooting a projectile a certain way).
                </li>
              </Box>

              <Heading fontSize="md">Notes</Heading>
              <Box as="ul" listStyleType="circle" listStylePosition="inside">
                <li>
                  To modify a tower&apos;s system logic, click on the tower you
                  want to modify, change the <strong>Solidity</strong> code,
                  then click the &quot;deploy&quot; button.
                </li>
                <li>
                  If your logic cannot compile, you&apos;ll receive an error. If
                  it does compile, but is invalid, your tower will not do
                  anything when the round results render.
                </li>
              </Box>
            </VStack>
          </DialogBody>
          <DialogFooter />
        </DialogContent>
      </DialogRoot>
    </VStack>
  );
};
