import React from 'react';
import { View, Pressable, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
};

export function Card({ children, style, padded = true, onPress, testID, accessibilityLabel }: CardProps) {
  const { colors, radii, spacing, shadows } = useTheme();
  const baseStyle = [
    styles.base,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: padded ? spacing.lg : 0,
      ...shadows.sm,
    },
    style as any,
  ];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [baseStyle, pressed ? { opacity: 0.85 } : null]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={baseStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ base: { borderWidth: StyleSheet.hairlineWidth } });
