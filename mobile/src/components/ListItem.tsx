import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { isRtl } from '@/i18n';

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  const { i18n } = useTranslation();
  const rtl = isRtl(i18n.language);
  const chev = rtl ? '‹' : '›';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {leading ? <View style={{ marginEnd: spacing.md }}>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: '600' }}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Text variant="title" tone="tertiary">{chev}</Text> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
});
