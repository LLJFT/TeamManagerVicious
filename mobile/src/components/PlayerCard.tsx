import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { Text } from './Text';
import { Badge } from './Badge';
import { useTheme } from '@/theme/ThemeProvider';

export function PlayerCard({
  name,
  role,
  available,
  onPress,
  testID,
}: {
  name: string;
  role?: string;
  available?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useTranslation();
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={name}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="heading">{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{name}</Text>
          {role ? <Text variant="caption" tone="secondary">{role}</Text> : null}
        </View>
        {available !== undefined ? (
          <Badge
            label={available ? t('roster.available') : t('roster.unavailable')}
            tone={available ? 'success' : 'danger'}
          />
        ) : null}
      </View>
    </Card>
  );
}
