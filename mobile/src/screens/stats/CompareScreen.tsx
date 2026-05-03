import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import {
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
import { pct, scopeGames, buildAllowedEventIds, tally, type EventLite, type GameLite } from './_shared';

type Season = { id: string; name: string };

export function CompareScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { gameId, rosterId, rosterReady } = useGame();

  const [sel1, setSel1] = useState<string>('');
  const [sel2, setSel2] = useState<string>('');

  const { data: events = [], isLoading: evL } = useQuery<EventLite[]>({
    queryKey: ['/api/events', { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: allGames = [] } = useQuery<GameLite[]>({
    queryKey: ['/api/games', { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ['/api/seasons', { gameId, rosterId }],
    enabled: rosterReady,
  });

  const months = useMemo(() => {
    const set = new Map<string, string>();
    for (const e of events) {
      if (!e.date) continue;
      const key = e.date.slice(0, 7);
      const dt = new Date(e.date);
      if (Number.isNaN(dt.getTime())) continue;
      set.set(key, dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short' }));
    }
    return Array.from(set.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([value, label]) => ({ value, label }));
  }, [events]);

  type Mode = 'season' | 'month';
  const [mode, setMode] = useState<Mode>('season');
  const options = mode === 'season'
    ? seasons.map((s) => ({ value: s.id, label: s.name }))
    : months;

  const computeStats = (selection: string) => {
    if (!selection) return null;
    let filteredEvents: EventLite[];
    if (mode === 'season') {
      filteredEvents = events.filter((e) => e.seasonId === selection);
    } else {
      filteredEvents = events.filter((e) => e.date && e.date.slice(0, 7) === selection);
    }
    const ids = new Set(filteredEvents.map((e) => e.id));
    const games = allGames.filter((g) => g.eventId && ids.has(g.eventId));
    return {
      events: tally(filteredEvents, (e) => e.result),
      games: tally(games, (g) => g.result),
    };
  };

  const a = computeStats(sel1);
  const b = computeStats(sel2);

  const labelOf = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  const isLoading = evL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.compare')} onBack={() => nav.goBack()} />
      <ScopePicker />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {!rosterReady ? (
          <EmptyState title={t('stats.pickScope')} />
        ) : isLoading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <Card>
              <Text variant="overline" tone="tertiary">{t('stats.mode')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                {(['season', 'month'] as Mode[]).map((m) => (
                  <Text
                    key={m}
                    onPress={() => {
                      setMode(m);
                      setSel1('');
                      setSel2('');
                    }}
                    testID={`compare-mode-${m}`}
                    variant="body"
                    tone={mode === m ? 'primary' : 'secondary'}
                    style={{
                      fontWeight: mode === m ? '700' : '400',
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: mode === m ? colors.primary : colors.border,
                    }}
                  >
                    {m === 'season' ? t('stats.bySeason') : t('stats.byMonth')}
                  </Text>
                ))}
              </View>
            </Card>

            <SelectorCard
              testID="compare-a"
              label={t('stats.selectionA')}
              value={sel1}
              setValue={setSel1}
              options={options}
              emptyLabel={t('stats.noOptions')}
            />
            <SelectorCard
              testID="compare-b"
              label={t('stats.selectionB')}
              value={sel2}
              setValue={setSel2}
              options={options}
              emptyLabel={t('stats.noOptions')}
            />

            {a && b ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text variant="heading" numberOfLines={1}>{labelOf(sel1)}</Text>
                  <StatCard label={t('stats.matchWinRate')} value={`${pct(a.games.wins, a.games.total).toFixed(0)}%`} tone="success" />
                  <StatCard label={t('stats.matches')} value={String(a.games.total)} />
                  <StatCard label={t('stats.events')} value={String(a.events.total)} />
                </View>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text variant="heading" numberOfLines={1}>{labelOf(sel2)}</Text>
                  <StatCard label={t('stats.matchWinRate')} value={`${pct(b.games.wins, b.games.total).toFixed(0)}%`} tone="success" />
                  <StatCard label={t('stats.matches')} value={String(b.games.total)} />
                  <StatCard label={t('stats.events')} value={String(b.events.total)} />
                </View>
              </View>
            ) : (
              <EmptyState title={t('stats.pickTwoPeriods')} />
            )}

            {a && b ? (
              <Card>
                <Text variant="heading">{t('stats.delta')}</Text>
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <DeltaRow label={t('stats.matchWinRate')} a={pct(a.games.wins, a.games.total)} b={pct(b.games.wins, b.games.total)} suffix="%" />
                  <DeltaRow label={t('stats.matches')} a={a.games.total} b={b.games.total} />
                  <DeltaRow label={t('stats.wins')} a={a.games.wins} b={b.games.wins} />
                  <DeltaRow label={t('stats.losses')} a={a.games.losses} b={b.games.losses} invert />
                </View>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectorCard({
  label, value, setValue, options, testID, emptyLabel,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  options: { value: string; label: string }[];
  testID: string;
  emptyLabel: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Card testID={testID}>
      <Text variant="overline" tone="tertiary">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}>
        {options.length === 0 ? (
          <Text tone="tertiary">{emptyLabel}</Text>
        ) : (
          options.map((o) => {
            const active = o.value === value;
            return (
              <Text
                key={o.value}
                onPress={() => setValue(o.value)}
                testID={`${testID}-opt-${o.value}`}
                variant="caption"
                tone={active ? 'primary' : 'secondary'}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  fontWeight: active ? '700' : '500',
                }}
              >
                {o.label}
              </Text>
            );
          })
        )}
      </ScrollView>
    </Card>
  );
}

function DeltaRow({ label, a, b, suffix, invert }: { label: string; a: number; b: number; suffix?: string; invert?: boolean }) {
  const { colors } = useTheme();
  const diff = b - a;
  const goodish = invert ? diff < 0 : diff > 0;
  const color = diff === 0 ? colors.textSecondary : goodish ? colors.success : colors.danger;
  const sign = diff > 0 ? '+' : '';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" tone="secondary">{label}</Text>
      <Text variant="body" style={{ color, fontWeight: '700' }}>
        {sign}{diff.toFixed(suffix ? 1 : 0)}{suffix ?? ''}
      </Text>
    </View>
  );
}
