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
  RankRow,
  ScopePicker,
  SkeletonList,
  StatCard,
  Text,
} from '@/components';
import { useGame } from '@/hooks/useGame';
import { defaultFilters, type AnalyticsFilters } from '@/components/AnalyticsFiltersBar';
import { buildAllowedEventIds, pct, scopeGames, type EventLite, type GameLite } from './_shared';

type MapType = { id: string; name: string; gameModeId?: string };

export function MapInsightsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);

  const { data: events = [], isLoading: evL } = useQuery<EventLite[]>({
    queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: allGames = [], isLoading: gL } = useQuery<GameLite[]>({
    queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady,
  });
  const { data: maps = [] } = useQuery<MapType[]>({
    queryKey: ['/api/maps', { gameId, rosterId }], enabled: rosterReady,
  });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const scoped = useMemo(() => scopeGames(allGames, allowedEventIds, filters.opponentId), [allGames, allowedEventIds, filters.opponentId]);
  const mapById = useMemo(() => new Map(maps.map((m) => [m.id, m])), [maps]);

  const stats = useMemo(() => {
    const grouped = new Map<string, { map: MapType; wins: number; losses: number; draws: number; total: number }>();
    for (const g of scoped) {
      if (!g.mapId) continue;
      const m = mapById.get(g.mapId);
      if (!m) continue;
      let row = grouped.get(g.mapId);
      if (!row) {
        row = { map: m, wins: 0, losses: 0, draws: 0, total: 0 };
        grouped.set(g.mapId, row);
      }
      row.total++;
      if (g.result === 'win') row.wins++;
      else if (g.result === 'loss') row.losses++;
      else if (g.result === 'draw') row.draws++;
    }
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [scoped, mapById]);

  const totalPlayed = stats.reduce((s, x) => s + x.total, 0);
  const totalWins = stats.reduce((s, x) => s + x.wins, 0);
  const qualified = stats.filter((s) => s.total >= 3);
  const best = [...qualified].sort((a, b) => pct(b.wins, b.total) - pct(a.wins, a.total)).slice(0, 5);
  const worst = [...qualified].sort((a, b) => pct(a.wins, a.total) - pct(b.wins, b.total)).slice(0, 5);

  const isLoading = evL || gL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.maps')} onBack={() => nav.goBack()} />
      <ScopePicker />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <AnalyticsFiltersBar value={filters} onChange={setFilters} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {!rosterReady ? (
            <EmptyState title={t('stats.pickScope')} />
          ) : isLoading ? (
            <SkeletonList rows={4} />
          ) : stats.length === 0 ? (
            <EmptyState title={t('stats.noMapData')} description={t('stats.noDataDesc')} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <StatCard label={t('stats.mapsPlayed')} value={String(stats.length)} />
                <StatCard label={t('stats.mapGames')} value={String(totalPlayed)} />
                <StatCard label={t('stats.winPct')} value={`${pct(totalWins, totalPlayed).toFixed(0)}%`} tone="success" />
              </View>

              <Text variant="heading">{t('stats.mostPlayed')}</Text>
              {stats.slice(0, 10).map((s, i) => (
                <RankRow
                  key={s.map.id}
                  index={i}
                  label={s.map.name}
                  sublabel={`${s.total} ${t('stats.games')}`}
                  wins={s.wins}
                  losses={s.losses}
                  draws={s.draws}
                  testID={`map-most-${s.map.id}`}
                />
              ))}

              {best.length > 0 ? (
                <>
                  <Text variant="heading" style={{ marginTop: spacing.md }}>{t('stats.bestMaps')}</Text>
                  {best.map((s, i) => (
                    <RankRow
                      key={s.map.id}
                      index={i}
                      label={s.map.name}
                      sublabel={`${s.total} ${t('stats.games')}`}
                      wins={s.wins}
                      losses={s.losses}
                      draws={s.draws}
                      testID={`map-best-${s.map.id}`}
                    />
                  ))}
                </>
              ) : null}
              {worst.length > 0 ? (
                <>
                  <Text variant="heading" style={{ marginTop: spacing.md }}>{t('stats.worstMaps')}</Text>
                  {worst.map((s, i) => (
                    <RankRow
                      key={s.map.id}
                      index={i}
                      label={s.map.name}
                      sublabel={`${s.total} ${t('stats.games')}`}
                      wins={s.wins}
                      losses={s.losses}
                      draws={s.draws}
                      testID={`map-worst-${s.map.id}`}
                    />
                  ))}
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
