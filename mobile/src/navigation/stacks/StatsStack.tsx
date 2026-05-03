import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatsOverviewScreen } from '@/screens/StatsOverviewScreen';
import { StatBreakdownScreen } from '@/screens/StatBreakdownScreen';

export type StatsStackParamList = {
  StatsOverview: undefined;
  StatBreakdown: { kind: 'players' | 'opponents' | 'heroes' | 'maps' | 'trends' };
};

const Stack = createNativeStackNavigator<StatsStackParamList>();

export function StatsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StatsOverview" component={StatsOverviewScreen} />
      <Stack.Screen name="StatBreakdown" component={StatBreakdownScreen} />
    </Stack.Navigator>
  );
}
