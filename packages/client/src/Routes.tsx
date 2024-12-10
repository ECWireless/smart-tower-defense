import { Text, VStack } from "@chakra-ui/react";
import { useComponentValue } from "@latticexyz/react";
import { SyncStep } from "@latticexyz/store-sync";
import { singletonEntity } from "@latticexyz/store-sync/recs";
import { Route, Routes, useLocation } from "react-router-dom";
import { ProgressRoot, ProgressBar } from "./components/ui/progress";

import { useMUD } from "./MUDContext";
import { Home } from "./pages/Home";
import { GameBoard } from "./pages/GameBoard";

export const HOME_PATH = "/";
export const GAME_BOARD_PATH = "/game-board";

const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const {
    components: { SyncProgress },
  } = useMUD();

  const syncProgress = useComponentValue(SyncProgress, singletonEntity);

  if (
    syncProgress &&
    syncProgress.step !== SyncStep.LIVE &&
    pathname !== HOME_PATH
  ) {
    return (
      <VStack justify="center" h="100%">
        <Text>Loading {Math.round(syncProgress.percentage)}%</Text>
        <ProgressRoot value={Math.round(syncProgress.percentage)}>
          <ProgressBar w={{ base: "80%", sm: "50%" }} />
        </ProgressRoot>
      </VStack>
    );
  }

  return (
    <Routes>
      <Route path={HOME_PATH} element={<Home />} />
      <Route path={GAME_BOARD_PATH} element={<GameBoard />} />
    </Routes>
  );
};

export default AppRoutes;
