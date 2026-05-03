import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, SubscriptionPlanCard } from '@/components';
import { useAuth } from '@/auth/AuthContext';

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$0 / month', features: ['Basic roster', 'Up to 1 team', 'Email support'] },
  { id: 'pro', name: 'Pro', price: '$29 / month', features: ['Unlimited teams', 'Advanced analytics', 'Priority support'] },
  { id: 'org', name: 'Organisation', price: 'Contact us', features: ['SSO', 'Dedicated CSM', 'SLA & training'] },
];

export function SubscriptionsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { user } = useAuth();
  const activePlan = user?.subscription?.status === 'active' ? 'pro' : null;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('subscriptions.title')} onBack={nav.canGoBack() ? () => nav.goBack() : undefined} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ gap: spacing.md }}>
          {PLANS.map((p) => (
            <SubscriptionPlanCard
              key={p.id}
              testID={`plan-${p.id}`}
              name={p.name}
              price={p.price}
              features={p.features}
              active={activePlan === p.id}
              onSelect={() => {}}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
