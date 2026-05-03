import React, { useEffect, useState } from 'react';
import { ScrollView, View, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as Updates from 'expo-updates';
import { useTheme } from '@/theme/ThemeProvider';
import { AppHeader, SettingsRow, BottomSheet, ListItem, Button, Text, useToast } from '@/components';
import { useAuth } from '@/auth/AuthContext';
import { changeLanguage, isRtl, SUPPORTED_LANGUAGES, SupportedLanguage } from '@/i18n';
import { getOptIn, setPushEnabled } from '@/push/registerPush';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, scheme, setScheme } = useTheme();
  const nav = useNavigation();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getOptIn().then(setPushEnabledState);
  }, []);

  const onTogglePush = async (next: boolean) => {
    setPushBusy(true);
    try {
      await setPushEnabled(next);
      setPushEnabledState(next);
      toast.show(next ? t('push.enabledToast') : t('push.disabledToast'), 'success');
    } catch {
      toast.show(t('common.error'), 'error');
    } finally {
      setPushBusy(false);
    }
  };

  const onPickLanguage = async (code: SupportedLanguage) => {
    const wasRtl = isRtl(i18n.language);
    const willBeRtl = isRtl(code);
    await changeLanguage(code);
    setLangOpen(false);
    if (wasRtl !== willBeRtl) {
      Alert.alert(t('settings.title'), t('settings.requiresRestart'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.restartNow'), onPress: () => Updates.reloadAsync().catch(() => {}) },
      ]);
    } else {
      toast.show(t('common.save'), 'success');
    }
  };

  const themeLabel = scheme === 'dark' ? t('settings.dark') : t('settings.light');
  const langLabel = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.nativeLabel ?? i18n.language;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('settings.title')} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md }}>
        <SettingsRow label={t('settings.theme')} value={themeLabel} onPress={() => setThemeOpen(true)} testID="row-theme" />
        <SettingsRow label={t('settings.language')} value={langLabel} onPress={() => setLangOpen(true)} testID="row-language" />
        <View style={{ height: spacing.lg }} />
        <View
          style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
          testID="row-push-notifications"
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{t('push.title')}</Text>
            <Text tone="secondary" style={{ marginTop: 2 }}>{t('push.subtitle')}</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={onTogglePush}
            disabled={pushBusy}
            testID="switch-push-notifications"
          />
        </View>
        <View style={{ height: spacing.lg }} />
        <SettingsRow label={t('settings.account')} value={user?.username} />
        <SettingsRow label={t('settings.about')} value="v0.1.0" />
        <View style={{ padding: spacing.lg }}>
          <Button title={t('common.signOut')} variant="destructive" fullWidth onPress={signOut} testID="button-signout" />
        </View>
      </ScrollView>

      <BottomSheet visible={themeOpen} onClose={() => setThemeOpen(false)} title={t('settings.theme')}>
        <ListItem title={t('settings.light')} onPress={() => { setScheme('light'); setThemeOpen(false); }} testID="theme-light" />
        <ListItem title={t('settings.dark')} onPress={() => { setScheme('dark'); setThemeOpen(false); }} testID="theme-dark" />
        <ListItem title={t('settings.system')} onPress={() => { setScheme('system'); setThemeOpen(false); }} testID="theme-system" />
      </BottomSheet>

      <BottomSheet visible={langOpen} onClose={() => setLangOpen(false)} title={t('settings.language')}>
        {SUPPORTED_LANGUAGES.map((l) => (
          <ListItem
            key={l.code}
            title={l.nativeLabel}
            subtitle={l.label}
            onPress={() => onPickLanguage(l.code)}
            testID={`lang-${l.code}`}
          />
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}
