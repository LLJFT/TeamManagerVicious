import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RosterScreen } from '@/screens/RosterScreen';
import { PlayerDetailScreen } from '@/screens/PlayerDetailScreen';

export type TeamsStackParamList = {
  Roster: undefined;
  PlayerDetail: { id: number; name?: string };
};

const Stack = createNativeStackNavigator<TeamsStackParamList>();

export function TeamsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Roster" component={RosterScreen} />
      <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    </Stack.Navigator>
  );
}
