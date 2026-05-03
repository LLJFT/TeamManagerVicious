import React from 'react';
import { TextInput, View, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Props = TextInputProps & {
  label?: string;
  testID?: string;
};

export function TextField({ label, testID, style, ...rest }: Props) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceAlt,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            color: colors.text,
            borderColor: colors.border,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 44, fontSize: 14, borderWidth: StyleSheet.hairlineWidth },
});
