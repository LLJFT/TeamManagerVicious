import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, SubscriptionPlanCard } from '@/components';
import { useAuth } from '@/auth/AuthContext';

const PLAN_KEYS = ['starter', 'pro', 'org'] as const;
type PlanKey = (typeof PLAN_KEYS)[number];

export function SubscriptionsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { user } = useAuth();
  const activePlan: PlanKey | null = user?.subscription?.status === 'active' ? 'pro' : null;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('subscriptions.title')} onBack={nav.canGoBack() ? () => nav.goBack() : undefined} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ gap: spacing.md }}>
          {PLAN_KEYS.map((key) => {
            const features = t(`subscriptions.plans.${key}.features`, { returnObjects: true }) as string[];
            return (
              <SubscriptionPlanCard
                key={key}
                testID={`plan-${key}`}
                name={t(`subscriptions.plans.${key}.name`)}
                price={t(`subscriptions.plans.${key}.price`)}
                features={Array.isArray(features) ? features : []}
                active={activePlan === key}
                onSelect={() => {}}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
