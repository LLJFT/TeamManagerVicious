import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { DashboardStack } from './stacks/DashboardStack';
import { TeamsStack } from './stacks/TeamsStack';
import { EventsStack } from './stacks/EventsStack';
import { StatsStack } from './stacks/StatsStack';
import { MoreStack } from './stacks/MoreStack';

const Tab = createBottomTabNavigator();

function tabIcon(label: string) {
  return ({ color }: { color: string }) => (
    <RNText style={{ color, fontSize: 18, fontWeight: '700' }}>{label}</RNText>
  );
}

export function TabsNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: t('tabs.dashboard'), tabBarIcon: tabIcon('◉'), tabBarTestID: 'tab-dashboard' }}
      />
      <Tab.Screen
        name="TeamsTab"
        component={TeamsStack}
        options={{ title: t('tabs.teams'), tabBarIcon: tabIcon('◍'), tabBarTestID: 'tab-teams' }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventsStack}
        options={{ title: t('tabs.events'), tabBarIcon: tabIcon('▦'), tabBarTestID: 'tab-events' }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsStack}
        options={{ title: t('tabs.stats'), tabBarIcon: tabIcon('▥'), tabBarTestID: 'tab-stats' }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{ title: t('tabs.more'), tabBarIcon: tabIcon('☰'), tabBarTestID: 'tab-more' }}
      />
    </Tab.Navigator>
  );
}
