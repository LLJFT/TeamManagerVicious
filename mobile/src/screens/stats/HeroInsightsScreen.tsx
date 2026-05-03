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
  Card,
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

type Hero = { id: string; name: string; role?: string | null; imageUrl?: string | null };
type GameHero = { id: string; matchId: string; heroId: string; playerId?: string | null; opponentPlayerId?: string | null };
type GameHeroBanAction = { id: string; matchId: string; heroId: string; actionType: 'ban' | 'pick'; actingTeam?: 'a' | 'b' };

type Tab = 'priority' | 'picks' | 'bans';

export function HeroInsightsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [tab, setTab] = useState<Tab>('priority');

  const { data: events = [], isLoading: evL } = useQuery<EventLite[]>({
    queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: allGames = [], isLoading: gL } = useQuery<GameLite[]>({
    queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: heroes = [] } = useQuery<Hero[]>({
    queryKey: ['/api/heroes', { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: gameHeroRows = [], isLoading: ghL } = useQuery<GameHero[]>({
    queryKey: ['/api/game-heroes', { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: bans = [], isLoading: bL } = useQuery<GameHeroBanAction[]>({
    queryKey: ['/api/hero-ban-actions', { gameId, rosterId }], enabled: rosterReady,
  });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const scoped = useMemo(() => scopeGames(allGames, allowedEventIds, filters.opponentId), [allGames, allowedEventIds, filters.opponentId]);
  const matchIds = useMemo(() => new Set(scoped.map((g) => g.id)), [scoped]);
  const matchResult = useMemo(() => new Map(scoped.map((g) => [g.id, g.result ?? null])), [scoped]);
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const totalMatches = scoped.length;

  const aggregates = useMemo(() => {
    type Agg = { hero: Hero; picks: number; bans: number; wins: number; losses: number; draws: number; matches: Set<string> };
    const map = new Map<string, Agg>();
    const ensure = (id: string) => {
      const h = heroById.get(id); if (!h) return null;
      if (!map.has(id)) map.set(id, { hero: h, picks: 0, bans: 0, wins: 0, losses: 0, draws: 0, matches: new Set() });
      return map.get(id)!;
    };
    for (const r of gameHeroRows) {
      if (!matchIds.has(r.matchId)) continue;
      const a = ensure(r.heroId); if (!a) continue;
      a.matches.add(r.matchId);
      a.picks++;
      const res = matchResult.get(r.matchId);
      if (r.playerId && !r.opponentPlayerId) {
        if (res === 'win') a.wins++;
        else if (res === 'loss') a.losses++;
        else if (res === 'draw') a.draws++;
      }
    }
    for (const b of bans) {
      if (!matchIds.has(b.matchId)) continue;
      if (b.actionType !== 'ban') continue;
      const a = ensure(b.heroId); if (!a) continue;
      a.bans++;
    }
    return Array.from(map.values());
  }, [gameHeroRows, bans, matchIds, matchResult, heroById]);

  const priority = useMemo(
    () =>
      aggregates
        .map((a) => ({
          ...a,
          score: pct(a.picks + a.bans, totalMatches),
          presence: pct(a.matches.size, totalMatches),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 15),
    [aggregates, totalMatches],
  );
  const mostPicked = useMemo(
    () => [...aggregates].sort((a, b) => b.picks - a.picks).slice(0, 15),
    [aggregates],
  );
  const mostBanned = useMemo(
    () => [...aggregates].sort((a, b) => b.bans - a.bans).slice(0, 15),
    [aggregates],
  );

  const isLoading = evL || gL || ghL || bL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.heroes')} onBack={() => nav.goBack()} />
      <ScopePicker />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <AnalyticsFiltersBar value={filters} onChange={setFilters} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {!rosterReady ? (
            <EmptyState title={t('stats.pickScope')} />
          ) : isLoading ? (
            <SkeletonList rows={4} />
          ) : aggregates.length === 0 ? (
            <EmptyState title={t('stats.noHeroData')} description={t('stats.noHeroDataDesc')} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <StatCard label={t('stats.heroesSeen')} value={String(aggregates.length)} />
                <StatCard label={t('stats.matches')} value={String(totalMatches)} />
              </View>
              <FilterChips
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                options={[
                  { value: 'priority', label: t('stats.priority') },
                  { value: 'picks', label: t('stats.mostPicked') },
                  { value: 'bans', label: t('stats.mostBanned') },
                ]}
                testIdPrefix="hero-tab"
              />
              {(tab === 'priority' ? priority : tab === 'picks' ? mostPicked : mostBanned).map((row, i) => (
                <RankRow
                  key={row.hero.id}
                  index={i}
                  label={row.hero.name}
                  sublabel={
                    tab === 'bans'
                      ? `${row.bans} ${t('stats.bans')} · ${row.picks} ${t('stats.picks')}`
                      : `${row.picks} ${t('stats.picks')} · ${row.bans} ${t('stats.bans')}`
                  }
                  wins={row.wins}
                  losses={row.losses}
                  draws={row.draws}
                  testID={`hero-row-${row.hero.id}`}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
