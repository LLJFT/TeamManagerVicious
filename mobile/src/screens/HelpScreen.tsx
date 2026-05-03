import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, Card, Text, ExpandableSection, Button } from '@/components';

export function HelpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('help.title')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card>
          <Text variant="body" tone="secondary">{t('help.intro')}</Text>
        </Card>
        <ExpandableSection title="Getting started" defaultOpen>
          <Text variant="body" tone="secondary">Sign in with the credentials provided by your organization admin.</Text>
        </ExpandableSection>
        <ExpandableSection title="Roles & permissions">
          <Text variant="body" tone="secondary">Super admin, org admin, game manager, coach/analyst and player roles control what you can see and edit.</Text>
        </ExpandableSection>
        <ExpandableSection title="Languages & RTL">
          <Text variant="body" tone="secondary">Switching to Arabic requires a quick restart so the layout direction can flip.</Text>
        </ExpandableSection>
        <Button title={t('help.contact')} variant="outline" onPress={() => {}} />
      </ScrollView>
    </SafeAreaView>
  );
}
