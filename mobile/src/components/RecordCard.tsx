import React from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { useTheme } from '@/theme/ThemeProvider';

export function RecordCard({
  title,
  meta,
  badge,
  onPress,
  testID,
  children,
}: {
  title: string;
  meta?: string;
  badge?: { label: string; tone?: React.ComponentProps<typeof Badge>['tone'] };
  onPress?: () => void;
  testID?: string;
  children?: React.ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{title}</Text>
          {meta ? <Text variant="caption" tone="secondary">{meta}</Text> : null}
        </View>
        {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
      </View>
      {children ? <View style={{ marginTop: spacing.md }}>{children}</View> : null}
    </Card>
  );
}
