import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '@/theme/ThemeProvider';

export function EmptyState({
  title,
  description,
  action,
  testID,
}: {
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { spacing } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Text variant="title" tone="secondary">{title}</Text>
      {description ? <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>{description}</Text> : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="outline" style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}
