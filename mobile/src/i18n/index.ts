import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { en } from './en';
import { ar } from './ar';

export type SupportedLanguage = 'en' | 'ar';
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'عربي' },
];

const STORAGE_KEY = 'i18n.language';

export function isRtl(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as SupportedLanguage);
}

export async function bootstrapI18n() {
  const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as SupportedLanguage | null;
  const detected = (Localization.getLocales()[0]?.languageCode ?? 'en') as string;
  const initial = stored ?? (SUPPORTED_LANGUAGES.find((l) => l.code === detected)?.code ?? 'en');

  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: initial,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  applyRtl(initial);
}

/**
 * Toggle RTL via I18nManager.forceRTL. Native side requires a JS reload to
 * fully apply layout direction. We persist the language and the caller is
 * expected to call `Updates.reloadAsync()` (or prompt the user to restart)
 * when crossing the RTL boundary.
 */
export function applyRtl(lang: string) {
  const shouldBeRtl = isRtl(lang);
  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.allowRTL(shouldBeRtl);
    I18nManager.forceRTL(shouldBeRtl);
  }
}

export async function changeLanguage(lang: SupportedLanguage) {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
  applyRtl(lang);
}

export default i18n;
