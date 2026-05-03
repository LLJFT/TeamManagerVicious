import React, { useMemo, useState } from 'react';
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
  SearchBar,
  SkeletonList,
  Text,
  Badge,
  BottomSheet,
  ActionMenu,
  TextField,
  useToast,
} from '@/components';
import { apiRequest } from '@/api/client';
import { queryClient } from '@/api/queries';
import { useAuth, type OrgRole } from '@/auth/AuthContext';

type AdminUser = {
  id: string;
  username: string;
  displayName?: string | null;
  orgRole: OrgRole;
  status: 'active' | 'banned' | 'pending' | string;
  role?: { id: string; name: string } | null;
};

const ORG_ROLE_OPTIONS: { value: OrgRole; labelKey: string }[] = [
  { value: 'player', labelKey: 'admin.rolePlayer' },
  { value: 'coach_analyst', labelKey: 'admin.roleStaff' },
  { value: 'game_manager', labelKey: 'admin.roleManager' },
  { value: 'org_admin', labelKey: 'admin.roleAdmin' },
];

export function AdminUsersScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { show } = useToast();
  const { hasOrgRole, user: me } = useAuth();
  const canManage = hasOrgRole('super_admin', 'org_admin');

  const { data, isLoading, isError, refetch } = useQuery<AdminUser[]>({
    queryKey: ['/api/users'],
    enabled: canManage,
  });

  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [actionFor, setActionFor] = useState<AdminUser | null>(null);
  const [renameFor, setRenameFor] = useState<AdminUser | null>(null);
  const [roleFor, setRoleFor] = useState<AdminUser | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);

  const items = useMemo(() => {
    const list = data ?? [];
    if (!q) return list;
    const ql = q.toLowerCase();
    return list.filter(
      (u) => u.username.toLowerCase().includes(ql) || (u.displayName ?? '').toLowerCase().includes(ql),
    );
  }, [data, q]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });

  const onErr = (e: any) => show(e?.message ?? t('common.error'), 'danger');

  const createMut = useMutation({
    mutationFn: (b: { username: string; password: string }) =>
      apiRequest('/api/users/create', { method: 'POST', body: JSON.stringify(b) }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      show(t('admin.created'), 'success');
    },
    onError: onErr,
  });

  const renameMut = useMutation({
    mutationFn: ({ id, username }: { id: string; username: string }) =>
      apiRequest(`/api/users/${id}/rename`, { method: 'PUT', body: JSON.stringify({ username }) }),
    onSuccess: () => {
      invalidate();
      setRenameFor(null);
      show(t('admin.saved'), 'success');
    },
    onError: onErr,
  });

  const orgRoleMut = useMutation({
    mutationFn: ({ id, orgRole }: { id: string; orgRole: OrgRole }) =>
      apiRequest(`/api/users/${id}/org-role`, { method: 'PUT', body: JSON.stringify({ orgRole }) }),
    onSuccess: () => {
      invalidate();
      setRoleFor(null);
      show(t('admin.saved'), 'success');
    },
    onError: onErr,
  });

  const banMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'banned' }) =>
      apiRequest(`/api/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      invalidate();
      show(t('admin.saved'), 'success');
    },
    onError: onErr,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/users/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      show(t('admin.saved'), 'success');
    },
    onError: onErr,
  });

  const resetMut = useMutation<{ tempPassword: string }, Error, string>({
    mutationFn: (id: string) =>
      apiRequest(`/api/users/${id}/reset-password`, { method: 'PUT' }),
    onSuccess: (res) => setTempPw(res.tempPassword),
    onError: onErr,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      show(t('admin.deleted'), 'success');
    },
    onError: onErr,
  });

  if (!canManage) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title={t('more.users')} onBack={() => nav.goBack()} />
        <ErrorState title={t('errors.forbidden')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title={t('more.users')}
        onBack={() => nav.goBack()}
        right={<Button title={t('admin.addUser')} size="sm" onPress={() => setCreateOpen(true)} testID="button-add-user" />}
      />
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <SearchBar value={q} onChange={setQ} testID="input-search-users" />
      </View>
      {tempPw ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Card>
            <Text variant="caption" tone="secondary">{t('admin.tempPassword')}</Text>
            <Text variant="title" testID="text-temp-password">{tempPw}</Text>
            <View style={{ marginTop: spacing.sm }}>
              <Button title={t('common.close')} variant="outline" size="sm" onPress={() => setTempPw(null)} />
            </View>
          </Card>
        </View>
      ) : null}

      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty.users')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card testID={`row-user-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text variant="body" style={{ fontWeight: '600', flex: 1 }} testID={`text-username-${item.id}`}>
                  {item.username}
                </Text>
                <Badge
                  label={
                    item.status === 'active'
                      ? t('admin.statusActive')
                      : item.status === 'banned'
                      ? t('admin.statusBanned')
                      : t('admin.statusPending')
                  }
                  tone={item.status === 'active' ? 'success' : item.status === 'banned' ? 'danger' : 'warning'}
                />
                <Badge label={labelForOrgRole(item.orgRole, t)} tone="neutral" />
                {item.role ? <Badge label={item.role.name} tone="info" /> : null}
              </View>
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {item.status === 'pending' ? (
                  <Button
                    title={t('admin.approve')}
                    size="sm"
                    onPress={() => approveMut.mutate(item.id)}
                    testID={`button-approve-${item.id}`}
                  />
                ) : null}
                <Button
                  title={t('admin.actions')}
                  size="sm"
                  variant="outline"
                  onPress={() => setActionFor(item)}
                  testID={`button-actions-${item.id}`}
                />
              </View>
            </Card>
          )}
        />
      )}

      <BottomSheet visible={createOpen} onClose={() => setCreateOpen(false)} title={t('admin.addUser')} testID="sheet-create-user">
        <CreateUserForm
          onSubmit={(b) => createMut.mutate(b)}
          loading={createMut.isPending}
        />
      </BottomSheet>

      <ActionMenu
        visible={!!actionFor}
        onClose={() => setActionFor(null)}
        title={actionFor?.username}
        items={
          actionFor
            ? [
                { key: 'rename', label: t('admin.rename'), onPress: () => setRenameFor(actionFor) },
                { key: 'role', label: t('admin.orgRole'), onPress: () => setRoleFor(actionFor) },
                { key: 'reset', label: t('admin.resetPassword'), onPress: () => resetMut.mutate(actionFor.id) },
                {
                  key: 'ban',
                  label: actionFor.status === 'banned' ? t('admin.unban') : t('admin.ban'),
                  onPress: () =>
                    banMut.mutate({
                      id: actionFor.id,
                      status: actionFor.status === 'banned' ? 'active' : 'banned',
                    }),
                },
                ...(String(me?.id) !== String(actionFor.id)
                  ? [{ key: 'delete', label: t('common.delete'), destructive: true, onPress: () => deleteMut.mutate(actionFor.id) }]
                  : []),
              ]
            : []
        }
      />

      <BottomSheet visible={!!renameFor} onClose={() => setRenameFor(null)} title={t('admin.rename')} testID="sheet-rename-user">
        {renameFor ? (
          <RenameForm
            initial={renameFor.username}
            onSubmit={(name) => renameMut.mutate({ id: renameFor.id, username: name })}
            loading={renameMut.isPending}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!roleFor} onClose={() => setRoleFor(null)} title={t('admin.orgRole')} testID="sheet-role-user">
        {roleFor ? (
          <View style={{ gap: spacing.sm }}>
            {ORG_ROLE_OPTIONS.map((o) => (
              <Button
                key={o.value}
                title={t(o.labelKey)}
                variant={roleFor.orgRole === o.value ? 'primary' : 'outline'}
                fullWidth
                onPress={() => orgRoleMut.mutate({ id: roleFor.id, orgRole: o.value })}
                testID={`button-orgrole-${o.value}`}
              />
            ))}
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function labelForOrgRole(role: OrgRole | string, t: (k: string) => string): string {
  switch (role) {
    case 'super_admin':
      return t('admin.roleSuper');
    case 'org_admin':
      return t('admin.roleAdmin');
    case 'game_manager':
      return t('admin.roleManager');
    case 'coach_analyst':
      return t('admin.roleStaff');
    default:
      return t('admin.rolePlayer');
  }
}

function CreateUserForm({ onSubmit, loading }: { onSubmit: (b: { username: string; password: string }) => void; loading: boolean }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  return (
    <View style={{ gap: spacing.md }}>
      <TextField label={t('admin.username')} value={u} onChangeText={setU} autoCapitalize="none" testID="input-new-username" />
      <TextField label={t('admin.password')} value={p} onChangeText={setP} secureTextEntry testID="input-new-password" />
      <Button
        title={t('common.save')}
        onPress={() => onSubmit({ username: u.trim(), password: p })}
        disabled={!u.trim() || !p}
        loading={loading}
        fullWidth
        testID="button-submit-create-user"
      />
    </View>
  );
}

function RenameForm({ initial, onSubmit, loading }: { initial: string; onSubmit: (v: string) => void; loading: boolean }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [v, setV] = useState(initial);
  return (
    <View style={{ gap: spacing.md }}>
      <TextField label={t('admin.username')} value={v} onChangeText={setV} autoCapitalize="none" testID="input-rename" />
      <Button
        title={t('common.save')}
        onPress={() => onSubmit(v.trim())}
        disabled={!v.trim() || v.trim() === initial}
        loading={loading}
        fullWidth
        testID="button-submit-rename"
      />
    </View>
  );
}
