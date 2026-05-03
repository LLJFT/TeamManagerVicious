import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/auth/AuthContext';
import { ToastProvider } from '@/components';
import { queryClient } from '@/api/queries';
import { bootstrapI18n } from '@/i18n';
import { RootNavigator } from '@/navigation/RootNavigator';
import { PushRegistration } from '@/push/PushRegistration';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    bootstrapI18n().finally(() => setI18nReady(true));
  }, []);

  // Don't block forever on fonts — render with system font once i18n is ready,
  // and the provider will swap to Inter the moment the family resolves.
  const ready = i18nReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <FontsBridge fontsLoaded={fontsLoaded} />
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <ThemedStatusBar />
                <PushRegistration />
                <RootNavigator />
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function FontsBridge({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { setFontsLoaded } = useTheme();
  useEffect(() => {
    if (fontsLoaded) setFontsLoaded(true);
  }, [fontsLoaded, setFontsLoaded]);
  return null;
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
