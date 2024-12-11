import { Button } from "../components/ui/button";
import { Heading, VStack } from "@chakra-ui/react";
import { FaPlay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { GAMES_PATH } from "../Routes";
import { useMUD } from "../MUDContext";
import { useCallback, useState } from "react";
import { toaster } from "../components/ui/toaster";
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
} from "@latticexyz/recs";
import { zeroAddress } from "viem";

export const Home = (): JSX.Element => {
  const navigate = useNavigate();
  const {
    components: { CurrentGame, Game },
    network: { playerEntity },
    systemCalls: { createGame },
  } = useMUD();

  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const onCreateGame = useCallback(async () => {
    try {
      setIsCreatingGame(true);

      let currentGame = getComponentValue(CurrentGame, playerEntity)?.value;
      if (currentGame) {
        const game = getComponentValueStrict(Game, currentGame as Entity);
        if (game.endTimestamp === BigInt(0)) {
          navigate(`${GAMES_PATH}/${currentGame}`);
          return;
        }
      }

      const { error, success } = await createGame(zeroAddress);

      if (error && !success) {
        throw new Error(error);
      }

      toaster.create({
        title: "Game Created!",
        type: "success",
      });

      currentGame = getComponentValue(CurrentGame, playerEntity)?.value;

      if (!currentGame) {
        throw new Error("No recent game found");
      }

      navigate(`${GAMES_PATH}/${currentGame}`);
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
  }, [createGame, CurrentGame, Game, navigate, playerEntity]);

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
