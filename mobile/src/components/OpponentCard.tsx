import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const tone = winRate === undefined ? 'neutral' : winRate >= 50 ? 'success' : 'danger';
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={name}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{name}</Text>
          <Text variant="caption" tone="secondary">
            {[region, meetings ? `${meetings} ${t('opponent.matches')}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {winRate !== undefined ? <Badge label={`${winRate}% ${t('opponent.wr')}`} tone={tone} /> : null}
      </View>
    </Card>
  );
}
