import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { BottomSheet } from './BottomSheet';
import { useGame } from '@/hooks/useGame';
import { useTheme } from '@/theme/ThemeProvider';

export function ScopePicker({ testID }: { testID?: string }) {
  const { colors, spacing, radii } = useTheme();
  const { games, rosters, currentGame, currentRoster, selectGame, selectRoster } = useGame();
  const [open, setOpen] = useState<null | 'game' | 'roster'>(null);

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
      <Pressable
        onPress={() => setOpen('game')}
        testID={testID ? `${testID}-game` : 'scope-game'}
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Text variant="overline" tone="tertiary">Game</Text>
        <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
          {currentGame?.name ?? '—'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setOpen('roster')}
        testID={testID ? `${testID}-roster` : 'scope-roster'}
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Text variant="overline" tone="tertiary">Roster</Text>
        <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>
          {currentRoster?.customName ?? currentRoster?.name ?? '—'}
        </Text>
      </Pressable>

      <BottomSheet visible={open === 'game'} onClose={() => setOpen(null)} title="Choose game">
        {games.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => {
              selectGame(g.id);
              setOpen(null);
            }}
            testID={`scope-game-opt-${g.slug}`}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text variant="body" tone={g.id === currentGame?.id ? 'primary' : 'default'}>
              {g.name}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet visible={open === 'roster'} onClose={() => setOpen(null)} title="Choose roster">
        {rosters.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => {
              selectRoster(r.id);
              setOpen(null);
            }}
            testID={`scope-roster-opt-${r.id}`}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text variant="body" tone={r.id === currentRoster?.id ? 'primary' : 'default'}>
              {r.customName ?? r.name}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}
