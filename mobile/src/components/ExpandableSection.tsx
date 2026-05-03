import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

export function ExpandableSection({
  title,
  defaultOpen = false,
  children,
  testID,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testID?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      testID={testID}
      style={[styles.wrap, { borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface }]}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text variant="heading" style={{ flex: 1 }}>{title}</Text>
        <Text variant="title" tone="tertiary">{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { borderWidth: StyleSheet.hairlineWidth } });
