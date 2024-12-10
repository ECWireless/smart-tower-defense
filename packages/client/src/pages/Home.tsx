import { Button } from "../components/ui/button";
import { Heading, VStack } from "@chakra-ui/react";
import { FaPlay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { GAME_BOARD_PATH } from "../Routes";

export const Home = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <VStack gapY={20} h="100vh" justifyContent="center" p={6}>
      <Heading size="4xl" textAlign="center" textTransform="uppercase">
        Smart Tower Defense
      </Heading>
      <Button
        onClick={() => navigate(GAME_BOARD_PATH)}
        size="2xl"
        variant="subtle"
      >
        <FaPlay color="white" />
      </Button>
    </VStack>
  );
};
