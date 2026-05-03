import type { AnalyticsFilters } from '@/components/AnalyticsFiltersBar';
import { isWithinRange } from '@/components/AnalyticsFiltersBar';

export type EventLite = { id: string; date?: string | null; result?: string | null; opponentName?: string | null; seasonId?: string | null };
export type GameLite = { id: string; eventId: string | null; opponentId?: string | null; result?: string | null; mapId?: string | null; gameModeId?: string | null; gameCode?: string | null; score?: string | null };

export type MatchOutcome = 'win' | 'loss' | 'draw';
export function toOutcome(r: string | null | undefined): MatchOutcome | null {
  return r === 'win' || r === 'loss' || r === 'draw' ? r : null;
}

export function pct(n: number, d: number) {
  if (!d) return 0;
  return (n / d) * 100;
}

export function buildAllowedEventIds(events: EventLite[], filters: AnalyticsFilters): Set<string> {
  const ids = new Set<string>();
  for (const e of events) {
    if (filters.range !== 'all' && !isWithinRange(e.date, filters.range)) continue;
    ids.add(e.id);
  }
  return ids;
}

export function scopeGames<G extends { eventId: string | null; opponentId?: string | null }>(
  games: G[],
  allowedEventIds: Set<string>,
  opponentId: string,
): G[] {
  return games.filter((g) => {
    if (!g.eventId || !allowedEventIds.has(g.eventId)) return false;
    if (opponentId !== '__all__' && g.opponentId !== opponentId) return false;
    return true;
  });
}

export function tally<T>(arr: T[], pickResult: (x: T) => string | null | undefined) {
  let wins = 0, losses = 0, draws = 0;
  for (const x of arr) {
    const r = pickResult(x);
    if (r === 'win') wins++;
    else if (r === 'loss') losses++;
    else if (r === 'draw') draws++;
  }
  return { wins, losses, draws, total: wins + losses + draws };
}
