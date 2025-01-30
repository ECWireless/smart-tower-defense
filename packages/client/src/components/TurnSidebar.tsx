import {
  Box,
  Heading,
  HStack,
  Text,
  useDialog,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaInfoCircle, FaPlay } from 'react-icons/fa';

import { Tooltip } from '../components/ui/tooltip';
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

const HOW_TO_SEEN_KEY = 'how-to-seen';

type TurnSidebarProps = {
  isSystemDrawerOpen: boolean;
};

export const TurnSidebar: React.FC<TurnSidebarProps> = ({
  isSystemDrawerOpen,
}) => {
  const {
    systemCalls: { nextTurn },
  } = useMUD();
  const { game, refreshGame, setTriggerAnimation, triggerAnimation } =
    useGame();

  const dialog = useDialog();

  const [isChangingTurn, setIsChangingTurn] = useState(false);

  // Open How To info modal if this is the first time the user is playing a game.
  useEffect(() => {
    const hasSeenHowToInfo = localStorage.getItem(HOW_TO_SEEN_KEY);
    if (hasSeenHowToInfo) return;
    dialog.setOpen(true);
  }, [dialog]);

  const onCloseDialog = useCallback(() => {
    dialog.setOpen(false);
    localStorage.setItem(HOW_TO_SEEN_KEY, 'true');
  }, [dialog]);

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
    if (game.endTimestamp !== BigInt(0)) return false;
    if (game.turn === game.player2Address) return true;
    return game.turn === game.player1Address && game.actionCount === 0;
  }, [game]);

  useEffect(() => {
    if (!canChangeTurn) return () => {};
    if (triggerAnimation) return () => {};
    if (isSystemDrawerOpen) return () => {};

    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onNextTurn();
      }
    };

    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [canChangeTurn, isSystemDrawerOpen, onNextTurn, triggerAnimation]);

  return (
    <VStack bgColor="white" color="black" p={2} w={120}>
      <HStack justifyContent="center">
        <Text fontSize="sm">NEXT</Text>
        <Button
          disabled={triggerAnimation}
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
          <FaPlay
            color={!triggerAnimation && canChangeTurn ? 'green' : 'black'}
            style={{
              animation:
                !triggerAnimation && canChangeTurn
                  ? 'pulse 1s infinite'
                  : 'none',
            }}
          />
        </Button>
      </HStack>
      <DialogRoot
        onOpenChange={e => (e.open ? dialog.setOpen(true) : onCloseDialog())}
        open={dialog.open}
        scrollBehavior="inside"
      >
        <DialogBackdrop />
        <DialogTrigger
          as={Button}
          _hover={{
            bgColor: 'gray.200',
          }}
        >
          <Tooltip closeDelay={200} content="Help" openDelay={200}>
            <FaInfoCircle color="black" />
          </Tooltip>
        </DialogTrigger>
        <DialogContent bgColor="white" color="black">
          <DialogCloseTrigger bgColor="black" />
          <DialogHeader>
            <DialogTitle textTransform="uppercase">How to Play</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack alignItems="start">
              <Heading fontSize="lg">Overview</Heading>
              <Text>
                Smart Tower Defense builds off of concepts of{' '}
                <strong>Autonomous Worlds</strong> and{' '}
                <strong>Digital Physics</strong>.
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
              <Box as="ol" listStylePosition="inside" listStyleType="decimal">
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

              <Heading fontSize="md">Notes:</Heading>
              <Box as="ul" listStylePosition="inside" listStyleType="circle">
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
