import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { Card } from './Card';
import { WinRateBadge } from './WinRateBadge';
import { useTheme } from '@/theme/ThemeProvider';

export function RankRow({
  index,
  label,
  sublabel,
  wins,
  losses,
  draws = 0,
  rightExtra,
  testID,
}: {
  index: number;
  label: string;
  sublabel?: string;
  wins: number;
  losses: number;
  draws?: number;
  rightExtra?: React.ReactNode;
  testID?: string;
}) {
  const { spacing, colors } = useTheme();
  return (
    <Card testID={testID} padded={false} style={{ padding: spacing.md, marginBottom: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" tone="tertiary" style={{ width: 22, textAlign: 'right' }}>
          {index + 1}.
        </Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
            {label}
          </Text>
          {sublabel ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {sublabel}
            </Text>
          ) : null}
        </View>
        {rightExtra}
        <WinRateBadge wins={wins} losses={losses} draws={draws} />
      </View>
    </Card>
  );
}
