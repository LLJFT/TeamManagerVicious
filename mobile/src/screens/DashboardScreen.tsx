import React from 'react';
import { ScrollView, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, StatCard, Text, EventCard, EmptyState, SkeletonList } from '@/components';
import { useAuth } from '@/auth/AuthContext';

type DashboardData = {
  upcomingEvents?: { id: number; title: string; type?: string; opponent?: string; startsAt?: string }[];
  recentResults?: { id: number; title: string; result?: 'win' | 'loss' | 'draw' }[];
  stats?: { totalPlayers?: number; winRate?: number; upcoming?: number };
};

export function DashboardScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('dashboard.title')} subtitle={user?.username} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <SkeletonList rows={3} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
              <StatCard label={t('roster.players')} value={data?.stats?.totalPlayers ?? '—'} testID="stat-players" />
              <StatCard
                label={t('events.win') + ' %'}
                value={data?.stats?.winRate !== undefined ? `${data.stats.winRate}%` : '—'}
                tone="success"
                testID="stat-winrate"
              />
              <StatCard label={t('dashboard.upcoming')} value={data?.stats?.upcoming ?? '—'} testID="stat-upcoming" />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="heading">{t('dashboard.upcoming')}</Text>
              {(data?.upcomingEvents ?? []).length === 0 ? (
                <EmptyState title={t('empty.events')} />
              ) : (
                data!.upcomingEvents!.map((e) => <EventCard key={e.id} event={e} testID={`event-${e.id}`} />)
              )}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="heading">{t('dashboard.recentResults')}</Text>
              {(data?.recentResults ?? []).length === 0 ? (
                <EmptyState title={t('common.noData')} />
              ) : (
                data!.recentResults!.map((e) => <EventCard key={e.id} event={e} testID={`result-${e.id}`} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
