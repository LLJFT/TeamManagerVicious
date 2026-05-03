import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  setCurrentGameId,
  setCurrentRosterId,
} from '@/api/queries';

export type SupportedGame = {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
};

export type Roster = {
  id: string;
  gameId: string;
  name: string;
  slug?: string;
  customName?: string | null;
  code?: string | null;
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';

const GAME_KEY = 'game.currentGameId';
const ROSTER_KEY = 'game.currentRosterId';

export function useGame() {
  const { data: games = [], isLoading: gamesLoading } = useQuery<SupportedGame[]>({
    queryKey: ['/api/supported-games'],
  });

  const [storedGame, setStoredGame] = useState<string | null>(null);
  const [storedRoster, setStoredRoster] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(GAME_KEY).then((v) => v && setStoredGame(v));
    AsyncStorage.getItem(ROSTER_KEY).then((v) => v && setStoredRoster(v));
  }, []);

  const currentGame = useMemo(() => {
    if (storedGame) {
      const g = games.find((x) => x.id === storedGame);
      if (g) return g;
    }
    return games[0] ?? null;
  }, [games, storedGame]);

  const gameId = currentGame?.id ?? null;

  const { data: rosters = [], isLoading: rostersLoading } = useQuery<Roster[]>({
    queryKey: ['/api/rosters', { gameId }],
    enabled: !!gameId,
  });

  const currentRoster = useMemo(() => {
    if (storedRoster) {
      const r = rosters.find((x) => x.id === storedRoster);
      if (r) return r;
    }
    return rosters[0] ?? null;
  }, [rosters, storedRoster]);

  const rosterId = currentRoster?.id ?? null;

  useEffect(() => {
    setCurrentGameId(gameId);
  }, [gameId]);
  useEffect(() => {
    setCurrentRosterId(rosterId);
  }, [rosterId]);

  const selectGame = useCallback(async (id: string) => {
    setStoredGame(id);
    setStoredRoster(null);
    await AsyncStorage.setItem(GAME_KEY, id);
    await AsyncStorage.removeItem(ROSTER_KEY);
  }, []);
  const selectRoster = useCallback(async (id: string) => {
    setStoredRoster(id);
    await AsyncStorage.setItem(ROSTER_KEY, id);
  }, []);

  return {
    games,
    rosters,
    currentGame,
    currentRoster,
    gameId,
    rosterId,
    rosterReady: !!(gameId && rosterId),
    isLoading: gamesLoading || rostersLoading,
    selectGame,
    selectRoster,
  };
}
