import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export function SettingsRow({
  label,
  value,
  onPress,
  testID,
  trailing,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  testID?: string;
  trailing?: React.ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed && onPress ? colors.surfaceAlt : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
      </View>
      {trailing ?? (value ? <Text variant="body" tone="secondary">{value}</Text> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
});
