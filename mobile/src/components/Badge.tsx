import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  style,
  testID,
}: {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
    primary: { bg: colors.primary + '22', fg: colors.primary },
    success: { bg: colors.success + '22', fg: colors.success },
    warning: { bg: colors.warning + '22', fg: colors.warning },
    danger: { bg: colors.danger + '22', fg: colors.danger },
    info: { bg: colors.info + '22', fg: colors.info },
  };
  const c = map[tone];
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: c.bg,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <Text variant="caption" style={{ color: c.fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ base: { alignSelf: 'flex-start' } });
