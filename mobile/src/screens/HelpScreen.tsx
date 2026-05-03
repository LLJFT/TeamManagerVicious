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
        <ExpandableSection title={t('help.sections.gettingStarted.title')} defaultOpen>
          <Text variant="body" tone="secondary">{t('help.sections.gettingStarted.body')}</Text>
        </ExpandableSection>
        <ExpandableSection title={t('help.sections.roles.title')}>
          <Text variant="body" tone="secondary">{t('help.sections.roles.body')}</Text>
        </ExpandableSection>
        <ExpandableSection title={t('help.sections.languages.title')}>
          <Text variant="body" tone="secondary">{t('help.sections.languages.body')}</Text>
        </ExpandableSection>
        <Button title={t('help.contact')} variant="outline" onPress={() => {}} />
      </ScrollView>
    </SafeAreaView>
  );
}
