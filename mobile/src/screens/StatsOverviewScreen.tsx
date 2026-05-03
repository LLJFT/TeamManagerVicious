import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, ListItem, StatCard } from '@/components';
import type { StatsStackParamList } from '@/navigation/stacks/StatsStack';

export function StatsOverviewScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<StatsStackParamList>>();
  const sections: { key: 'players' | 'opponents' | 'heroes' | 'maps' | 'trends'; label: string }[] = [
    { key: 'players', label: t('stats.players') },
    { key: 'opponents', label: t('stats.opponents') },
    { key: 'heroes', label: t('stats.heroes') },
    { key: 'maps', label: t('stats.maps') },
    { key: 'trends', label: t('stats.trends') },
  ];
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('stats.title')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
          <StatCard label="Win rate" value="—" tone="success" />
          <StatCard label="Matches" value="—" />
          <StatCard label="K/D" value="—" />
        </View>
        <View>
          {sections.map((s) => (
            <ListItem
              key={s.key}
              title={s.label}
              testID={`stats-${s.key}`}
              onPress={() => nav.navigate('StatBreakdown', { kind: s.key })}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
