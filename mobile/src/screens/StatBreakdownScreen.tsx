import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, EmptyState } from '@/components';
import type { StatsStackParamList } from '@/navigation/stacks/StatsStack';

export function StatBreakdownScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const route = useRoute<RouteProp<StatsStackParamList, 'StatBreakdown'>>();
  const nav = useNavigation();
  const labelKey = `stats.${route.params.kind}` as const;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t(labelKey)} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <EmptyState title={t('common.noData')} description="Detailed breakdown coming soon." />
      </ScrollView>
    </SafeAreaView>
  );
}
