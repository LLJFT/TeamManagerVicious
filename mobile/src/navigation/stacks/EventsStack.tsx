import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EventsScreen } from '@/screens/EventsScreen';
import { EventDetailScreen } from '@/screens/EventDetailScreen';
import { OpponentDetailScreen } from '@/screens/OpponentDetailScreen';

export type EventsStackParamList = {
  Events: undefined;
  EventDetail: { id: number; title?: string };
  OpponentDetail: { id: number; name?: string };
};

const Stack = createNativeStackNavigator<EventsStackParamList>();

export function EventsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="OpponentDetail" component={OpponentDetailScreen} />
    </Stack.Navigator>
  );
}
