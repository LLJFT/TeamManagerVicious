import React, { useState } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonList,
  Text,
  Badge,
  BottomSheet,
  TextField,
  useToast,
} from '@/components';
import { apiRequest } from '@/api/client';
import { queryClient } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';

type Template = {
  id: string;
  name: string;
  code: string;
  gameId: string;
};

type SupportedGame = { id: string; name: string };

export function AdminGameTemplatesScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { show } = useToast();
  const { hasOrgRole } = useAuth();
  const canManage = hasOrgRole('super_admin');

  const { data, isLoading, isError, refetch } = useQuery<Template[]>({
    queryKey: ['/api/game-templates'],
    enabled: canManage,
  });
  const { data: games } = useQuery<SupportedGame[]>({
    queryKey: ['/api/supported-games'],
    enabled: canManage,
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/game-templates'] });
  const onErr = (e: any) => show(e?.message ?? t('common.error'), 'danger');

  const createMut = useMutation({
    mutationFn: (b: { name: string; code: string; gameId: string }) =>
      apiRequest('/api/game-templates', { method: 'POST', body: JSON.stringify(b) }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
      show(t('admin.created'), 'success');
    },
    onError: onErr,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(`/api/game-templates/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      show(t('admin.saved'), 'success');
    },
    onError: onErr,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/game-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      show(t('admin.deleted'), 'success');
    },
    onError: onErr,
  });

  if (!canManage) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title={t('more.gameTemplates')} onBack={() => nav.goBack()} />
        <ErrorState title={t('admin.needSuperAdmin')} />
      </SafeAreaView>
    );
  }

  const gameName = (id: string) => games?.find((g) => g.id === id)?.name ?? id;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title={t('more.gameTemplates')}
        onBack={() => nav.goBack()}
        right={<Button title={t('admin.addTemplate')} size="sm" onPress={() => setCreating(true)} testID="button-add-template" />}
      />
      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title={t('empty.templates')} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card testID={`row-template-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text variant="body" style={{ fontWeight: '600', flex: 1 }} testID={`text-template-name-${item.id}`}>
                  {item.name}
                </Text>
                <Badge label={item.code} tone="info" />
              </View>
              <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
                {gameName(item.gameId)}
              </Text>
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button
                  title={t('common.edit')}
                  size="sm"
                  variant="outline"
                  onPress={() => setEditing(item)}
                  testID={`button-edit-template-${item.id}`}
                />
                <Button
                  title={t('common.delete')}
                  size="sm"
                  variant="destructive"
                  onPress={() => deleteMut.mutate(item.id)}
                  testID={`button-delete-template-${item.id}`}
                />
              </View>
            </Card>
          )}
        />
      )}

      <BottomSheet
        visible={creating}
        onClose={() => setCreating(false)}
        title={t('admin.addTemplate')}
        testID="sheet-create-template"
      >
        <CreateTemplateForm
          games={games ?? []}
          onSubmit={(b) => createMut.mutate(b)}
          loading={createMut.isPending}
        />
      </BottomSheet>

      <BottomSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={t('common.edit')}
        testID="sheet-edit-template"
      >
        {editing ? (
          <EditTemplateForm
            initialName={editing.name}
            onSubmit={(name) => updateMut.mutate({ id: editing.id, name })}
            loading={updateMut.isPending}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function CreateTemplateForm({
  games,
  onSubmit,
  loading,
}: {
  games: SupportedGame[];
  onSubmit: (b: { name: string; code: string; gameId: string }) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [gameId, setGameId] = useState<string | null>(games[0]?.id ?? null);
  return (
    <View style={{ gap: spacing.md }}>
      <TextField label={t('admin.name')} value={name} onChangeText={setName} testID="input-template-name" />
      <TextField
        label={t('admin.code')}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        autoCapitalize="characters"
        testID="input-template-code"
      />
      <Text variant="caption" tone="secondary">{t('admin.game')}</Text>
      <View style={{ gap: spacing.xs }}>
        {games.map((g) => (
          <Button
            key={g.id}
            title={g.name}
            variant={gameId === g.id ? 'primary' : 'outline'}
            fullWidth
            onPress={() => setGameId(g.id)}
            testID={`button-template-game-${g.id}`}
          />
        ))}
      </View>
      <Button
        title={t('common.save')}
        disabled={!name.trim() || code.trim().length < 3 || !gameId}
        loading={loading}
        fullWidth
        onPress={() => gameId && onSubmit({ name: name.trim(), code: code.trim(), gameId })}
        testID="button-submit-template"
      />
    </View>
  );
}

function EditTemplateForm({
  initialName,
  onSubmit,
  loading,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [name, setName] = useState(initialName);
  return (
    <View style={{ gap: spacing.md }}>
      <TextField label={t('admin.name')} value={name} onChangeText={setName} testID="input-template-name" />
      <Button
        title={t('common.save')}
        disabled={!name.trim() || name.trim() === initialName}
        loading={loading}
        fullWidth
        onPress={() => onSubmit(name.trim())}
        testID="button-submit-template"
      />
    </View>
  );
}
