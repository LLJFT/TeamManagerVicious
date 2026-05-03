import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppHeader,
  EmptyState,
  ListItem,
  ScopePicker,
  SkeletonList,
  StatCard,
  Text,
} from '@/components';
import type { StatsStackParamList } from '@/navigation/stacks/StatsStack';
import { useGame } from '@/hooks/useGame';
import { pct, type EventLite, type GameLite } from './stats/_shared';

type Nav = NativeStackNavigationProp<StatsStackParamList>;

export function StatsOverviewScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation<Nav>();
  const { gameId, rosterId, rosterReady, isLoading: gameLoading } = useGame();

  const { data: events = [], isLoading: evL } = useQuery<EventLite[]>({
    queryKey: ['/api/events', { gameId, rosterId }],
    enabled: rosterReady,
  });
  const { data: games = [], isLoading: gL } = useQuery<GameLite[]>({
    queryKey: ['/api/games', { gameId, rosterId }],
    enabled: rosterReady,
  });

  const summary = useMemo(() => {
    let wins = 0, losses = 0, draws = 0;
    for (const g of games) {
      if (g.result === 'win') wins++;
      else if (g.result === 'loss') losses++;
      else if (g.result === 'draw') draws++;
    }
    const total = wins + losses + draws;
    return { wins, losses, draws, total, winRate: pct(wins, total) };
  }, [games]);

  type LeafRoute = Exclude<keyof StatsStackParamList, 'StatsOverview' | 'StatBreakdown'>;
  const sections: { key: LeafRoute; label: string; description: string; testID: string }[] = [
    { key: 'Compare', label: t('stats.compare'), description: t('stats.compareDesc'), testID: 'nav-compare' },
    { key: 'MapInsights', label: t('stats.maps'), description: t('stats.mapsDesc'), testID: 'nav-maps' },
    { key: 'HeroInsights', label: t('stats.heroes'), description: t('stats.heroesDesc'), testID: 'nav-heroes' },
    { key: 'DraftStats', label: t('stats.drafts'), description: t('stats.draftsDesc'), testID: 'nav-drafts' },
    { key: 'TeamComps', label: t('stats.teamComps'), description: t('stats.teamCompsDesc'), testID: 'nav-team-comps' },
    { key: 'TeamLeaderboard', label: t('stats.teamLeaderboard'), description: t('stats.teamLeaderboardDesc'), testID: 'nav-team-leaderboard' },
    { key: 'PlayerLeaderboard', label: t('stats.playerLeaderboard'), description: t('stats.playerLeaderboardDesc'), testID: 'nav-player-leaderboard' },
    { key: 'Trends', label: t('stats.trends'), description: t('stats.trendsDesc'), testID: 'nav-trends' },
  ];

  const isLoading = gameLoading || evL || gL;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.title')} />
      <ScopePicker />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {!rosterReady && !isLoading ? (
          <EmptyState title={t('stats.pickScope')} />
        ) : (
          <>
            {isLoading ? (
              <SkeletonList rows={2} />
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                <StatCard label={t('stats.matchWinRate')} value={`${summary.winRate.toFixed(0)}%`} tone="success" testID="stat-overall-winrate" />
                <StatCard label={t('stats.matches')} value={String(summary.total)} testID="stat-overall-matches" />
                <StatCard label={t('stats.events')} value={String(events.length)} testID="stat-overall-events" />
              </View>
            )}
            <View>
              {sections.map((s) => (
                <ListItem
                  key={s.key}
                  title={s.label}
                  subtitle={s.description}
                  testID={s.testID}
                  onPress={() => nav.navigate(s.key)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
