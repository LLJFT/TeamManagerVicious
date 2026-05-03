import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, Card, Text, SkeletonList } from '@/components';
import type { EventsStackParamList } from '@/navigation/stacks/EventsStack';

type Opponent = { id: number; name: string; region?: string; meetings?: number; winRate?: number; notes?: string };

export function OpponentDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const route = useRoute<RouteProp<EventsStackParamList, 'OpponentDetail'>>();
  const nav = useNavigation();
  const { id, name } = route.params;
  const { data, isLoading } = useQuery<Opponent>({ queryKey: ['/api/opponents', id] });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={data?.name ?? name ?? '#' + id} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {isLoading ? <SkeletonList rows={3} /> : (
          <Card>
            <Text variant="caption" tone="secondary">{data?.region}</Text>
            <Text variant="body" style={{ marginTop: spacing.sm }}>
              {data?.meetings ?? 0} {t('opponent.matches')} · {data?.winRate ?? 0}% {t('opponent.wr')}
            </Text>
            {data?.notes ? <Text variant="body" tone="secondary" style={{ marginTop: spacing.md }}>{data.notes}</Text> : null}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
