import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useTranslation } from 'react-i18next';

export function ErrorState({
  title,
  description,
  onRetry,
  testID,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  testID?: string;
}) {
  const { spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View testID={testID} style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Text variant="title" tone="danger">{title ?? t('common.error')}</Text>
      {description ? <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>{description}</Text> : null}
      {onRetry ? <Button title={t('common.retry')} onPress={onRetry} variant="outline" style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}
