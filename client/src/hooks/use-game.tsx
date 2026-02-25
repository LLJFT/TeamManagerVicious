import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { setCurrentGameId } from "@/lib/queryClient";
import type { SupportedGame } from "@shared/schema";

interface GameContextValue {
  currentGame: SupportedGame | null;
  gameSlug: string | null;
  allGames: SupportedGame[];
  isLoading: boolean;
  gameId: string | null;
}

const GameContext = createContext<GameContextValue>({
  currentGame: null,
  gameSlug: null,
  allGames: [],
  isLoading: true,
  gameId: null,
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

  useEffect(() => {
    setCurrentGameId(gameId);
    return () => {
      setCurrentGameId(null);
    };
  }, [gameId]);

  return (
    <GameContext.Provider value={{ currentGame, gameSlug, allGames, isLoading, gameId }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
