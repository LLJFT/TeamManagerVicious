import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'auth.sessionCookie';

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExtra = (Constants.expoConfig?.extra as any)?.apiBaseUrl;
  return (fromEnv ?? fromExtra ?? 'http://localhost:5000').replace(/\/$/, '');
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let cachedCookie: string | null = null;

async function getCookie(): Promise<string | null> {
  if (cachedCookie) return cachedCookie;
  cachedCookie = await AsyncStorage.getItem(SESSION_KEY);
  return cachedCookie;
}

export async function setSessionCookie(cookie: string | null) {
  cachedCookie = cookie;
  if (cookie) await AsyncStorage.setItem(SESSION_KEY, cookie);
  else await AsyncStorage.removeItem(SESSION_KEY);
}

export async function apiRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const cookie = await getCookie();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(url, { ...init, headers, credentials: 'include' });

  // Capture set-cookie if backend issued a session cookie (RN exposes it).
  const setCookie =
    (res.headers as any).map?.['set-cookie'] ?? res.headers.get('set-cookie');
  if (setCookie) {
    const sid = String(setCookie).split(';')[0];
    if (sid && sid !== cookie) await setSessionCookie(sid);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText, body);
  }
  return body as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
