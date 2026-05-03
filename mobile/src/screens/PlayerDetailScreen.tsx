import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, Card, Text, ExpandableSection, StatCard, SkeletonList } from '@/components';
import type { TeamsStackParamList } from '@/navigation/stacks/TeamsStack';

type PlayerDetail = {
  id: number;
  name: string;
  role?: string;
  bio?: string;
  stats?: Record<string, number | string>;
};

export function PlayerDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const route = useRoute<RouteProp<TeamsStackParamList, 'PlayerDetail'>>();
  const nav = useNavigation();
  const { id, name } = route.params;
  const { data, isLoading } = useQuery<PlayerDetail>({ queryKey: ['/api/players', id] });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={data?.name ?? name ?? '#' + id} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <Card>
              <Text variant="overline" tone="tertiary">{t('roster.role')}</Text>
              <Text variant="title" style={{ marginTop: 4 }}>{data?.role ?? '—'}</Text>
            </Card>
            <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
              {Object.entries(data?.stats ?? {}).slice(0, 4).map(([k, v]) => (
                <StatCard key={k} label={k} value={String(v)} testID={`pstat-${k}`} />
              ))}
            </View>
            <ExpandableSection title={t('player.bio')} defaultOpen>
              <Text variant="body" tone="secondary">{data?.bio ?? t('common.noData')}</Text>
            </ExpandableSection>
            <ExpandableSection title={t('player.history')}>
              <Text variant="body" tone="secondary">{t('common.noData')}</Text>
            </ExpandableSection>
            <ExpandableSection title={t('player.notes')}>
              <Text variant="body" tone="secondary">{t('common.noData')}</Text>
            </ExpandableSection>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
