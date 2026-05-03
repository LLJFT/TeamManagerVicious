import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Typography } from '@/theme/tokens';

type Variant = keyof Typography;
type Tone = 'default' | 'secondary' | 'tertiary' | 'primary' | 'danger' | 'success' | 'warning' | 'inverse';

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  children,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors, typography } = useTheme();
  const colorByTone: Record<Tone, string> = {
    default: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    primary: colors.primary,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    inverse: colors.primaryFg,
  };
  return (
    <RNText
      style={[typography[variant] as TextStyle, { color: colorByTone[tone] }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
