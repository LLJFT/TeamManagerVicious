import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { useTheme } from '@/theme/ThemeProvider';

export type EventCardData = {
  id: number | string;
  title: string;
  type?: string;
  opponent?: string;
  startsAt?: string;
  result?: 'win' | 'loss' | 'draw' | 'pending';
};

const resultTone: Record<NonNullable<EventCardData['result']>, React.ComponentProps<typeof Badge>['tone']> = {
  win: 'success',
  loss: 'danger',
  draw: 'warning',
  pending: 'neutral',
};

export function EventCard({ event, onPress, testID }: { event: EventCardData; onPress?: () => void; testID?: string }) {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={event.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{event.title}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {[event.type, event.opponent, event.startsAt].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {event.result ? (
          <Badge
            label={t(`events.${event.result}`)}
            tone={resultTone[event.result]}
          />
        ) : null}
      </View>
    </Card>
  );
}
