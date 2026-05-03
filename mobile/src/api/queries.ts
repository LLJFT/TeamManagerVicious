import { QueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

let _currentGameId: string | null = null;
let _currentRosterId: string | null = null;

export function setCurrentGameId(id: string | null) {
  _currentGameId = id;
}
export function getCurrentGameId() {
  return _currentGameId;
}
export function setCurrentRosterId(id: string | null) {
  _currentRosterId = id;
}
export function getCurrentRosterId() {
  return _currentRosterId;
}

const GAME_SCOPED_PREFIXES = [
  '/api/players', '/api/events', '/api/games', '/api/attendance',
  '/api/staff', '/api/schedule', '/api/team-notes', '/api/off-days',
  '/api/game-modes', '/api/maps', '/api/seasons', '/api/stat-fields',
  '/api/player-game-stats', '/api/player-availability', '/api/staff-availability',
  '/api/availability-slots', '/api/roster-roles', '/api/chat',
  '/api/all-games', '/api/all-games-stats', '/api/player-stats-summary',
  '/api/event-categories', '/api/event-sub-types',
  '/api/sides', '/api/heroes', '/api/hero-role-configs', '/api/opponents',
  '/api/opponent-players', '/api/opponent-player-stats', '/api/opponent-player-game-stats',
  '/api/hero-ban-systems', '/api/map-veto-systems',
  '/api/settings', '/api/rosters', '/api/game-config', '/api/game-templates',
  '/api/users', '/api/roles', '/api/activity-logs',
  '/api/game-assignments/pending',
  '/api/hero-ban-actions', '/api/map-veto-rows', '/api/game-heroes',
  '/api/match-participants', '/api/game-rounds',
];
const GAME_SCOPED_ONLY_PREFIXES = [
  '/api/heroes', '/api/maps', '/api/game-modes', '/api/hero-role-configs',
];

function shouldScope(url: string) {
  return GAME_SCOPED_PREFIXES.some((p) => url.startsWith(p));
}
function isGameOnly(url: string) {
  return GAME_SCOPED_ONLY_PREFIXES.some((p) => url.startsWith(p));
}

function appendScope(url: string, gameId: string, rosterId: string | null) {
  if (url.includes('gameId=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  let out = `${url}${sep}gameId=${encodeURIComponent(gameId)}`;
  if (isGameOnly(url)) return out;
  if (rosterId && !url.includes('rosterId=')) {
    out += `&rosterId=${encodeURIComponent(rosterId)}`;
  }
  return out;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        let url = queryKey[0] as string;
        let scopedGameId: string | null = null;
        let scopedRosterId: string | null = null;
        const extraParams: Record<string, string> = {};

        for (const seg of queryKey.slice(1)) {
          if (seg == null) continue;
          if (typeof seg === 'string') {
            if (seg.startsWith('/')) url = `${url}${seg}`;
            else if (seg.length > 0) url = `${url}/${encodeURIComponent(seg)}`;
          } else if (typeof seg === 'number') {
            url = `${url}/${seg}`;
          } else if (typeof seg === 'object' && !Array.isArray(seg)) {
            const obj = seg as Record<string, unknown>;
            for (const [k, v] of Object.entries(obj)) {
              if (v == null) continue;
              if (k === 'gameId' && typeof v === 'string') scopedGameId = v;
              else if (k === 'rosterId' && typeof v === 'string') scopedRosterId = v;
              else extraParams[k] = String(v);
            }
          }
        }

        const effectiveGameId = scopedGameId ?? _currentGameId;
        const effectiveRosterId = scopedRosterId ?? _currentRosterId;
        if (effectiveGameId && shouldScope(url)) {
          url = appendScope(url, effectiveGameId, effectiveRosterId);
        }
        for (const [k, v] of Object.entries(extraParams)) {
          const sep = url.includes('?') ? '&' : '?';
          url = `${url}${sep}${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        }

        return apiRequest(url);
      },
      retry: 1,
      staleTime: 30_000,
    },
  },
});
