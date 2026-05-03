import React from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { Button } from './Button';
import { useTheme } from '@/theme/ThemeProvider';

export function SubscriptionPlanCard({
  name,
  price,
  features,
  active,
  onSelect,
  testID,
}: {
  name: string;
  price: string;
  features: string[];
  active?: boolean;
  onSelect?: () => void;
  testID?: string;
}) {
  const { spacing } = useTheme();
  return (
    <Card testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{name}</Text>
          <Text variant="caption" tone="secondary">{price}</Text>
        </View>
        {active ? <Badge label="Current" tone="success" /> : null}
      </View>
      <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
        {features.map((f) => (
          <Text key={f} variant="caption" tone="secondary">
            • {f}
          </Text>
        ))}
      </View>
      {!active && onSelect ? (
        <Button title="Choose" onPress={onSelect} fullWidth style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}
