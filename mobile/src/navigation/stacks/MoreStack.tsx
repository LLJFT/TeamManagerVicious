import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { SubscriptionsScreen } from '@/screens/SubscriptionsScreen';
import { AdminUsersScreen } from '@/screens/admin/AdminUsersScreen';
import { AdminRolesScreen } from '@/screens/admin/AdminRolesScreen';
import { AdminGameTemplatesScreen } from '@/screens/admin/AdminGameTemplatesScreen';
import { AdminGameAccessScreen } from '@/screens/admin/AdminGameAccessScreen';
import { MoreScreen } from '@/screens/MoreScreen';

export type MoreStackParamList = {
  More: undefined;
  Settings: undefined;
  Help: undefined;
  Subscriptions: undefined;
  AdminUsers: undefined;
  AdminRoles: undefined;
  AdminGameTemplates: undefined;
  AdminGameAccess: undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="More" component={MoreScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminRoles" component={AdminRolesScreen} />
      <Stack.Screen name="AdminGameTemplates" component={AdminGameTemplatesScreen} />
      <Stack.Screen name="AdminGameAccess" component={AdminGameAccessScreen} />
    </Stack.Navigator>
  );
}
