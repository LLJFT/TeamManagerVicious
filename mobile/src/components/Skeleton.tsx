import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: ViewStyle }) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={[
        { height, width: width as any, borderRadius: radii.sm, backgroundColor: colors.surfaceAlt, opacity: 0.7 },
        style,
      ]}
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm, padding: spacing.lg }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={64} />
      ))}
    </View>
  );
}
