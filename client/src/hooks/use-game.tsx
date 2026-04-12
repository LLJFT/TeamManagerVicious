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
  rosterCodeInvalid: boolean;
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
  rosterCodeInvalid: false,
});

export function rosterUrlSlug(gameSlug: string, roster: Roster): string {
  if (roster.code) return `${gameSlug}/${roster.code}`;
  return `${gameSlug}/${roster.id}`;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: allGames = [], isLoading } = useQuery<SupportedGame[]>({
    queryKey: ["/api/supported-games"],
  });

  const parsed = useMemo(() => {
    const segments = location.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const firstSeg = segments[0];
    if (firstSeg === "account" || firstSeg === "dashboard" || firstSeg === "calendar" ||
        firstSeg === "users" || firstSeg === "roles" || firstSeg === "game-access" ||
        firstSeg === "org-chat" || firstSeg === "settings") return null;

    const game = allGames.find(g => g.slug === firstSeg);
    if (!game) return null;

    const rosterCode = segments.length >= 2 ? segments[1] : null;
    return { gameSlug: firstSeg, rosterCode };
  }, [location, allGames]);

  const gameSlug = parsed?.gameSlug || null;
  const rosterCode = parsed?.rosterCode || null;

  const fullSlug = useMemo(() => {
    if (!gameSlug) return null;
    if (rosterCode) return `${gameSlug}/${rosterCode}`;
    return gameSlug;
  }, [gameSlug, rosterCode]);

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
    if (rosterCode) {
      const codeRoster = rosters.find(r => r.code === rosterCode);
      if (codeRoster) return codeRoster.id;
      const idRoster = rosters.find(r => r.id === rosterCode);
      if (idRoster) return idRoster.id;
    }
    return rosters[0]?.id || null;
  }, [gameId, selectedRosterId, rosters, rosterCode]);

  const currentRoster = rosters.find(r => r.id === rosterId) || null;

  const rosterCodeInvalid = useMemo(() => {
    if (!rosterCode || !gameId || rostersLoading || rosters.length === 0) return false;
    return !rosters.some(r => r.code === rosterCode || r.id === rosterCode);
  }, [rosterCode, gameId, rostersLoading, rosters]);

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
      rostersLoading, rosterCodeInvalid,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
