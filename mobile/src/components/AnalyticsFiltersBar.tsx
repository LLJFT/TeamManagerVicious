import React, { useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { FilterChips } from './FilterChips';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';
import { useQuery } from '@tanstack/react-query';
import { useGame } from '@/hooks/useGame';

export type Opponent = { id: string; name: string };

export type AnalyticsFilters = {
  opponentId: string; // "__all__" or id
  range: 'all' | '30d' | '90d' | '180d' | '365d';
};

export const defaultFilters: AnalyticsFilters = { opponentId: '__all__', range: 'all' };

export function isWithinRange(date: string | null | undefined, range: AnalyticsFilters['range']) {
  if (range === 'all') return true;
  if (!date) return false;
  const d = new Date(date).getTime();
  if (Number.isNaN(d)) return false;
  const days = range === '30d' ? 30 : range === '90d' ? 90 : range === '180d' ? 180 : 365;
  return d >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export function AnalyticsFiltersBar({
  value,
  onChange,
  showOpponent = true,
}: {
  value: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  showOpponent?: boolean;
}) {
  const { spacing } = useTheme();
  const { gameId, rosterId, rosterReady } = useGame();
  const { data: opponents = [] } = useQuery<Opponent[]>({
    queryKey: ['/api/opponents', { gameId, rosterId }],
    enabled: rosterReady && showOpponent,
  });

  const oppOptions = useMemo(
    () => [
      { value: '__all__', label: 'All opponents' },
      ...opponents.map((o) => ({ value: o.id, label: o.name })),
    ],
    [opponents],
  );

  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Text variant="overline" tone="tertiary">Date range</Text>
      </View>
      <FilterChips
        value={value.range}
        onChange={(v) => onChange({ ...value, range: v as AnalyticsFilters['range'] })}
        options={[
          { value: 'all', label: 'All time' },
          { value: '30d', label: '30 days' },
          { value: '90d', label: '90 days' },
          { value: '180d', label: '6 months' },
          { value: '365d', label: '1 year' },
        ]}
        testIdPrefix="filter-range"
      />
      {showOpponent ? (
        <>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
            <Text variant="overline" tone="tertiary">Opponent</Text>
          </View>
          <FilterChips
            value={value.opponentId}
            onChange={(v) => onChange({ ...value, opponentId: v })}
            options={oppOptions}
            testIdPrefix="filter-opp"
          />
        </>
      ) : null}
    </View>
  );
}
