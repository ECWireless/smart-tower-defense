import { Box, HStack, Text, VStack } from '@chakra-ui/react';

import { useGame } from '../contexts/GameContext';

export const StatsPanel = (): JSX.Element => {
  const { game } = useGame();

  if (!game) {
    return <Box />;
  }

  const {
    actionCount,
    level,
    player1Address,
    player1Username,
    player2Username,
    roundCount,
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
        <Text fontWeight={700}>Level</Text>
        <Text fontSize="2xl" fontWeight={900}>
          {level.toString()}
        </Text>
      </VStack>
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>ROUND</Text>
        <Text fontSize="2xl" fontWeight={900}>
          {roundCount}
        </Text>
      </VStack>
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>TURN</Text>
        <Text fontSize="sm" fontWeight={900} pb={1}>
          {turn === player1Address ? player1Username : player2Username}
        </Text>
      </VStack>
      <VStack justifyContent="space-between">
        <Text fontWeight={700}>ACTIONS</Text>
        <Text fontSize="2xl" fontWeight={900}>
          {actionCount}
        </Text>
      </VStack>
    </HStack>
  );
};
