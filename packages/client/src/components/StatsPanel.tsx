import { HStack, Text, VStack } from '@chakra-ui/react';

import { type Game } from '../utils/types';

type StatsPanelProps = {
  game: Game;
};

export const StatsPanel: React.FC<StatsPanelProps> = ({
  game,
}): JSX.Element => {
  const {
    actionCount,
    roundCount,
    player1Address,
    player1Username,
    player2Username,
    turn,
  } = game;
  return (
    <HStack
      alignItems="stretch"
      bgColor="white"
      color="black"
      justifyContent="center"
      mb={2}
      p={2}
      spaceX={12}
      w="100%"
    >
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>ACTIONS</Text>
        <Text fontSize="2xl" fontWeight={900}>
          {actionCount}
        </Text>
      </VStack>
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>TURN</Text>
        <Text fontSize="sm" fontWeight={900} pb={1}>
          {turn === player1Address ? player1Username : player2Username}
        </Text>
      </VStack>
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>ROUND</Text>
        <Text fontSize="2xl" fontWeight={900}>
          {roundCount}
        </Text>
      </VStack>
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>WINS</Text>
        <Text fontSize="2xl" fontWeight={900}>
          0
        </Text>
      </VStack>
    </HStack>
  );
};
