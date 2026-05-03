import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { apiRequest } from '@/api/client';

export const PUSH_OPTIN_KEY = 'push.optedIn';
export const PUSH_TOKEN_KEY = 'push.token';
export const PUSH_PROMPTED_KEY = 'push.prompted';

type Notifications = typeof import('expo-notifications');

let cachedModule: Notifications | null = null;
async function loadNotifications(): Promise<Notifications | null> {
  if (cachedModule) return cachedModule;
  try {
    cachedModule = (await import('expo-notifications')) as Notifications;
    return cachedModule;
  } catch {
    return null;
  }
}

export async function getOptIn(): Promise<boolean> {
  const v = await AsyncStorage.getItem(PUSH_OPTIN_KEY);
  return v === '1';
}

export async function setOptIn(v: boolean): Promise<void> {
  await AsyncStorage.setItem(PUSH_OPTIN_KEY, v ? '1' : '0');
}

export async function hasPrompted(): Promise<boolean> {
  return (await AsyncStorage.getItem(PUSH_PROMPTED_KEY)) === '1';
}

export async function markPrompted(): Promise<void> {
  await AsyncStorage.setItem(PUSH_PROMPTED_KEY, '1');
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

async function fetchExpoToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  if (Platform.OS === 'web') return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const extra = (Constants.expoConfig?.extra ?? {}) as { eas?: { projectId?: string } };
    const easConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig;
    const projectId = extra.eas?.projectId ?? easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenResp.data ?? null;
  } catch (err) {
    console.warn('[push] failed to fetch token:', (err as Error).message);
    return null;
  }
}

/**
 * Ensure an Expo push token is registered with the backend for the signed-in
 * user. Safe to call multiple times. Honors the user's opt-in preference.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!(await getOptIn())) return null;
  const token = await fetchExpoToken();
  if (!token) return null;
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  try {
    await apiRequest('/api/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS, enabled: true }),
    });
  } catch (err) {
    console.warn('[push] failed to register token:', (err as Error).message);
  }
  return token;
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await setOptIn(enabled);
  if (enabled) {
    await registerForPushNotifications();
    return;
  }
  const token = await getStoredToken();
  try {
    await apiRequest('/api/push-tokens', {
      method: 'PATCH',
      body: JSON.stringify({ token, enabled: false }),
    });
  } catch (err) {
    console.warn('[push] failed to disable token:', (err as Error).message);
  }
}
