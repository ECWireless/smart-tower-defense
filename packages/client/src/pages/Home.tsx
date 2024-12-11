import { Button } from "../components/ui/button";
import { Heading, VStack } from "@chakra-ui/react";
import { FaPlay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { GAME_BOARD_PATH } from "../Routes";
import { useMUD } from "../MUDContext";
import { useCallback, useState } from "react";
import { toaster } from "../components/ui/toaster";
import { zeroAddress } from "viem";

export const Home = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    systemCalls: { createGame },
  } = useMUD();

  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const onCreateGame = useCallback(async () => {
    try {
      setIsCreatingGame(true);
      const { error, success } = await createGame(zeroAddress);

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: "Game Created!",
        type: "success",
      });
      navigate(GAME_BOARD_PATH);
    } catch (error) {
      console.error(`Smart contract error: ${(error as Error).message}`);

      toaster.create({
        description: (error as Error).message,
        title: "Error Creating Game",
        type: "error",
      });
    } finally {
      setIsCreatingGame(false);
    }
  }, [createGame, navigate]);

  return (
    <VStack gapY={20} h="100vh" justifyContent="center" p={6}>
      <Heading size="4xl" textAlign="center" textTransform="uppercase">
        Smart Tower Defense
      </Heading>
      <Button
        loading={isCreatingGame}
        onClick={onCreateGame}
        size="2xl"
        variant="subtle"
      >
        <FaPlay color="white" />
      </Button>
    </VStack>
  );
};
