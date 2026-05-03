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
  ScopePicker,
  SkeletonList,
  StatCard,
  Text,
  WinRateBadge,
} from '@/components';
import { useGame } from '@/hooks/useGame';
import { defaultFilters, type AnalyticsFilters } from '@/components/AnalyticsFiltersBar';
import { buildAllowedEventIds, scopeGames, type EventLite, type GameLite } from './_shared';

type Hero = { id: string; name: string };
type GameHero = { matchId: string; heroId: string; playerId?: string | null; opponentPlayerId?: string | null };

type Side = 'ours' | 'opp';

export function TeamCompsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [side, setSide] = useState<Side>('ours');

  const { data: events = [] } = useQuery<EventLite[]>({ queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady });
  const { data: allGames = [] } = useQuery<GameLite[]>({ queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady });
  const { data: heroes = [] } = useQuery<Hero[]>({ queryKey: ['/api/heroes', { gameId, rosterId }], enabled: rosterReady });
  const { data: gameHeroes = [], isLoading } = useQuery<GameHero[]>({ queryKey: ['/api/game-heroes', { gameId, rosterId }], enabled: rosterReady });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const scoped = useMemo(() => scopeGames(allGames, allowedEventIds, filters.opponentId), [allGames, allowedEventIds, filters.opponentId]);
  const matchIds = useMemo(() => new Set(scoped.map((g) => g.id)), [scoped]);
  const matchResult = useMemo(() => new Map(scoped.map((g) => [g.id, g.result ?? null])), [scoped]);
  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  const groups = useMemo(() => {
    const perMatch = new Map<string, Set<string>>();
    for (const r of gameHeroes) {
      if (!matchIds.has(r.matchId)) continue;
      const isOurs = !!r.playerId && !r.opponentPlayerId;
      const isOpp = !!r.opponentPlayerId;
      if (side === 'ours' && !isOurs) continue;
      if (side === 'opp' && !isOpp) continue;
      let s = perMatch.get(r.matchId);
      if (!s) { s = new Set(); perMatch.set(r.matchId, s); }
      s.add(r.heroId);
    }
    const compMap = new Map<string, { heroes: Hero[]; plays: number; wins: number; losses: number; draws: number }>();
    for (const [matchId, heroIds] of perMatch) {
      if (heroIds.size === 0) continue;
      const sorted = [...heroIds].sort();
      const key = sorted.join('|');
      let row = compMap.get(key);
      if (!row) {
        const h = sorted.map((id) => heroById.get(id)).filter(Boolean) as Hero[];
        row = { heroes: h, plays: 0, wins: 0, losses: 0, draws: 0 };
        compMap.set(key, row);
      }
      row.plays++;
      const res = matchResult.get(matchId);
      if (res === 'win') row.wins++;
      else if (res === 'loss') row.losses++;
      else if (res === 'draw') row.draws++;
    }
    return Array.from(compMap.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 20);
  }, [gameHeroes, matchIds, matchResult, heroById, side]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.teamComps')} onBack={() => nav.goBack()} />
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
                <StatCard label={t('stats.uniqueComps')} value={String(groups.length)} />
              </View>
              <FilterChips
                value={side}
                onChange={(v) => setSide(v as Side)}
                options={[
                  { value: 'ours', label: t('stats.ourComps') },
                  { value: 'opp', label: t('stats.opponentComps') },
                ]}
                testIdPrefix="comp-side"
              />
              {groups.length === 0 ? (
                <EmptyState title={t('stats.noComps')} description={t('stats.noCompsDesc')} />
              ) : (
                groups.map((g, idx) => (
                  <Card key={g.key} testID={`comp-${idx}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                      <Text variant="caption" tone="tertiary">#{idx + 1} · {g.plays} {t('stats.plays')}</Text>
                      <WinRateBadge wins={g.wins} losses={g.losses} draws={g.draws} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
                      {g.heroes.map((h) => (
                        <View
                          key={h.id}
                          style={{
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 4,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceAlt,
                          }}
                        >
                          <Text variant="caption">{h.name}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
