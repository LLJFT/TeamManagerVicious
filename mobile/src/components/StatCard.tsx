import React from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export function StatCard({
  label,
  value,
  delta,
  tone,
  testID,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: 'success' | 'danger' | 'primary' | 'default';
  testID?: string;
}) {
  const { spacing } = useTheme();
  return (
    <Card testID={testID} style={{ flex: 1, minWidth: 140 }}>
      <Text variant="overline" tone="tertiary">
        {label}
      </Text>
      <Text variant="display" tone={tone === 'default' ? 'default' : (tone as any) ?? 'default'} style={{ marginTop: spacing.xs }}>
        {value}
      </Text>
      {delta ? (
        <Text variant="caption" tone={tone === 'danger' ? 'danger' : 'success'} style={{ marginTop: spacing.xs }}>
          {delta}
        </Text>
      ) : null}
    </Card>
  );
}
