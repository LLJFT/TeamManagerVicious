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
import { buildAllowedEventIds, pct, scopeGames, type EventLite, type GameLite } from './_shared';

type Hero = { id: string; name: string };
type MapType = { id: string; name: string };
type GameHero = { matchId: string; heroId: string; playerId?: string | null; opponentPlayerId?: string | null };
type GameHeroBanAction = { matchId: string; heroId: string; actionType: 'ban' | 'pick'; actingTeam?: 'a' | 'b' };
type GameMapVetoRow = { matchId: string; mapId: string; action: string; actingTeam?: 'a' | 'b' };

type Tab = 'our-bans' | 'opp-bans' | 'our-picks' | 'opp-picks' | 'map-vetoes';

export function DraftStatsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [tab, setTab] = useState<Tab>('our-bans');

  const { data: events = [] } = useQuery<EventLite[]>({ queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady });
  const { data: allGames = [] } = useQuery<GameLite[]>({ queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady });
  const { data: heroes = [] } = useQuery<Hero[]>({ queryKey: ['/api/heroes', { gameId, rosterId }], enabled: rosterReady });
  const { data: maps = [] } = useQuery<MapType[]>({ queryKey: ['/api/maps', { gameId, rosterId }], enabled: rosterReady });
  const { data: bans = [], isLoading: bL } = useQuery<GameHeroBanAction[]>({ queryKey: ['/api/hero-ban-actions', { gameId, rosterId }], enabled: rosterReady });
  const { data: vetoes = [], isLoading: vL } = useQuery<GameMapVetoRow[]>({ queryKey: ['/api/map-veto-rows', { gameId, rosterId }], enabled: rosterReady });
  const { data: gameHeroes = [], isLoading: ghL } = useQuery<GameHero[]>({ queryKey: ['/api/game-heroes', { gameId, rosterId }], enabled: rosterReady });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const scoped = useMemo(() => scopeGames(allGames, allowedEventIds, filters.opponentId), [allGames, allowedEventIds, filters.opponentId]);
  const matchIds = useMemo(() => new Set(scoped.map((g) => g.id)), [scoped]);
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const mapById = useMemo(() => new Map(maps.map((m) => [m.id, m])), [maps]);
  const matchResult = useMemo(() => new Map(scoped.map((g) => [g.id, g.result ?? null])), [scoped]);

  function aggBan(team: 'a' | 'b') {
    const m = new Map<string, { name: string; count: number; wins: number; losses: number; draws: number }>();
    for (const b of bans) {
      if (!matchIds.has(b.matchId) || b.actionType !== 'ban' || b.actingTeam !== team) continue;
      const h = heroById.get(b.heroId); if (!h) continue;
      let row = m.get(h.id);
      if (!row) { row = { name: h.name, count: 0, wins: 0, losses: 0, draws: 0 }; m.set(h.id, row); }
      row.count++;
      const r = matchResult.get(b.matchId);
      if (r === 'win') row.wins++;
      else if (r === 'loss') row.losses++;
      else if (r === 'draw') row.draws++;
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count).slice(0, 15);
  }

  function aggPick(side: 'ours' | 'opp') {
    const m = new Map<string, { name: string; count: number; wins: number; losses: number; draws: number }>();
    for (const r of gameHeroes) {
      if (!matchIds.has(r.matchId)) continue;
      const isOurs = !!r.playerId && !r.opponentPlayerId;
      const isOpp = !!r.opponentPlayerId;
      if (side === 'ours' && !isOurs) continue;
      if (side === 'opp' && !isOpp) continue;
      const h = heroById.get(r.heroId); if (!h) continue;
      let row = m.get(h.id);
      if (!row) { row = { name: h.name, count: 0, wins: 0, losses: 0, draws: 0 }; m.set(h.id, row); }
      row.count++;
      const res = matchResult.get(r.matchId);
      if (res === 'win') row.wins++;
      else if (res === 'loss') row.losses++;
      else if (res === 'draw') row.draws++;
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count).slice(0, 15);
  }

  function aggMapVeto() {
    const m = new Map<string, { name: string; count: number; wins: number; losses: number; draws: number }>();
    for (const v of vetoes) {
      if (!matchIds.has(v.matchId)) continue;
      const map = mapById.get(v.mapId); if (!map) continue;
      let row = m.get(map.id);
      if (!row) { row = { name: map.name, count: 0, wins: 0, losses: 0, draws: 0 }; m.set(map.id, row); }
      row.count++;
    }
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count).slice(0, 15);
  }

  const rows = useMemo(() => {
    switch (tab) {
      case 'our-bans': return aggBan('a');
      case 'opp-bans': return aggBan('b');
      case 'our-picks': return aggPick('ours');
      case 'opp-picks': return aggPick('opp');
      case 'map-vetoes': return aggMapVeto();
    }
  }, [tab, bans, gameHeroes, vetoes, matchIds, heroById, mapById, matchResult]);

  const isLoading = bL || ghL || vL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.drafts')} onBack={() => nav.goBack()} />
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
                <StatCard label={t('stats.matches')} value={String(scoped.length)} />
                <StatCard label={t('stats.bansLabel')} value={String(bans.filter((b) => matchIds.has(b.matchId) && b.actionType === 'ban').length)} />
                <StatCard label={t('stats.vetoes')} value={String(vetoes.filter((v) => matchIds.has(v.matchId)).length)} />
              </View>
              <FilterChips
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                options={[
                  { value: 'our-bans', label: t('stats.ourBans') },
                  { value: 'opp-bans', label: t('stats.oppBans') },
                  { value: 'our-picks', label: t('stats.ourPicks') },
                  { value: 'opp-picks', label: t('stats.oppPicks') },
                  { value: 'map-vetoes', label: t('stats.mapVetoes') },
                ]}
                testIdPrefix="draft-tab"
              />
              {rows.length === 0 ? (
                <EmptyState title={t('stats.noData')} description={t('stats.nothingMatched')} />
              ) : (
                rows.map((r, i) => (
                  <RankRow
                    key={r.id}
                    index={i}
                    label={r.name}
                    sublabel={`${r.count} ${t('stats.times')} · ${pct(r.count, scoped.length).toFixed(0)}%`}
                    wins={r.wins}
                    losses={r.losses}
                    draws={r.draws}
                    testID={`draft-row-${r.id}`}
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
