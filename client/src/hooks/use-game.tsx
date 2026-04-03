import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { setCurrentGameId, setCurrentRosterId, queryClient, GAME_SCOPED_PREFIXES } from "@/lib/queryClient";
import type { SupportedGame, Roster } from "@shared/schema";

interface GameContextValue {
  currentGame: SupportedGame | null;
  gameSlug: string | null;
  fullSlug: string | null;
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
  fullSlug: null,
  allGames: [],
  isLoading: true,
  gameId: null,
  rosters: [],
  currentRoster: null,
  rosterId: null,
  setRosterId: () => {},
  rostersLoading: false,
});

const ROSTER_SUFFIXES: Record<string, string> = {
  "_academy": "academy",
  "_women": "women",
};

export function rosterUrlSlug(gameSlug: string, rosterSlug: string): string {
  if (rosterSlug === "first-team" || rosterSlug === "main") return gameSlug;
  if (rosterSlug === "academy") return `${gameSlug}_academy`;
  if (rosterSlug === "women") return `${gameSlug}_women`;
  return `${gameSlug}_${rosterSlug}`;
}

function parseCompositeSlug(urlSlug: string, allGames: SupportedGame[]): { gameSlug: string; rosterHint: string | null } | null {
  if (urlSlug === "account") return null;
  if (allGames.some(g => g.slug === urlSlug)) {
    return { gameSlug: urlSlug, rosterHint: null };
  }
  for (const [suffix, rosterType] of Object.entries(ROSTER_SUFFIXES)) {
    if (urlSlug.endsWith(suffix)) {
      const base = urlSlug.slice(0, -suffix.length);
      if (allGames.some(g => g.slug === base)) {
        return { gameSlug: base, rosterHint: rosterType };
      }
    }
  }
  return null;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const parsed = useMemo(() => {
    const match = location.match(/^\/([^/]+)/);
    if (!match) return null;
    return parseCompositeSlug(match[1], allGames);
  }, [location, allGames]);

  const gameSlug = parsed?.gameSlug || null;
  const rosterHint = parsed?.rosterHint || null;

  const fullSlug = useMemo(() => {
    const match = location.match(/^\/([^/]+)/);
    return match ? match[1] : null;
  }, [location]);

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
    if (rosterHint) {
      const hintRoster = rosters.find(r => r.slug === rosterHint);
      if (hintRoster) return hintRoster.id;
    }
    const firstTeam = rosters.find(r => r.slug === "first-team") || rosters.find(r => r.slug === "main");
    return firstTeam?.id || rosters[0]?.id || null;
  }, [gameId, selectedRosterId, rosters, rosterHint]);

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
        "/api/events", "/api/roster-roles", "/api/availability-slots",
        "/api/users", "/api/game-assignments/pending",
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
      currentGame, gameSlug, fullSlug, allGames, isLoading, gameId,
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
