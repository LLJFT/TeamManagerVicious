import React from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { useTheme } from '@/theme/ThemeProvider';

export function OpponentCard({
  name,
  region,
  meetings,
  winRate,
  onPress,
  testID,
}: {
  name: string;
  region?: string;
  meetings?: number;
  winRate?: number;
  onPress?: () => void;
  testID?: string;
}) {
  const { spacing } = useTheme();
  const tone = winRate === undefined ? 'neutral' : winRate >= 50 ? 'success' : 'danger';
  return (
    <Card testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{name}</Text>
          <Text variant="caption" tone="secondary">
            {[region, meetings ? `${meetings} matches` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {winRate !== undefined ? <Badge label={`${winRate}% WR`} tone={tone} /> : null}
      </View>
    </Card>
  );
}
