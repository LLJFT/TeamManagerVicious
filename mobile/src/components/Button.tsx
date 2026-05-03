import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  fullWidth,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const heights = { sm: 36, md: 44, lg: 52 } as const;
  const paddings = { sm: spacing.sm, md: spacing.md, lg: spacing.lg } as const;

  const styleByVariant: Record<Variant, ViewStyle & { color?: string }> = {
    primary: { backgroundColor: colors.primary, color: colors.primaryFg },
    secondary: { backgroundColor: colors.surfaceAlt, color: colors.text },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    ghost: { backgroundColor: 'transparent', color: colors.text },
    destructive: { backgroundColor: colors.danger, color: '#FFFFFF' },
  };
  const v = styleByVariant[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: paddings[size],
          borderRadius: radii.md,
          backgroundColor: v.backgroundColor,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.color} />
      ) : (
        <Text style={[styles.label, { color: v.color }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '600' },
});
