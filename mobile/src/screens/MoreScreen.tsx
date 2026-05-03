import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, ListItem, Text } from '@/components';
import { useAuth } from '@/auth/AuthContext';
import type { MoreStackParamList } from '@/navigation/stacks/MoreStack';

export function MoreScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { hasOrgRole } = useAuth();
  const isAdmin = hasOrgRole('super_admin', 'org_admin');
  const isGameManager = hasOrgRole('super_admin', 'org_admin', 'game_manager');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('more.title')} />
      <ScrollView>
        <View style={{ paddingTop: spacing.md }}>
          <ListItem title={t('more.subscription')} testID="row-subscription" onPress={() => nav.navigate('Subscriptions')} />
          <ListItem title={t('more.settings')} testID="row-settings" onPress={() => nav.navigate('Settings')} />
          <ListItem title={t('more.help')} testID="row-help" onPress={() => nav.navigate('Help')} />
        </View>

        {isAdmin || isGameManager ? (
          <View style={{ paddingTop: spacing.lg }}>
            <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xs }}>
              {t('more.admin')}
            </Text>
            {isAdmin ? <ListItem title={t('more.users')} testID="row-admin-users" onPress={() => nav.navigate('AdminUsers')} /> : null}
            {isAdmin ? <ListItem title={t('more.roles')} testID="row-admin-roles" onPress={() => nav.navigate('AdminRoles')} /> : null}
            {isGameManager ? <ListItem title={t('more.gameTemplates')} testID="row-admin-templates" onPress={() => nav.navigate('AdminGameTemplates')} /> : null}
            {isGameManager ? <ListItem title={t('more.gameAccess')} testID="row-admin-access" onPress={() => nav.navigate('AdminGameAccess')} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
