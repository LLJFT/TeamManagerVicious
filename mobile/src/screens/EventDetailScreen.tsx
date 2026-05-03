import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, Card, Text, ExpandableSection, Badge, SkeletonList } from '@/components';
import type { EventsStackParamList } from '@/navigation/stacks/EventsStack';

type EventDetail = {
  id: number;
  title: string;
  type?: string;
  opponent?: string;
  startsAt?: string;
  result?: 'win' | 'loss' | 'draw' | 'pending';
  notes?: string;
  attendance?: { name: string; status: string }[];
  map?: string;
};

export function EventDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const route = useRoute<RouteProp<EventsStackParamList, 'EventDetail'>>();
  const nav = useNavigation();
  const { id, title } = route.params;
  const { data, isLoading } = useQuery<EventDetail>({ queryKey: ['/api/events', id] });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={data?.title ?? title ?? '#' + id} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="overline" tone="tertiary">{t('events.type')}</Text>
                  <Text variant="title">{data?.type ?? '—'}</Text>
                </View>
                {data?.result ? <Badge label={t(`events.${data.result}`)} tone={data.result === 'win' ? 'success' : data.result === 'loss' ? 'danger' : data.result === 'draw' ? 'warning' : 'neutral'} /> : null}
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Text variant="caption" tone="secondary">{t('events.opponent')}: {data?.opponent ?? '—'}</Text>
                <Text variant="caption" tone="secondary">{data?.startsAt ?? ''}</Text>
              </View>
            </Card>
            <ExpandableSection title={t('eventDetail.attendance')} defaultOpen>
              {(data?.attendance ?? []).length === 0 ? (
                <Text variant="body" tone="secondary">{t('common.noData')}</Text>
              ) : (
                data!.attendance!.map((a) => (
                  <View key={a.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text variant="body">{a.name}</Text>
                    <Text variant="body" tone="secondary">{a.status}</Text>
                  </View>
                ))
              )}
            </ExpandableSection>
            <ExpandableSection title={t('eventDetail.map')}>
              <Text variant="body" tone="secondary">{data?.map ?? t('common.noData')}</Text>
            </ExpandableSection>
            <ExpandableSection title={t('eventDetail.notes')}>
              <Text variant="body" tone="secondary">{data?.notes ?? t('common.noData')}</Text>
            </ExpandableSection>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
