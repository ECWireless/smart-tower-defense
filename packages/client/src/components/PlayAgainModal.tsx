import { Text } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue } from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useGame } from '../contexts/GameContext';
import { useMUD } from '../MUDContext';
import { GAMES_PATH } from '../Routes';
import { MAX_ROUNDS } from '../utils/constants';
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
    components: { CurrentGame, GamesByLevel, TopLevel, WinStreak },
    network: { playerEntity },
    systemCalls: { createGame },
  } = useMUD();
  const { game } = useGame();

  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const winStreak =
    useComponentValue(WinStreak, playerEntity)?.value ?? BigInt(0);
  const topLevel = useComponentValue(TopLevel, singletonEntity)?.level;
  const levelAsEntity = encodeEntity(
    { level: 'uint256' },
    { level: topLevel ?? 0n },
  );
  const topLevelGames = useComponentValue(GamesByLevel, levelAsEntity)?.gameIds;

  const onCreateGame = useCallback(async () => {
    try {
      setIsCreatingGame(true);

      if (!game) {
        throw new Error('Game not found.');
      }

      const resetLevel =
        game.winner !== game.player1Address ||
        (topLevel === winStreak && topLevelGames?.length === 1);

      const { error, success } = await createGame(
        game.player1Username,
        resetLevel,
      );

      if (error && !success) {
        throw new Error(error);
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
    playerEntity,
    setIsGameOverModalOpen,
    topLevel,
    topLevelGames,
    winStreak,
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

  if (topLevel === winStreak && topLevelGames?.length === 1) {
    return (
      <DialogRoot
        open={isGameOverModalOpen}
        onOpenChange={e => setIsGameOverModalOpen(e.open)}
      >
        <DialogBackdrop />
        <DialogContent bgColor="white" color="black">
          <DialogCloseTrigger bgColor="black" />
          <DialogHeader>
            <DialogTitle textTransform="uppercase">Game Won</DialogTitle>
          </DialogHeader>
          <DialogBody spaceY={4}>
            <Text fontSize="lg">
              Congratulations! You are now the <strong>top player</strong>!
            </Text>
            <Text>
              Your game has been saved, and other players can try to beat it.
              Playing again does not affect your top position.
            </Text>
            <Button
              loading={isCreatingGame}
              mt={4}
              onClick={onCreateGame}
              variant="surface"
            >
              Play Again
            </Button>
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
              ? `You beat level ${game.level.toString()}! You can now continue to level ${(game.level + 1n).toString()}.`
              : 'You lost!'}
          </Text>
          {game.winner !== game.player1Address &&
            game.roundCount > MAX_ROUNDS && (
              <Text fontWeight={600}>
                You have reached the max rounds you can play in a game.
              </Text>
            )}
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
