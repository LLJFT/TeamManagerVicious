import React, { useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, SearchBar, FilterChips, PlayerCard, EmptyState, SkeletonList } from '@/components';
import type { TeamsStackParamList } from '@/navigation/stacks/TeamsStack';

type Player = { id: number; name: string; role?: string; status?: 'available' | 'unavailable' };

export function RosterScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<TeamsStackParamList>>();
  const { data, isLoading } = useQuery<Player[]>({ queryKey: ['/api/players'] });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const items = useMemo(() => {
    return (data ?? []).filter((p) => {
      if (filter === 'available' && p.status !== 'available') return false;
      if (filter === 'unavailable' && p.status !== 'unavailable') return false;
      return p.name.toLowerCase().includes(q.toLowerCase());
    });
  }, [data, q, filter]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('roster.title')} />
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md }}>
        <SearchBar value={q} onChange={setQ} />
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('roster.players') },
            { value: 'available', label: t('roster.available') },
            { value: 'unavailable', label: t('roster.unavailable') },
          ]}
        />
      </View>
      {isLoading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty.players')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <PlayerCard
              testID={`player-${item.id}`}
              name={item.name}
              role={item.role}
              available={item.status ? item.status === 'available' : undefined}
              onPress={() => nav.navigate('PlayerDetail', { id: item.id, name: item.name })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
