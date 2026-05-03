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

type MapType = { id: string; name: string };
type GameMode = { id: string; name: string };
type Opponent = { id: string; name: string };

type Tab = 'opponents' | 'maps' | 'modes';

export function TeamLeaderboardScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [tab, setTab] = useState<Tab>('opponents');

  const { data: events = [], isLoading: evL } = useQuery<EventLite[]>({ queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady });
  const { data: allGames = [], isLoading: gL } = useQuery<GameLite[]>({ queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady });
  const { data: maps = [] } = useQuery<MapType[]>({ queryKey: ['/api/maps', { gameId, rosterId }], enabled: rosterReady });
  const { data: gameModes = [] } = useQuery<GameMode[]>({ queryKey: ['/api/game-modes', { gameId, rosterId }], enabled: rosterReady });
  const { data: opponents = [] } = useQuery<Opponent[]>({ queryKey: ['/api/opponents', { gameId, rosterId }], enabled: rosterReady });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const scoped = useMemo(() => scopeGames(allGames, allowedEventIds, filters.opponentId), [allGames, allowedEventIds, filters.opponentId]);

  function build<T extends { id: string; name: string }>(list: T[], pickKey: (g: GameLite) => string | null | undefined) {
    const m = new Map<string, { item: T; wins: number; losses: number; draws: number }>();
    for (const g of scoped) {
      const key = pickKey(g); if (!key) continue;
      const item = list.find((x) => x.id === key); if (!item) continue;
      let row = m.get(key);
      if (!row) { row = { item, wins: 0, losses: 0, draws: 0 }; m.set(key, row); }
      if (g.result === 'win') row.wins++;
      else if (g.result === 'loss') row.losses++;
      else if (g.result === 'draw') row.draws++;
    }
    return Array.from(m.values()).filter((r) => r.wins + r.losses + r.draws > 0);
  }

  const oppRows = useMemo(() => build(opponents, (g) => g.opponentId), [opponents, scoped]);
  const mapRows = useMemo(() => build(maps, (g) => g.mapId), [maps, scoped]);
  const modeRows = useMemo(() => build(gameModes, (g) => g.gameModeId), [gameModes, scoped]);

  const rows = tab === 'opponents' ? oppRows : tab === 'maps' ? mapRows : modeRows;
  const sorted = [...rows].sort((a, b) => {
    const ta = a.wins + a.losses + a.draws;
    const tb = b.wins + b.losses + b.draws;
    return tb - ta;
  });
  const best = [...rows]
    .filter((r) => r.wins + r.losses + r.draws >= 3)
    .sort((a, b) => (b.wins / (b.wins + b.losses + b.draws)) - (a.wins / (a.wins + a.losses + a.draws)))
    .slice(0, 5);

  const isLoading = evL || gL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.teamLeaderboard')} onBack={() => nav.goBack()} />
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
              <FilterChips
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                options={[
                  { value: 'opponents', label: t('stats.vsOpponent') },
                  { value: 'maps', label: t('stats.vsMap') },
                  { value: 'modes', label: t('stats.vsMode') },
                ]}
                testIdPrefix="lb-tab"
              />
              {sorted.length === 0 ? (
                <EmptyState title={t('stats.noData')} description={t('stats.noMatchesRecorded')} />
              ) : (
                <>
                  <Text variant="heading">{t('stats.topByVolume')}</Text>
                  {sorted.slice(0, 10).map((r, i) => (
                    <RankRow
                      key={r.item.id}
                      index={i}
                      label={r.item.name}
                      wins={r.wins}
                      losses={r.losses}
                      draws={r.draws}
                      testID={`lb-vol-${r.item.id}`}
                    />
                  ))}
                  {best.length > 0 ? (
                    <>
                      <Text variant="heading" style={{ marginTop: spacing.md }}>{t('stats.topByWinRate')}</Text>
                      {best.map((r, i) => (
                        <RankRow
                          key={r.item.id}
                          index={i}
                          label={r.item.name}
                          wins={r.wins}
                          losses={r.losses}
                          draws={r.draws}
                          testID={`lb-wr-${r.item.id}`}
                        />
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
