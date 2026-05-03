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

type Role = {
  id: string;
  name: string;
  isSystem?: boolean | null;
  permissions: string[];
};

export function AdminRolesScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { show } = useToast();
  const { hasOrgRole } = useAuth();
  const canManage = hasOrgRole('super_admin', 'org_admin');

  const { data, isLoading, isError, refetch } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    enabled: canManage,
  });

  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
  const onErr = (e: any) => show(e?.message ?? t('common.error'), 'danger');

  const createMut = useMutation({
    mutationFn: (b: { name: string; permissions: string[] }) =>
      apiRequest('/api/roles', { method: 'POST', body: JSON.stringify(b) }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
      show(t('admin.created'), 'success');
    },
    onError: onErr,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...b }: { id: string; name?: string; permissions?: string[] }) =>
      apiRequest(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      show(t('admin.saved'), 'success');
    },
    onError: onErr,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      show(t('admin.deleted'), 'success');
    },
    onError: onErr,
  });

  if (!canManage) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title={t('more.roles')} onBack={() => nav.goBack()} />
        <ErrorState title={t('errors.forbidden')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title={t('more.roles')}
        onBack={() => nav.goBack()}
        right={<Button title={t('admin.addRole')} size="sm" onPress={() => setCreating(true)} testID="button-add-role" />}
      />
      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title={t('empty.roles')} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card testID={`row-role-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text variant="body" style={{ fontWeight: '600', flex: 1 }} testID={`text-role-name-${item.id}`}>
                  {item.name}
                </Text>
                {item.isSystem ? <Badge label={t('admin.systemRole')} tone="info" /> : null}
                <Badge label={`${item.permissions?.length ?? 0}`} tone="neutral" />
              </View>
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button
                  title={t('common.edit')}
                  size="sm"
                  variant="outline"
                  onPress={() => setEditing(item)}
                  testID={`button-edit-role-${item.id}`}
                />
                {!item.isSystem ? (
                  <Button
                    title={t('common.delete')}
                    size="sm"
                    variant="destructive"
                    onPress={() => deleteMut.mutate(item.id)}
                    testID={`button-delete-role-${item.id}`}
                  />
                ) : null}
              </View>
            </Card>
          )}
        />
      )}

      <BottomSheet visible={creating} onClose={() => setCreating(false)} title={t('admin.addRole')} testID="sheet-create-role">
        <RoleForm onSubmit={(v) => createMut.mutate(v)} loading={createMut.isPending} />
      </BottomSheet>

      <BottomSheet visible={!!editing} onClose={() => setEditing(null)} title={t('common.edit')} testID="sheet-edit-role">
        {editing ? (
          <RoleForm
            initial={{ name: editing.name, permissions: editing.permissions ?? [] }}
            disableName={editing.isSystem === true}
            onSubmit={(v) => updateMut.mutate({ id: editing.id, ...v })}
            loading={updateMut.isPending}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function RoleForm({
  initial,
  onSubmit,
  loading,
  disableName,
}: {
  initial?: { name: string; permissions: string[] };
  onSubmit: (b: { name: string; permissions: string[] }) => void;
  loading: boolean;
  disableName?: boolean;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [perms, setPerms] = useState((initial?.permissions ?? []).join(', '));
  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label={t('admin.name')}
        value={name}
        onChangeText={setName}
        editable={!disableName}
        testID="input-role-name"
      />
      <TextField
        label={t('admin.permissions')}
        value={perms}
        onChangeText={setPerms}
        autoCapitalize="none"
        multiline
        style={{ minHeight: 80, paddingTop: 10 }}
        placeholder={t('admin.permissionsHelp')}
        testID="input-role-permissions"
      />
      <Button
        title={t('common.save')}
        onPress={() =>
          onSubmit({
            name: name.trim(),
            permissions: perms
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        disabled={!name.trim()}
        loading={loading}
        fullWidth
        testID="button-submit-role"
      />
    </View>
  );
}
