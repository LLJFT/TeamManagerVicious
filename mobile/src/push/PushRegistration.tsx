import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import {
  getOptIn,
  hasPrompted,
  markPrompted,
  registerForPushNotifications,
  setOptIn,
} from './registerPush';

/**
 * Mounted once inside the auth provider. After the user is signed in, prompts
 * for notification opt-in on first launch and registers an Expo push token
 * with the backend whenever the user has opted in.
 */
export function PushRegistration() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const lastUserId = useRef<string | number | null>(null);

  useEffect(() => {
    if (!user) {
      lastUserId.current = null;
      return;
    }
    if (lastUserId.current === user.id) return;
    lastUserId.current = user.id;

    (async () => {
      if (!(await hasPrompted())) {
        await markPrompted();
        Alert.alert(
          t('push.promptTitle'),
          t('push.promptBody'),
          [
            {
              text: t('push.notNow'),
              style: 'cancel',
              onPress: async () => {
                await setOptIn(false);
              },
            },
            {
              text: t('push.enable'),
              onPress: async () => {
                await setOptIn(true);
                await registerForPushNotifications();
              },
            },
          ],
        );
        return;
      }
      if (await getOptIn()) {
        await registerForPushNotifications();
      }
    })().catch(() => {});
  }, [user, t]);

  return null;
}
