import { HStack, Text, VStack } from "@chakra-ui/react";

export const StatsPanel = (): JSX.Element => {
  return (
    <HStack
      bgColor="white"
      color="black"
      justifyContent="center"
      mb={2}
      p={2}
      spaceX={12}
      w="100%"
    >
      <VStack>
        <Text fontWeight={700}>ACTIONS</Text>
        <Text fontSize="2xl" fontWeight={900}>
          1
        </Text>
      </VStack>
      <VStack>
        <Text fontWeight={700}>TURN</Text>
        <Text fontSize="2xl" fontWeight={900}>
          YOURS
        </Text>
      </VStack>
      <VStack>
        <Text fontWeight={700}>ROUND</Text>
        <Text fontSize="2xl" fontWeight={900}>
          3
        </Text>
      </VStack>
      <VStack>
        <Text fontWeight={700}>WINS</Text>
        <Text fontSize="2xl" fontWeight={900}>
          2
        </Text>
      </VStack>
    </HStack>
  );
};
