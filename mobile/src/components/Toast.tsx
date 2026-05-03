import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '@/theme/ThemeProvider';

type ToastTone = 'default' | 'success' | 'danger' | 'warning';
type Toast = { id: number; message: string; tone: ToastTone };
type Ctx = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast requires ToastProvider');
  return ctx;
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.md }]}>
      {toasts.map((t) => {
        const bg =
          t.tone === 'success' ? colors.success
          : t.tone === 'danger' ? colors.danger
          : t.tone === 'warning' ? colors.warning
          : colors.surface;
        return (
          <View
            key={t.id}
            style={{
              backgroundColor: bg,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radii.md,
              marginBottom: spacing.sm,
              minWidth: 200,
            }}
          >
            <Text variant="body" style={{ color: t.tone === 'default' ? colors.text : '#fff' }}>
              {t.message}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
});
