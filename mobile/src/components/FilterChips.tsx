import React from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export type Chip = { value: string; label: string };

export function FilterChips({
  options,
  value,
  onChange,
  testIdPrefix = 'chip',
}: {
  options: Chip[];
  value: string;
  onChange: (v: string) => void;
  testIdPrefix?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            testID={`${testIdPrefix}-${o.value}`}
            style={[
              styles.chip,
              {
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary + '22' : 'transparent',
                borderRadius: radii.pill,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Text variant="caption" style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
