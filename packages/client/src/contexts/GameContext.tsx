import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Address } from 'viem';

import { useMUD } from '../MUDContext';
import { type Game } from '../utils/types';

type GameContextType = {
  game: Game | null;
  isRefreshing: boolean;
  refreshGame: () => Promise<void>;
};

const GameContext = createContext<GameContextType>({
  game: null,
  isRefreshing: false,
  refreshGame: async () => {},
});

export type GameProviderProps = {
  children: ReactNode;
  gameId: Entity;
};

export const GameProvider = ({
  children,
  gameId,
}: GameProviderProps): JSX.Element => {
  const {
    components: { Game: GameComponent, Username },
  } = useMUD();

  const [game, setGame] = useState<Game | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(true);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    const _game = getComponentValue(GameComponent, gameId as Entity);
    if (_game) {
      const player1Entity = encodeEntity(
        { playerAddress: 'address' },
        { playerAddress: _game.player1Address as Address },
      );
      const player2Entity = encodeEntity(
        { playerAddress: 'address' },
        { playerAddress: _game.player2Address as Address },
      );
      const _player1Username = getComponentValueStrict(
        Username,
        player1Entity,
      ).value;
      const _player2Username = getComponentValueStrict(
        Username,
        player2Entity,
      ).value;

      setGame({
        id: gameId,
        actionCount: _game.actionCount,
        endTimestamp: _game.endTimestamp,
        player1Address: _game.player1Address as Address,
        player1Username: _player1Username,
        player2Address: _game.player2Address as Address,
        player2Username: _player2Username,
        roundCount: _game.roundCount,
        startTimestamp: _game.startTimestamp,
        turn: _game.turn as Address,
        winner: _game.winner as Address,
      });
    }
    setIsLoadingGame(false);
  }, [GameComponent, gameId, Username]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  return (
    <GameContext.Provider
      value={{
        game,
        isRefreshing: isLoadingGame,
        refreshGame: fetchGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => useContext(GameContext);
