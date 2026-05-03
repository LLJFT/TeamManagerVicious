import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AnalyticsFiltersBar,
  AppHeader,
  EmptyState,
  FilterChips,
  RankRow,
  ScopePicker,
  SkeletonList,
  StatCard,
  Text,
} from '@/components';
import { useGame } from '@/hooks/useGame';
import { defaultFilters, type AnalyticsFilters } from '@/components/AnalyticsFiltersBar';
import { buildAllowedEventIds, scopeGames, type EventLite, type GameLite } from './_shared';

type Player = { id: string; name: string; role?: string | null };
type Hero = { id: string; name: string };
type MatchParticipant = { matchId: string; playerId: string };
type PlayerGameStat = { matchId: string; playerId: string; statFieldId: string; value: number };
type StatField = { id: string; name: string };
type GameHero = { matchId: string; heroId: string; playerId?: string | null };

type Tab = 'attendance' | 'mostPicked';

export function PlayerLeaderboardScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [tab, setTab] = useState<Tab>('attendance');

  const { data: events = [] } = useQuery<EventLite[]>({ queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady });
  const { data: allGames = [] } = useQuery<GameLite[]>({ queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady });
  const { data: players = [] } = useQuery<Player[]>({ queryKey: ['/api/players', { gameId, rosterId }], enabled: rosterReady });
  const { data: participants = [], isLoading: pL } = useQuery<MatchParticipant[]>({ queryKey: ['/api/match-participants', { gameId, rosterId }], enabled: rosterReady });
  const { data: gameHeroes = [], isLoading: ghL } = useQuery<GameHero[]>({ queryKey: ['/api/game-heroes', { gameId, rosterId }], enabled: rosterReady });
  const { data: heroes = [] } = useQuery<Hero[]>({ queryKey: ['/api/heroes', { gameId, rosterId }], enabled: rosterReady });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const scoped = useMemo(() => scopeGames(allGames, allowedEventIds, filters.opponentId), [allGames, allowedEventIds, filters.opponentId]);
  const matchIds = useMemo(() => new Set(scoped.map((g) => g.id)), [scoped]);
  const matchResult = useMemo(() => new Map(scoped.map((g) => [g.id, g.result ?? null])), [scoped]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  const attendance = useMemo(() => {
    const m = new Map<string, { player: Player; matches: number; wins: number; losses: number; draws: number }>();
    for (const p of participants) {
      if (!matchIds.has(p.matchId)) continue;
      const player = playerById.get(p.playerId); if (!player) continue;
      let row = m.get(p.playerId);
      if (!row) { row = { player, matches: 0, wins: 0, losses: 0, draws: 0 }; m.set(p.playerId, row); }
      row.matches++;
      const res = matchResult.get(p.matchId);
      if (res === 'win') row.wins++;
      else if (res === 'loss') row.losses++;
      else if (res === 'draw') row.draws++;
    }
    return Array.from(m.values()).sort((a, b) => b.matches - a.matches);
  }, [participants, matchIds, playerById, matchResult]);

  const mostPicked = useMemo(() => {
    const m = new Map<string, { player: Player; hero: Hero; picks: number; wins: number; losses: number; draws: number }>();
    for (const r of gameHeroes) {
      if (!matchIds.has(r.matchId) || !r.playerId) continue;
      const player = playerById.get(r.playerId); const hero = heroById.get(r.heroId);
      if (!player || !hero) continue;
      const key = `${player.id}::${hero.id}`;
      let row = m.get(key);
      if (!row) { row = { player, hero, picks: 0, wins: 0, losses: 0, draws: 0 }; m.set(key, row); }
      row.picks++;
      const res = matchResult.get(r.matchId);
      if (res === 'win') row.wins++;
      else if (res === 'loss') row.losses++;
      else if (res === 'draw') row.draws++;
    }
    return Array.from(m.values()).sort((a, b) => b.picks - a.picks).slice(0, 20);
  }, [gameHeroes, matchIds, playerById, heroById, matchResult]);

  const isLoading = pL || ghL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.playerLeaderboard')} onBack={() => nav.goBack()} />
      <ScopePicker />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <AnalyticsFiltersBar value={filters} onChange={setFilters} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {!rosterReady ? (
            <EmptyState title={t('stats.pickScope')} />
          ) : isLoading ? (
            <SkeletonList rows={4} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <StatCard label={t('stats.players')} value={String(players.length)} />
                <StatCard label={t('stats.matches')} value={String(scoped.length)} />
              </View>
              <FilterChips
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                options={[
                  { value: 'attendance', label: t('stats.attendance') },
                  { value: 'mostPicked', label: t('stats.mostPickedHero') },
                ]}
                testIdPrefix="pl-tab"
              />
              {tab === 'attendance' ? (
                attendance.length === 0 ? (
                  <EmptyState title={t('stats.noParticipants')} />
                ) : (
                  attendance.map((r, i) => (
                    <RankRow
                      key={r.player.id}
                      index={i}
                      label={r.player.name}
                      sublabel={`${r.matches} ${t('stats.matches').toLowerCase()}${r.player.role ? ' · ' + r.player.role : ''}`}
                      wins={r.wins}
                      losses={r.losses}
                      draws={r.draws}
                      testID={`pl-att-${r.player.id}`}
                    />
                  ))
                )
              ) : mostPicked.length === 0 ? (
                <EmptyState title={t('stats.noPicksRecorded')} />
              ) : (
                mostPicked.map((r, i) => (
                  <RankRow
                    key={`${r.player.id}-${r.hero.id}`}
                    index={i}
                    label={`${r.player.name} · ${r.hero.name}`}
                    sublabel={`${r.picks} ${t('stats.picks')}`}
                    wins={r.wins}
                    losses={r.losses}
                    draws={r.draws}
                    testID={`pl-pick-${r.player.id}-${r.hero.id}`}
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
