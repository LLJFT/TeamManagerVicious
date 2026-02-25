import { QueryClient, QueryFunction } from "@tanstack/react-query";

let _currentGameId: string | null = null;

export function setCurrentGameId(gameId: string | null) {
  _currentGameId = gameId;
}

export function getCurrentGameId() {
  return _currentGameId;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const GAME_SCOPED_PREFIXES = [
  "/api/players", "/api/events", "/api/games", "/api/attendance",
  "/api/staff", "/api/schedule", "/api/team-notes", "/api/off-days",
  "/api/game-modes", "/api/maps", "/api/seasons", "/api/stat-fields",
  "/api/player-game-stats", "/api/player-availability", "/api/staff-availability",
  "/api/availability-slots", "/api/roster-roles", "/api/chat",
  "/api/all-games", "/api/all-games-stats", "/api/player-stats-summary",
  "/api/settings",
];

function shouldAppendGameId(url: string): boolean {
  return GAME_SCOPED_PREFIXES.some(prefix => url.startsWith(prefix));
}

function appendGameId(url: string, gameId: string): string {
  if (url.includes("gameId=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}gameId=${gameId}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let finalUrl = url;
  if (_currentGameId && shouldAppendGameId(url)) {
    finalUrl = appendGameId(url, _currentGameId);
  }

  const res = await fetch(finalUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url: string;

    if (queryKey.length === 1) {
      url = queryKey[0] as string;
    } else if (queryKey[0] === "/api/schedule" && queryKey.length >= 3) {
      const [path, weekStart, weekEnd] = queryKey;
      url = `${path}?weekStartDate=${weekStart}&weekEndDate=${weekEnd}`;
    } else {
      url = queryKey[0] as string;
      const rest = queryKey.slice(1);
      if (rest.length > 0 && typeof rest[0] === "string" && rest[0].startsWith("/")) {
        url = rest.reduce((acc: string, seg) => `${acc}/${seg}`, url as string) as string;
      }
    }

    if (_currentGameId && shouldAppendGameId(url)) {
      url = appendGameId(url, _currentGameId);
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
