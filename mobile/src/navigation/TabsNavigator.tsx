import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { DashboardStack } from './stacks/DashboardStack';
import { TeamsStack } from './stacks/TeamsStack';
import { EventsStack } from './stacks/EventsStack';
import { StatsStack } from './stacks/StatsStack';
import { MoreStack } from './stacks/MoreStack';
import { HomeIcon, UsersIcon, CalendarIcon, BarChartIcon, MenuIcon } from '@/components/icons';

const Tab = createBottomTabNavigator();

type IconC = (p: { size?: number; color?: string }) => JSX.Element;
const tabIcon = (Icon: IconC) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon color={color} size={size} />;

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
        options={{ title: t('tabs.dashboard'), tabBarIcon: tabIcon(HomeIcon), tabBarTestID: 'tab-dashboard' }}
      />
      <Tab.Screen
        name="TeamsTab"
        component={TeamsStack}
        options={{ title: t('tabs.teams'), tabBarIcon: tabIcon(UsersIcon), tabBarTestID: 'tab-teams' }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventsStack}
        options={{ title: t('tabs.events'), tabBarIcon: tabIcon(CalendarIcon), tabBarTestID: 'tab-events' }}
      />
      <Tab.Screen
        name="StatsTab"
        component={StatsStack}
        options={{ title: t('tabs.stats'), tabBarIcon: tabIcon(BarChartIcon), tabBarTestID: 'tab-stats' }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{ title: t('tabs.more'), tabBarIcon: tabIcon(MenuIcon), tabBarTestID: 'tab-more' }}
      />
    </Tab.Navigator>
  );
}
