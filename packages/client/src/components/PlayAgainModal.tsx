import { Text } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue } from '@latticexyz/recs';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zeroAddress } from 'viem';

import { useGame } from '../contexts/GameContext';
import { useMUD } from '../MUDContext';
import { GAMES_PATH } from '../Routes';
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
} from './ui/dialog';
import { toaster } from './ui/toaster';

type PlayAgainModalProps = {
  isGameOverModalOpen: boolean;
  setIsGameOverModalOpen: (isOpen: boolean) => void;
};

export const PlayAgainModal: React.FC<PlayAgainModalProps> = ({
  isGameOverModalOpen,
  setIsGameOverModalOpen,
}) => {
  const navigate = useNavigate();
  const {
    components: { CurrentGame, WinStreak },
    network: { playerEntity },
    systemCalls: { createGame, nextLevel },
  } = useMUD();
  const { game } = useGame();

  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const winStreak =
    useComponentValue(WinStreak, playerEntity)?.value ?? BigInt(0);

  const onCreateGame = useCallback(async () => {
    try {
      setIsCreatingGame(true);

      if (!game) {
        throw new Error('Game not found.');
      }

      if (game.winner === game.player1Address) {
        const { error, success } = await nextLevel();

        if (error && !success) {
          throw new Error(error);
        }
      } else {
        const { error, success } = await createGame(
          zeroAddress,
          game.player1Username,
        );

        if (error && !success) {
          throw new Error(error);
        }
      }

      toaster.create({
        title: 'Game Created!',
        type: 'success',
      });

      const newGame = getComponentValue(CurrentGame, playerEntity)?.value;
      if (!newGame) {
        throw new Error('No recent game found');
      }

      navigate(`${GAMES_PATH}/${newGame}`);
      setIsGameOverModalOpen(false);
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
  }, [
    createGame,
    CurrentGame,
    game,
    navigate,
    nextLevel,
    playerEntity,
    setIsGameOverModalOpen,
  ]);

  if (!game) {
    return (
      <DialogRoot
        open={isGameOverModalOpen}
        onOpenChange={e => setIsGameOverModalOpen(e.open)}
      >
        <DialogBackdrop />
        <DialogContent bgColor="white" color="black">
          <DialogCloseTrigger bgColor="black" />
          <DialogHeader>
            <DialogTitle textTransform="uppercase">Game Over</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text>An error occurred.</Text>
          </DialogBody>
          <DialogFooter />
        </DialogContent>
      </DialogRoot>
    );
  }

  return (
    <DialogRoot
      open={isGameOverModalOpen}
      onOpenChange={e => setIsGameOverModalOpen(e.open)}
    >
      <DialogBackdrop />
      <DialogContent bgColor="white" color="black">
        <DialogCloseTrigger bgColor="black" />
        <DialogHeader>
          <DialogTitle textTransform="uppercase">
            Game {game.winner === game.player1Address ? 'Won' : 'Over'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>
            {game.winner === game.player1Address
              ? `You beat level ${winStreak.toString()}! You can now continue to level ${(winStreak + 1n).toString()}.`
              : 'You lost!'}
          </Text>
          <Button
            loading={isCreatingGame}
            mt={4}
            onClick={onCreateGame}
            variant="surface"
          >
            {game.winner === game.player1Address ? 'Next Level' : 'Play Again'}
          </Button>
        </DialogBody>
        <DialogFooter />
      </DialogContent>
    </DialogRoot>
  );
};
