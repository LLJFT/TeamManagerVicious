import { QueryClient, QueryFunction } from "@tanstack/react-query";

let _currentGameId: string | null = null;
let _currentRosterId: string | null = null;

export function setCurrentGameId(gameId: string | null) {
  _currentGameId = gameId;
}

export function getCurrentGameId() {
  return _currentGameId;
}

export function setCurrentRosterId(rosterId: string | null) {
  _currentRosterId = rosterId;
}

export function getCurrentRosterId() {
  return _currentRosterId;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const GAME_SCOPED_PREFIXES = [
  "/api/players", "/api/events", "/api/games", "/api/attendance",
  "/api/staff", "/api/schedule", "/api/team-notes", "/api/off-days",
  "/api/game-modes", "/api/maps", "/api/seasons", "/api/stat-fields",
  "/api/player-game-stats", "/api/player-availability", "/api/staff-availability",
  "/api/availability-slots", "/api/roster-roles", "/api/chat",
  "/api/all-games", "/api/all-games-stats", "/api/player-stats-summary",
  "/api/event-categories", "/api/event-sub-types",
  "/api/sides", "/api/heroes", "/api/hero-role-configs", "/api/opponents",
  "/api/hero-ban-systems", "/api/map-veto-systems",
  "/api/settings", "/api/rosters", "/api/game-config", "/api/game-templates",
  "/api/users", "/api/roles", "/api/activity-logs",
  "/api/game-assignments/pending",
  "/api/hero-ban-actions", "/api/map-veto-rows", "/api/game-heroes",
];

function shouldAppendGameId(url: string): boolean {
  return GAME_SCOPED_PREFIXES.some(prefix => url.startsWith(prefix));
}

const GAME_SCOPED_ONLY_PREFIXES = [
  "/api/heroes",
  "/api/maps",
  "/api/game-modes",
  "/api/hero-role-configs",
];

function isGameScopedOnly(url: string): boolean {
  return GAME_SCOPED_ONLY_PREFIXES.some(prefix => url.startsWith(prefix));
}

function appendGameId(url: string, gameId: string, rosterId?: string | null): string {
  if (url.includes("gameId=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  let result = `${url}${separator}gameId=${gameId}`;
  if (isGameScopedOnly(url)) return result;
  const effectiveRoster = rosterId ?? _currentRosterId;
  if (effectiveRoster && !url.includes("rosterId=")) {
    result += `&rosterId=${effectiveRoster}`;
  }
  return result;
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
    let scopedGameId: string | null = null;
    let scopedRosterId: string | null = null;

    if (queryKey.length === 1) {
      url = queryKey[0] as string;
    } else if (queryKey[0] === "/api/schedule" && queryKey.length >= 3) {
      const [path, weekStart, weekEnd] = queryKey;
      url = `${path}?weekStartDate=${weekStart}&weekEndDate=${weekEnd}`;
    } else {
      // Multi-segment keys: ["/api/foo", id, "subpath"] => "/api/foo/<id>/subpath".
      // Each non-object string segment is appended as a path part. A bare
      // segment (no leading "/") is treated as an id; one that already
      // starts with "/" is appended as-is. Object segments are query-param
      // bags handled below — never part of the URL path.
      url = queryKey[0] as string;
      for (const seg of queryKey.slice(1)) {
        if (typeof seg !== "string") continue;
        if (seg.startsWith("/")) {
          url = `${url}${seg}`;
        } else if (seg.length > 0) {
          url = `${url}/${seg}`;
        }
      }
    }

    for (const seg of queryKey.slice(1)) {
      if (seg && typeof seg === "object" && !Array.isArray(seg)) {
        const s = seg as Record<string, unknown>;
        if (typeof s.gameId === "string") scopedGameId = s.gameId;
        if (typeof s.rosterId === "string") scopedRosterId = s.rosterId;
      }
    }

    const effectiveGameId = scopedGameId ?? _currentGameId;
    if (effectiveGameId && shouldAppendGameId(url)) {
      url = appendGameId(url, effectiveGameId, scopedRosterId);
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
