import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export function wrTone(wr: number): 'success' | 'warning' | 'danger' {
  if (wr >= 60) return 'success';
  if (wr >= 40) return 'warning';
  return 'danger';
}

export function WinRateBadge({
  wins,
  losses,
  draws = 0,
  testID,
}: {
  wins: number;
  losses: number;
  draws?: number;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const total = wins + losses + draws;
  if (total === 0) {
    return (
      <View
        testID={testID}
        style={{
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radii.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text variant="caption" tone="tertiary">
          0-0
        </Text>
      </View>
    );
  }
  const wr = (wins / total) * 100;
  const tone = wrTone(wr);
  const bg =
    tone === 'success'
      ? colors.success + '22'
      : tone === 'warning'
      ? colors.warning + '22'
      : colors.danger + '22';
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radii.sm,
        backgroundColor: bg,
      }}
    >
      <Text variant="caption" tone={tone} style={{ fontWeight: '700' }}>
        {wins}-{losses}
        {draws ? `-${draws}` : ''} · {wr.toFixed(0)}%
      </Text>
    </View>
  );
}
