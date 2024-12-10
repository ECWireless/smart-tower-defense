import { Box, HStack, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { GiStoneTower } from "react-icons/gi";
import { BiSolidCastle } from "react-icons/bi";
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
} from "../components/ui/drawer";
import { StatsPanel } from "../components/StatsPanel";

export const GameBoard = (): JSX.Element => {
  const [offenseTowerPosition, setOffenseTowerPosition] = useState({
    x: -1,
    y: -1,
  });
  const [defenseTowerPosition, setDefenseTowerPosition] = useState({
    x: -1,
    y: -1,
  });
  const [activePiece, setActivePiece] = useState<
    "offense" | "defense" | "none"
  >("none");
  const [isSystemDrawerOpen, setIsSystemDrawerOpen] = useState(false);

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    if (activePiece === "offense") setOffenseTowerPosition({ x: row, y: col });
    else setDefenseTowerPosition({ x: row, y: col });
  };

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, type: "offense" | "defense") => {
    setActivePiece(type);
    e.dataTransfer.setData("text/plain", "piece"); // Arbitrary data to identify the piece
  };

  return (
    <DrawerRoot
      onOpenChange={(e) => setIsSystemDrawerOpen(e.open)}
      open={isSystemDrawerOpen}
      size="lg"
    >
      <VStack h="100vh" justifyContent="center" p={6}>
        <DrawerBackdrop />
        <DrawerContent bgColor="white">
          <DrawerCloseTrigger bgColor="black" />
          <DrawerHeader>
            <DrawerTitle color="black" textTransform="uppercase">
              System Modification
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody />
          <DrawerFooter />
        </DrawerContent>
        <Box>
          <StatsPanel />
          <Box>
            <HStack alignItems="stretch" gap={2} h="100%">
              <Box bgColor="white" display="flex" w={100}>
                <Box borderRight="2px solid black" h="100%" w="50%">
                  <VStack
                    borderBottom="2px solid black"
                    h={16}
                    justifyContent="center"
                  >
                    <Box
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, "offense")}
                    >
                      <GiStoneTower color="blue" size={20} />
                    </Box>
                  </VStack>
                </Box>
                <Box h="100%" w="50%">
                  <VStack
                    borderBottom="2px solid black"
                    h={16}
                    justifyContent="center"
                  >
                    <Box
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, "defense")}
                    >
                      <GiStoneTower color="red" size={20} />
                    </Box>
                  </VStack>
                </Box>
              </Box>

              <Box
                display="grid"
                gridTemplateColumns="repeat(14, 1fr)"
                gridTemplateRows="repeat(7, 1fr)"
                h="300px"
                w="600px"
              >
                {Array.from({ length: 98 }).map((_, index) => {
                  const row = Math.floor(index / 14);
                  const col = index % 14;
                  const isMiddleLine = index % 14 === 7;

                  const myCastle = row === 3 && col === 0;
                  const enemyCastle = row === 3 && col === 13;

                  const isEnemyTile = col > 6;

                  const isOffenceTowerActive =
                    offenseTowerPosition.x === row &&
                    offenseTowerPosition.y === col;
                  const isDeffenceTowerActive =
                    defenseTowerPosition.x === row &&
                    defenseTowerPosition.y === col;

                  return (
                    <Box
                      bg="green.400"
                      border="1px solid black"
                      borderLeft={isMiddleLine ? "2px solid black" : "none"}
                      h="100%"
                      key={index}
                      onDrop={(e) => handleDrop(e, row, col)}
                      onDragOver={
                        myCastle || isEnemyTile ? undefined : allowDrop
                      }
                      w="100%"
                    >
                      {isOffenceTowerActive && (
                        <Box
                          alignItems="center"
                          color="white"
                          display="flex"
                          h="100%"
                          justifyContent="center"
                          w="100%"
                        >
                          <Box
                            draggable="true"
                            onClick={() => setIsSystemDrawerOpen(true)}
                            onDragStart={(e) => handleDragStart(e, "offense")}
                          >
                            <GiStoneTower color="blue" size={20} />
                          </Box>
                        </Box>
                      )}

                      {isDeffenceTowerActive && (
                        <Box
                          alignItems="center"
                          color="white"
                          display="flex"
                          h="100%"
                          justifyContent="center"
                          w="100%"
                        >
                          <Box
                            draggable="true"
                            onClick={() => setIsSystemDrawerOpen(true)}
                            onDragStart={(e) => handleDragStart(e, "defense")}
                          >
                            <GiStoneTower color="red" size={20} />
                          </Box>
                        </Box>
                      )}

                      {myCastle && (
                        <Box
                          alignItems="center"
                          color="white"
                          display="flex"
                          h="100%"
                          justifyContent="center"
                          w="100%"
                        >
                          <BiSolidCastle color="yellow" size={20} />
                        </Box>
                      )}

                      {enemyCastle && (
                        <Box
                          alignItems="center"
                          color="white"
                          display="flex"
                          h="100%"
                          justifyContent="center"
                          w="100%"
                        >
                          <BiSolidCastle color="yellow" size={20} />
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </HStack>
          </Box>
        </Box>
      </VStack>
    </DrawerRoot>
  );
};
