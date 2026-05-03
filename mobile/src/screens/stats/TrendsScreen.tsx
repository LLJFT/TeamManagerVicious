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
  ScopePicker,
  SkeletonList,
  StatCard,
  Text,
  WinRateBadge,
} from '@/components';
import { useGame } from '@/hooks/useGame';
import { defaultFilters, type AnalyticsFilters } from '@/components/AnalyticsFiltersBar';
import { buildAllowedEventIds, pct, scopeGames, toOutcome, type EventLite, type GameLite, type MatchOutcome } from './_shared';

function parseScore(s: string | null | undefined): { us: number; them: number } | null {
  if (!s) return null;
  const m = s.match(/^\s*(\d+)\s*[-–:]\s*(\d+)\s*$/);
  if (!m) return null;
  return { us: parseInt(m[1], 10), them: parseInt(m[2], 10) };
}

export function TrendsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);

  const { data: events = [], isLoading: evL } = useQuery<EventLite[]>({ queryKey: ['/api/events', { gameId, rosterId }], enabled: rosterReady });
  const { data: allGames = [], isLoading: gL } = useQuery<GameLite[]>({ queryKey: ['/api/games', { gameId, rosterId }], enabled: rosterReady });

  const allowedEventIds = useMemo(() => buildAllowedEventIds(events, filters), [events, filters]);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const scoped = useMemo(() => {
    const filtered = scopeGames(allGames, allowedEventIds, filters.opponentId)
      .map((g) => ({ g, ev: g.eventId ? eventById.get(g.eventId) : null }))
      .filter((x) => !!x.ev?.date)
      .sort((a, b) => (a.ev!.date || '').localeCompare(b.ev!.date || ''));
    return filtered;
  }, [allGames, allowedEventIds, filters.opponentId, eventById]);

  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; wins: number; losses: number; draws: number; total: number }>();
    for (const { g, ev } of scoped) {
      const month = (ev!.date || '').slice(0, 7); if (!month) continue;
      let row = m.get(month);
      if (!row) { row = { month, wins: 0, losses: 0, draws: 0, total: 0 }; m.set(month, row); }
      row.total++;
      if (g.result === 'win') row.wins++;
      else if (g.result === 'loss') row.losses++;
      else if (g.result === 'draw') row.draws++;
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [scoped]);

  const eventResults = useMemo(() => {
    const grouped = new Map<string, { event: EventLite; outcome: MatchOutcome | null }>();
    for (const { ev } of scoped) {
      if (!ev) continue;
      if (grouped.has(ev.id)) continue;
      grouped.set(ev.id, { event: ev, outcome: toOutcome(ev.result) });
    }
    return Array.from(grouped.values()).filter((r) => r.outcome !== null);
  }, [scoped]);

  const streaks = useMemo(() => {
    let longestW = 0, longestL = 0, runW = 0, runL = 0;
    for (const r of eventResults) {
      if (r.outcome === 'win') { runW++; runL = 0; longestW = Math.max(longestW, runW); }
      else if (r.outcome === 'loss') { runL++; runW = 0; longestL = Math.max(longestL, runL); }
      else { runW = 0; runL = 0; }
    }
    let curSign: MatchOutcome | null = null; let curLen = 0;
    for (let i = eventResults.length - 1; i >= 0; i--) {
      const o = eventResults[i].outcome;
      if (o === 'draw' || o == null) { if (curSign === null) continue; break; }
      if (curSign === null) { curSign = o; curLen = 1; }
      else if (curSign === o) curLen++;
      else break;
    }
    return { longestW, longestL, curSign, curLen };
  }, [eventResults]);

  const score = useMemo(() => {
    let us = 0, them = 0, count = 0;
    for (const { g } of scoped) {
      const p = parseScore(g.score); if (!p) continue;
      us += p.us; them += p.them; count++;
    }
    return { avgUs: count ? us / count : 0, avgThem: count ? them / count : 0, count };
  }, [scoped]);

  const totalWins = scoped.filter((x) => x.g.result === 'win').length;
  const totalGames = scoped.length;

  const isLoading = evL || gL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.trends')} onBack={() => nav.goBack()} />
      <ScopePicker />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <AnalyticsFiltersBar value={filters} onChange={setFilters} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {!rosterReady ? (
            <EmptyState title={t('stats.pickScope')} />
          ) : isLoading ? (
            <SkeletonList rows={4} />
          ) : totalGames === 0 ? (
            <EmptyState title={t('stats.noData')} description={t('stats.noDataDesc')} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <StatCard label={t('stats.matchWinRate')} value={`${pct(totalWins, totalGames).toFixed(0)}%`} tone="success" />
                <StatCard label={t('stats.matches')} value={String(totalGames)} />
                <StatCard label={t('stats.events')} value={String(eventResults.length)} />
              </View>

              <Card>
                <Text variant="heading">{t('stats.streaks')}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text tone="secondary">{t('stats.longestWinStreak')}</Text>
                  <Text style={{ fontWeight: '700', color: colors.success }}>{streaks.longestW}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text tone="secondary">{t('stats.longestLossStreak')}</Text>
                  <Text style={{ fontWeight: '700', color: colors.danger }}>{streaks.longestL}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text tone="secondary">{t('stats.current')}</Text>
                  <Text style={{ fontWeight: '700', color: streaks.curSign === 'win' ? colors.success : streaks.curSign === 'loss' ? colors.danger : colors.textSecondary }}>
                    {streaks.curSign === 'win'
                      ? `${streaks.curLen} ${t('events.win')}`
                      : streaks.curSign === 'loss'
                      ? `${streaks.curLen} ${t('events.loss')}`
                      : '—'}
                  </Text>
                </View>
              </Card>

              {score.count > 0 ? (
                <Card>
                  <Text variant="heading">{t('stats.averageScore')}</Text>
                  <Text variant="display" style={{ marginTop: spacing.sm }}>
                    {score.avgUs.toFixed(1)} – {score.avgThem.toFixed(1)}
                  </Text>
                  <Text variant="caption" tone="tertiary">{t('stats.overGames', { count: score.count })}</Text>
                </Card>
              ) : null}

              <Card>
                <Text variant="heading">{t('stats.monthlyForm')}</Text>
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  {monthly.length === 0 ? (
                    <Text tone="tertiary">{t('stats.noMonthlyData')}</Text>
                  ) : (
                    monthly.map((m) => (
                      <View key={m.month} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                        <Text variant="body" style={{ fontWeight: '600' }}>{m.month}</Text>
                        <Text variant="caption" tone="secondary">{m.total} {t('stats.games')}</Text>
                        <WinRateBadge wins={m.wins} losses={m.losses} draws={m.draws} />
                      </View>
                    ))
                  )}
                </View>
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
