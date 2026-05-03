import React, { useState } from 'react';
import { View, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/auth/AuthContext';
import { Text, Button, Card, useToast } from '@/components';

export function LoginScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radii } = useTheme();
  const { signIn } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!username || !password) return;
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (e: any) {
      toast.show(e?.message ?? t('auth.invalid'), 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Text variant="display">Esports HQ</Text>
            <Text variant="caption" tone="secondary">{t('auth.signInDesc')}</Text>
          </View>
          <Card>
            <Text variant="title" style={{ marginBottom: spacing.md }}>{t('auth.signInTitle')}</Text>
            <View style={{ gap: spacing.md }}>
              <View>
                <Text variant="caption" tone="secondary">{t('auth.username')}</Text>
                <TextInput
                  testID="input-username"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                  style={[input(colors, radii, spacing)]}
                />
              </View>
              <View>
                <Text variant="caption" tone="secondary">{t('auth.password')}</Text>
                <TextInput
                  testID="input-password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  style={[input(colors, radii, spacing)]}
                />
              </View>
              <Button
                testID="button-signin"
                title={t('auth.signIn')}
                onPress={onSubmit}
                loading={submitting}
                fullWidth
              />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function input(colors: any, radii: any, spacing: any) {
  return {
    marginTop: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.text,
  } as const;
}
