import React from 'react';
import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';
import { numericTextStyle } from '@/theme/tokens';

type StatTone = 'success' | 'danger' | 'primary' | 'default';

export function StatCard({
  label,
  value,
  delta,
  tone = 'default',
  testID,
}: {
  label: string;
  value: string | number;
  delta?: string;
  tone?: StatTone;
  testID?: string;
}) {
  const { spacing } = useTheme();
  const valueTone = tone === 'default' ? 'default' : tone;
  const deltaTone = tone === 'danger' ? 'danger' : 'success';
  return (
    <Card testID={testID} style={{ flex: 1, minWidth: 140 }}>
      <Text variant="overline" tone="tertiary">
        {label}
      </Text>
      <Text variant="display" tone={valueTone} style={{ marginTop: spacing.xs, ...numericTextStyle }}>
        {value}
      </Text>
      {delta ? (
        <Text variant="caption" tone={deltaTone} style={{ marginTop: spacing.xs, ...numericTextStyle }}>
          {delta}
        </Text>
      ) : null}
    </Card>
  );
}
