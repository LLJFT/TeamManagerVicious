import React from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useTranslation } from 'react-i18next';

export function SearchBar({
  value,
  onChange,
  placeholder,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surfaceAlt,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      <TextInput
        testID={testID ?? 'input-search'}
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? t('common.search')}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 40, justifyContent: 'center' },
  input: { fontSize: 14 },
});
