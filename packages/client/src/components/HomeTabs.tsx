import { useEntityQuery } from '@latticexyz/react';
import { Entity, getComponentValueStrict, Has } from '@latticexyz/recs';
import { decodeEntity } from '@latticexyz/store-sync/recs';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Copy,
  Trophy,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PaginationControls } from '@/components/PaginationControls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCopy } from '@/hooks/useCopy';
import { useMUD } from '@/hooks/useMUD';
import { BATTLES_PATH } from '@/Routes';
import {
  formatDateFromTimestamp,
  formatTimeFromTimestamp,
  formatWattHours,
  shortenAddress,
} from '@/utils/helpers';
import { type Battle } from '@/utils/types';

const MAX_ITEMS_PER_PAGE = 10;

const getTotalPages = (totalItems: number, itemsPerPage: number) => {
  return Math.ceil(totalItems / itemsPerPage);
};

const ActiveBattleCard = ({
  battle,
  onClick,
}: {
  battle: Battle;
  onClick: () => void;
}) => {
  return (
    <Card
      className="bg-black border-gray-800 cursor-pointer hover:bg-gray-900 mb-3"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-1 items-center">
            <Calendar className="h-3 mr-1 text-gray-400 w-3" />
            <span className="text-sm text-white">
              {formatDateFromTimestamp(battle.startTimestamp)}
            </span>
          </div>
          <ArrowRight className="h-4 text-gray-400 w-4" />
        </div>

        <div className="flex justify-between mb-2">
          <div className="flex gap-1 items-center">
            <Clock className="h-3 mr-1 text-gray-400 w-3" />
            <span className="text-sm text-white">
              {formatTimeFromTimestamp(battle.startTimestamp)} • Level{' '}
              {battle.level.toString()}
            </span>
          </div>
        </div>

        <div className="flex gap-1 items-center mb-2">
          <Users className="h-3 mr-1 text-gray-400 w-3" />
          <div className="text-sm text-white">
            <span>{battle.player1Username}</span>
            {battle.turn === battle.player1Id && (
              <Badge
                className="border-green-500 h-4 ml-1 px-1 text-green-500 text-xs"
                variant="outline"
              >
                Turn
              </Badge>
            )}
            <span className="mx-1">vs</span>
            <span>{battle.player2Username}</span>
            {battle.turn === battle.player2Id && (
              <Badge
                className="border-green-500 h-4 ml-1 px-1 text-green-500 text-xs"
                variant="outline"
              >
                Turn
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-1 items-center">
          <span className="text-sm text-white">Round {battle.roundCount}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const CompletedBattleCard = ({
  battle,
  onClick,
}: {
  battle: Battle;
  onClick: () => void;
}) => {
  return (
    <Card
      className="bg-black border-gray-800 mb-3 cursor-pointer hover:bg-gray-900"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-1 items-center">
            <Calendar className="h-3 mr-1 text-gray-400 w-3" />
            <span className="text-sm text-white">
              {formatDateFromTimestamp(battle.startTimestamp)}
            </span>
          </div>
          <ArrowRight className="h-4 text-gray-400 w-4" />
        </div>

        <div className="flex justify-between mb-2">
          <div className="flex  gap-1 items-center">
            <Clock className="h-3 mr-1 text-gray-400 w-3" />
            <span className="text-sm text-white">
              {formatTimeFromTimestamp(battle.startTimestamp)} • Level{' '}
              {battle.level.toString()}
            </span>
          </div>
        </div>

        <div className="flex gap-1 items-center mb-2">
          <Users className="h-3 mr-1 text-gray-400 w-3" />
          <span className="text-sm text-white">
            {battle.player1Username} vs {battle.player2Username}
          </span>
        </div>

        <div className="flex gap-1 items-center">
          <Trophy className="h-3 mr-1 text-gray-400 w-3" />
          <span className="font-medium text-sm text-white">
            {battle.winner === battle.player1Id
              ? battle.player1Username
              : battle.player2Username}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export const HomeTabs: React.FC = () => {
  const navigate = useNavigate();
  const { copiedText, copyToClipboard } = useCopy();
  const {
    components: {
      Battle: BattleComponent,
      HighestLevel,
      KingdomsByLevel,
      Level,
      PlayerIdToAddress,
      SavedKingdom,
      Username,
    },
  } = useMUD();

  const [currentPage, setCurrentPage] = useState(1);

  const battles = useEntityQuery([Has(BattleComponent)]).map(entity => {
    const _battle = getComponentValueStrict(BattleComponent, entity);
    const _player1Username = getComponentValueStrict(
      Username,
      _battle.player1Id as Entity,
    ).value;
    const _player2Username = getComponentValueStrict(
      Username,
      _battle.player2Id as Entity,
    ).value;

    const _level =
      getComponentValueStrict(Level, entity as Entity)?.value ?? BigInt(0);

    return {
      id: entity,
      actionCount: _battle.actionCount,
      endTimestamp: _battle.endTimestamp,
      level: _level,
      player1Id: _battle.player1Id as Entity,
      player1Username: _player1Username,
      player2Id: _battle.player2Id as Entity,
      player2Username: _player2Username,
      roundCount: _battle.roundCount,
      startTimestamp: _battle.startTimestamp,
      turn: _battle.turn as Entity,
      winner: _battle.winner as Entity,
    };
  }) as Battle[];

  const topPlayers = useEntityQuery([Has(HighestLevel)])
    .map(entity => {
      const playerLevel = getComponentValueStrict(HighestLevel, entity).value;
      const playerAddress = getComponentValueStrict(
        PlayerIdToAddress,
        entity,
      ).value;
      const playerUsername = getComponentValueStrict(Username, entity).value;

      return {
        playerAddress,
        playerLevel: Number(playerLevel),
        playerUsername,
      };
    })
    .sort((a, b) => b.playerLevel - a.playerLevel);

  const kingdomsByLevel = useEntityQuery([Has(KingdomsByLevel)])
    .map(entity => {
      const _kingdomsByLevel = getComponentValueStrict(KingdomsByLevel, entity);

      const decodedKey = decodeEntity({ level: 'uint256' }, entity);

      return _kingdomsByLevel.savedKingdomIds.map(savedKingdomId => {
        const _savedKingdom = getComponentValueStrict(
          SavedKingdom,
          savedKingdomId as Entity,
        );

        const authorUsername = getComponentValueStrict(
          Username,
          _savedKingdom.author as Entity,
        ).value;

        return {
          id: savedKingdomId,
          author: _savedKingdom.author,
          authorUsername,
          electricityBalance: _savedKingdom.electricityBalance,
          level: Number(decodedKey.level),
          losses: Number(_savedKingdom.losses),
          wins: Number(_savedKingdom.wins),
        };
      });
    })
    .flat()
    .sort(
      (a, b) => Number(b.electricityBalance) - Number(a.electricityBalance),
    );

  const activeBattles = useMemo(
    () =>
      battles
        .filter(battle => battle.endTimestamp === BigInt(0))
        .sort((a, b) => Number(b.startTimestamp) - Number(a.startTimestamp)),
    [battles],
  );

  const completedBattles = useMemo(
    () =>
      battles
        .filter(battle => battle.endTimestamp !== BigInt(0))
        .sort((a, b) => Number(b.endTimestamp) - Number(a.endTimestamp)),
    [battles],
  );

  return (
    <div className="max-w-2xl mx-auto w-full">
      <Tabs className="w-full" defaultValue="players">
        <TabsList className="bg-transparent grid grid-cols-4 w-full">
          <TabsTrigger
            className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400  data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 hover:cursor-pointer hover:text-cyan-300 text-gray-400 sm:text-sm text-xs"
            onClick={() => {
              setCurrentPage(1);
            }}
            value="players"
          >
            <span className="sm:inline hidden">Top Players</span>
            <span className="sm:hidden">Players</span> ({topPlayers.length})
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400  data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 hover:cursor-pointer hover:text-cyan-300 text-gray-400 sm:text-sm text-xs"
            onClick={() => {
              setCurrentPage(1);
            }}
            value="kingdoms"
          >
            <span className="sm:inline hidden">Top Kingdoms</span>
            <span className="sm:hidden">Kingdoms</span> (
            {kingdomsByLevel.length})
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400  data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 hover:cursor-pointer hover:text-cyan-300 text-gray-400 sm:text-sm text-xs"
            onClick={() => {
              setCurrentPage(1);
            }}
            value="active"
          >
            Active ({activeBattles.length})
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:border-b-2 data-[state=active]:border-cyan-400  data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 hover:cursor-pointer hover:text-cyan-300 text-gray-400 sm:text-sm text-xs"
            onClick={() => {
              setCurrentPage(1);
            }}
            value="completed"
          >
            Completed ({completedBattles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="players">
          <TooltipProvider>
            {/* Desktop view for players */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-cyan-400">Rank</TableHead>
                    <TableHead className="text-cyan-400">Player</TableHead>
                    <TableHead className="text-cyan-400">
                      Highest Level
                    </TableHead>
                    <TableHead className="text-cyan-400">Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPlayers
                    .slice(
                      (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                      currentPage * MAX_ITEMS_PER_PAGE,
                    )
                    .map((player, i) => (
                      <TableRow
                        key={player.playerAddress}
                        className="border-gray-800 hover:bg-gray-900"
                      >
                        <TableCell className="font-medium">
                          {i +
                            1 +
                            currentPage * MAX_ITEMS_PER_PAGE -
                            MAX_ITEMS_PER_PAGE}
                        </TableCell>
                        <TableCell>{player.playerUsername}</TableCell>
                        <TableCell>{player.playerLevel}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{shortenAddress(player.playerAddress)}</span>
                            <Tooltip>
                              <TooltipTrigger
                                className="h-6 hover:cursor-pointer hover:text-white text-gray-400 w-6"
                                onClick={() =>
                                  copyToClipboard(player.playerAddress)
                                }
                              >
                                {copiedText === player.playerAddress ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {copiedText === player.playerAddress
                                    ? 'Copied!'
                                    : 'Copy address'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              <PaginationControls
                currentPage={currentPage}
                onPageChange={(newPage: number) => {
                  setCurrentPage(newPage);
                }}
                totalPages={getTotalPages(
                  topPlayers.length,
                  MAX_ITEMS_PER_PAGE,
                )}
              />
            </div>

            {/* Mobile view for players */}
            <div className="md:hidden">
              {topPlayers
                .slice(
                  (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                  currentPage * MAX_ITEMS_PER_PAGE,
                )
                .map((player, i) => (
                  <Card
                    key={player.playerAddress}
                    className="bg-gray-900 border-gray-800 hover:border-cyan-900 mb-3"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="gap-2 flex items-center">
                          <span className="font-medium text-white">
                            #
                            {i +
                              1 +
                              currentPage * MAX_ITEMS_PER_PAGE -
                              MAX_ITEMS_PER_PAGE}
                          </span>
                          <span className="text-white">
                            {player.playerUsername}
                          </span>
                        </div>
                        <span className="text-sm text-white">
                          Highest Level: {player.playerLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">
                          {shortenAddress(player.playerAddress)}
                        </span>
                        <Button
                          className="h-6 hover:text-white text-gray-400 w-6"
                          onClick={() => copyToClipboard(player.playerAddress)}
                          size="icon"
                          variant="ghost"
                        >
                          {copiedText === player.playerAddress ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              <PaginationControls
                currentPage={currentPage}
                onPageChange={(newPage: number) => {
                  setCurrentPage(newPage);
                }}
                totalPages={getTotalPages(
                  topPlayers.length,
                  MAX_ITEMS_PER_PAGE,
                )}
              />
            </div>
          </TooltipProvider>
        </TabsContent>

        <TabsContent value="kingdoms" className="mt-6">
          {/* Desktop view for top kingdoms */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-cyan-400">Level</TableHead>
                  <TableHead className="text-cyan-400">Author</TableHead>
                  <TableHead className="text-cyan-400">
                    Current Balance
                  </TableHead>
                  <TableHead className="text-cyan-400">Wins</TableHead>
                  <TableHead className="text-cyan-400">Losses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kingdomsByLevel
                  .slice(
                    (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                    currentPage * MAX_ITEMS_PER_PAGE,
                  )
                  .map(kingdom => (
                    <TableRow key={kingdom.id} className="border-gray-800">
                      <TableCell className="font-medium">
                        {kingdom.level.toString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {kingdom.authorUsername}
                      </TableCell>
                      <TableCell>
                        {formatWattHours(kingdom.electricityBalance)}
                      </TableCell>
                      <TableCell className="text-green-400">
                        {kingdom.wins}
                      </TableCell>
                      <TableCell className="text-red-400">
                        {kingdom.losses}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <PaginationControls
              currentPage={currentPage}
              onPageChange={(newPage: number) => {
                setCurrentPage(newPage);
              }}
              totalPages={getTotalPages(
                kingdomsByLevel.length,
                MAX_ITEMS_PER_PAGE,
              )}
            />
          </div>

          {/* Mobile view for top kingdoms */}
          <div className="md:hidden">
            {kingdomsByLevel
              .slice(
                (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                currentPage * MAX_ITEMS_PER_PAGE,
              )
              .map(kingdom => (
                <Card
                  key={kingdom.id}
                  className="bg-gray-900 border-gray-800 mb-3"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-lg text-white">
                        {kingdom.authorUsername}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-gray-400">Level</div>
                        <div className="font-medium text-white">
                          {kingdom.level.toString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Current Balance</div>
                        <div className="font-medium text-white">
                          {formatWattHours(kingdom.electricityBalance)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Wins</div>
                        <div className="font-medium text-green-400">
                          {kingdom.wins}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Losses</div>
                        <div className="font-medium text-red-400">
                          {kingdom.losses}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

            <PaginationControls
              currentPage={currentPage}
              onPageChange={(newPage: number) => {
                setCurrentPage(newPage);
              }}
              totalPages={getTotalPages(
                kingdomsByLevel.length,
                MAX_ITEMS_PER_PAGE,
              )}
            />
          </div>
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {/* Desktop view for active battles */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-cyan-400">Date</TableHead>
                  <TableHead className="text-cyan-400">Start Time</TableHead>
                  <TableHead className="text-cyan-400">Level</TableHead>
                  <TableHead className="text-cyan-400">Players</TableHead>
                  <TableHead className="text-cyan-400">Round</TableHead>
                  <TableHead className="text-cyan-400 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBattles
                  .slice(
                    (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                    currentPage * MAX_ITEMS_PER_PAGE,
                  )
                  .map(battle => (
                    <TableRow
                      key={battle.id}
                      className="border-gray-800 cursor-pointer hover:bg-gray-900"
                      onClick={() => navigate(`${BATTLES_PATH}/${battle.id}`)}
                    >
                      <TableCell>
                        {formatDateFromTimestamp(battle.startTimestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Clock className="h-3 mr-1 text-gray-400 w-3" />
                          {formatTimeFromTimestamp(battle.startTimestamp)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-1 items-center">
                          {battle.level.toString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex gap-2 items-center">
                            <span>{battle.player1Username}</span>
                            {battle.turn === battle.player1Id && (
                              <Badge
                                className="border-green-500 h-5 px-1 text-green-500 text-xs"
                                variant="outline"
                              >
                                Turn
                              </Badge>
                            )}
                          </div>
                          <span className="text-gray-400">vs</span>
                          <div className="flex gap-2 items-center">
                            <span>{battle.player2Username}</span>
                            {battle.turn === battle.player2Id && (
                              <Badge
                                className="border-green-500 h-5 px-1 text-green-500 text-xs"
                                variant="outline"
                              >
                                Turn
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{battle.roundCount}</TableCell>
                      <TableCell className="text-right">
                        <ArrowRight className="h-4 ml-auto text-gray-400 w-4" />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <PaginationControls
              currentPage={currentPage}
              onPageChange={(newPage: number) => {
                setCurrentPage(newPage);
              }}
              totalPages={getTotalPages(
                activeBattles.length,
                MAX_ITEMS_PER_PAGE,
              )}
            />
          </div>

          {/* Mobile view for active battles */}
          <div className="md:hidden">
            {activeBattles
              .slice(
                (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                currentPage * MAX_ITEMS_PER_PAGE,
              )
              .map(battle => (
                <ActiveBattleCard
                  key={battle.id}
                  battle={battle}
                  onClick={() => navigate(`${BATTLES_PATH}/${battle.id}`)}
                />
              ))}

            <PaginationControls
              currentPage={currentPage}
              onPageChange={(newPage: number) => {
                setCurrentPage(newPage);
              }}
              totalPages={getTotalPages(
                activeBattles.length,
                MAX_ITEMS_PER_PAGE,
              )}
            />
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {/* Desktop view for completed battles */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-cyan-400">Date</TableHead>
                  <TableHead className="text-cyan-400">Start Time</TableHead>
                  <TableHead className="text-cyan-400">Level</TableHead>
                  <TableHead className="text-cyan-400">Players</TableHead>
                  <TableHead className="text-cyan-400">Winner</TableHead>
                  <TableHead className="text-cyan-400 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedBattles
                  .slice(
                    (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                    currentPage * MAX_ITEMS_PER_PAGE,
                  )
                  .map(battle => (
                    <TableRow
                      key={battle.id}
                      className="border-gray-800 cursor-pointer hover:bg-gray-900"
                      onClick={() => navigate(`${BATTLES_PATH}/${battle.id}`)}
                    >
                      <TableCell>
                        {formatDateFromTimestamp(battle.startTimestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Clock className="h-3 mr-1 text-gray-400 w-3" />
                          {formatTimeFromTimestamp(battle.startTimestamp)}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex gap-1 items-center">
                          {battle.level.toString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{battle.player1Username}</span>
                          <span className="text-gray-400">vs</span>
                          <span>{battle.player2Username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {battle.winner === battle.player1Id
                          ? battle.player1Username
                          : battle.player2Username}
                      </TableCell>
                      <TableCell className="text-right">
                        <ArrowRight className="h-4 ml-auto text-gray-400 w-4" />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <PaginationControls
              currentPage={currentPage}
              onPageChange={(newPage: number) => {
                setCurrentPage(newPage);
              }}
              totalPages={getTotalPages(
                completedBattles.length,
                MAX_ITEMS_PER_PAGE,
              )}
            />
          </div>

          {/* Mobile view for completed battles */}
          <div className="md:hidden">
            {completedBattles
              .slice(
                (currentPage - 1) * MAX_ITEMS_PER_PAGE,
                currentPage * MAX_ITEMS_PER_PAGE,
              )
              .map(battle => (
                <CompletedBattleCard
                  key={battle.id}
                  battle={battle}
                  onClick={() => navigate(`${BATTLES_PATH}/${battle.id}`)}
                />
              ))}

            <PaginationControls
              currentPage={currentPage}
              onPageChange={(newPage: number) => {
                setCurrentPage(newPage);
              }}
              totalPages={getTotalPages(
                completedBattles.length,
                MAX_ITEMS_PER_PAGE,
              )}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
