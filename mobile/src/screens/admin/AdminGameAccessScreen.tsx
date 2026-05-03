import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, EmptyState } from '@/components';

export function AdminGameAccessScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const nav = useNavigation();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('more.gameAccess')} onBack={() => nav.goBack()} />
      <EmptyState title={t('common.noData')} description="Game access controls coming soon." />
    </SafeAreaView>
  );
}
