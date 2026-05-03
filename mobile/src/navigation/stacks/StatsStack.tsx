import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatsOverviewScreen } from '@/screens/StatsOverviewScreen';
import { StatBreakdownScreen } from '@/screens/StatBreakdownScreen';
import { CompareScreen } from '@/screens/stats/CompareScreen';
import { MapInsightsScreen } from '@/screens/stats/MapInsightsScreen';
import { HeroInsightsScreen } from '@/screens/stats/HeroInsightsScreen';
import { DraftStatsScreen } from '@/screens/stats/DraftStatsScreen';
import { TeamCompsScreen } from '@/screens/stats/TeamCompsScreen';
import { TeamLeaderboardScreen } from '@/screens/stats/TeamLeaderboardScreen';
import { PlayerLeaderboardScreen } from '@/screens/stats/PlayerLeaderboardScreen';
import { TrendsScreen } from '@/screens/stats/TrendsScreen';

export type StatsStackParamList = {
  StatsOverview: undefined;
  StatBreakdown: { kind: 'players' | 'opponents' | 'heroes' | 'maps' | 'trends' };
  Compare: undefined;
  MapInsights: undefined;
  HeroInsights: undefined;
  DraftStats: undefined;
  TeamComps: undefined;
  TeamLeaderboard: undefined;
  PlayerLeaderboard: undefined;
  Trends: undefined;
};

const Stack = createNativeStackNavigator<StatsStackParamList>();

export function StatsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StatsOverview" component={StatsOverviewScreen} />
      <Stack.Screen name="StatBreakdown" component={StatBreakdownScreen} />
      <Stack.Screen name="Compare" component={CompareScreen} />
      <Stack.Screen name="MapInsights" component={MapInsightsScreen} />
      <Stack.Screen name="HeroInsights" component={HeroInsightsScreen} />
      <Stack.Screen name="DraftStats" component={DraftStatsScreen} />
      <Stack.Screen name="TeamComps" component={TeamCompsScreen} />
      <Stack.Screen name="TeamLeaderboard" component={TeamLeaderboardScreen} />
      <Stack.Screen name="PlayerLeaderboard" component={PlayerLeaderboardScreen} />
      <Stack.Screen name="Trends" component={TrendsScreen} />
    </Stack.Navigator>
  );
}
