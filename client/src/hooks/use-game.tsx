import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { setCurrentGameId, setCurrentRosterId, queryClient, GAME_SCOPED_PREFIXES } from "@/lib/queryClient";
import type { SupportedGame, Roster } from "@shared/schema";

interface GameContextValue {
  currentGame: SupportedGame | null;
  gameSlug: string | null;
  allGames: SupportedGame[];
  isLoading: boolean;
  gameId: string | null;
  rosters: Roster[];
  currentRoster: Roster | null;
  rosterId: string | null;
  setRosterId: (id: string | null) => void;
  rostersLoading: boolean;
}

const GameContext = createContext<GameContextValue>({
  currentGame: null,
  gameSlug: null,
  allGames: [],
  isLoading: true,
  gameId: null,
  rosters: [],
  currentRoster: null,
  rosterId: null,
  setRosterId: () => {},
  rostersLoading: false,
});

export function GameProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const gameSlug = useMemo(() => {
    const match = location.match(/^\/([^/]+)/);
    if (!match) return null;
    const slug = match[1];
    if (slug === "account") return null;
    return allGames.some(g => g.slug === slug) ? slug : null;
  }, [location, allGames]);

  const currentGame = gameSlug ? allGames.find(g => g.slug === gameSlug) || null : null;
  const gameId = currentGame?.id || null;

  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);

  const { data: rosters = [], isLoading: rostersLoading } = useQuery<Roster[]>({
    queryKey: ["/api/rosters", gameId],
    enabled: !!gameId,
  });

  const rosterId = useMemo(() => {
    if (!gameId) return null;
    if (selectedRosterId && rosters.some(r => r.id === selectedRosterId)) {
      return selectedRosterId;
    }
    const mainRoster = rosters.find(r => r.slug === "main");
    return mainRoster?.id || rosters[0]?.id || null;
  }, [gameId, selectedRosterId, rosters]);

  const currentRoster = rosters.find(r => r.id === rosterId) || null;

  useEffect(() => {
    setCurrentGameId(gameId);
  }, [gameId]);

  useEffect(() => {
    setCurrentRosterId(rosterId);
  }, [rosterId]);

  const prevGameIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevGameIdRef.current !== undefined && prevGameIdRef.current !== gameId) {
      setSelectedRosterId(null);
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          if (typeof key !== "string") return false;
          return GAME_SCOPED_PREFIXES.some(prefix => key.startsWith(prefix));
        },
      });
    }
    prevGameIdRef.current = gameId;
  }, [gameId]);

  const prevRosterIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevRosterIdRef.current !== undefined && prevRosterIdRef.current !== rosterId) {
      const rosterScopedPrefixes = [
        "/api/players", "/api/schedule", "/api/player-availability",
        "/api/staff-availability", "/api/staff", "/api/attendance",
      ];
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          if (typeof key !== "string") return false;
          return rosterScopedPrefixes.some(prefix => key.startsWith(prefix));
        },
      });
    }
    prevRosterIdRef.current = rosterId;
  }, [rosterId]);

  return (
    <GameContext.Provider value={{
      currentGame, gameSlug, allGames, isLoading, gameId,
      rosters, currentRoster, rosterId,
      setRosterId: setSelectedRosterId,
      rostersLoading,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
