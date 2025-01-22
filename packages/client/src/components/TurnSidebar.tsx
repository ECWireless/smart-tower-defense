import { HStack, Text, VStack } from '@chakra-ui/react';
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
          <DialogBody>Just start clicking around!</DialogBody>
          <DialogFooter />
        </DialogContent>
      </DialogRoot>
    </VStack>
  );
};
