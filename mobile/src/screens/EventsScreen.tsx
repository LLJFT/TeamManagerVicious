import React, { useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, FilterChips, EventCard, EmptyState, SkeletonList, type EventCardData } from '@/components';
import type { EventsStackParamList } from '@/navigation/stacks/EventsStack';

export function EventsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const { data, isLoading } = useQuery<EventCardData[]>({ queryKey: ['/api/events'] });
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const items = useMemo(() => {
    const list = data ?? [];
    if (tab === 'upcoming') return list.filter((e) => !e.result || e.result === 'pending');
    return list.filter((e) => e.result && e.result !== 'pending');
  }, [data, tab]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('events.title')} />
      <View style={{ paddingVertical: spacing.md }}>
        <FilterChips
          value={tab}
          onChange={(v) => setTab(v as any)}
          options={[
            { value: 'upcoming', label: t('events.upcoming') },
            { value: 'past', label: t('events.past') },
          ]}
        />
      </View>
      {isLoading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty.events')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              testID={`event-${item.id}`}
              onPress={() => nav.navigate('EventDetail', { id: Number(item.id), title: item.title })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
