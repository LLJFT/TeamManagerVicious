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
  useToast,
} from '@/components';
import { apiRequest } from '@/api/client';
import { queryClient } from '@/api/queries';
import { useAuth } from '@/auth/AuthContext';

type Assignment = {
  id: string;
  userId: string;
  gameId: string;
  rosterId?: string | null;
  gameName?: string;
  rosterName?: string | null;
  assignedRole?: string;
  status: string;
};

type AdminUser = {
  id: string;
  username: string;
  gameAssignments?: Assignment[];
};

type SupportedGame = { id: string; name: string };
type Roster = { id: string; name: string; gameId: string };

export function AdminGameAccessScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const nav = useNavigation();
  const { show } = useToast();
  const { hasOrgRole } = useAuth();
  const canView = hasOrgRole('super_admin', 'org_admin', 'game_manager');
  const canManage = hasOrgRole('super_admin', 'org_admin');

  const { data: users, isLoading, isError, refetch } = useQuery<AdminUser[]>({
    queryKey: ['/api/all-users'],
    enabled: canManage,
  });
  const { data: games } = useQuery<SupportedGame[]>({
    queryKey: ['/api/supported-games'],
    enabled: canManage,
  });
  const { data: rosters } = useQuery<Roster[]>({
    queryKey: ['/api/rosters'],
    enabled: canManage,
  });

  const [q, setQ] = useState('');
  const [granting, setGranting] = useState<AdminUser | null>(null);

  const items = useMemo(() => {
    const list = users ?? [];
    if (!q) return list;
    const ql = q.toLowerCase();
    return list.filter((u) => u.username.toLowerCase().includes(ql));
  }, [users, q]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/all-users'] });
  const onErr = (e: any) => show(e?.message ?? t('common.error'), 'danger');

  const grantMut = useMutation({
    mutationFn: (b: { userId: string; gameId: string; rosterId?: string | null }) =>
      apiRequest('/api/game-assignments', { method: 'POST', body: JSON.stringify(b) }),
    onSuccess: () => {
      invalidate();
      setGranting(null);
      show(t('admin.created'), 'success');
    },
    onError: onErr,
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/game-assignments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      show(t('admin.deleted'), 'success');
    },
    onError: onErr,
  });

  if (!canView) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title={t('more.gameAccess')} onBack={() => nav.goBack()} />
        <ErrorState title={t('errors.forbidden')} />
      </SafeAreaView>
    );
  }
  if (!canManage) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title={t('more.gameAccess')} onBack={() => nav.goBack()} />
        <ErrorState title={t('errors.forbidden')} description={t('admin.needSuperAdmin')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={t('more.gameAccess')} onBack={() => nav.goBack()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <SearchBar value={q} onChange={setQ} testID="input-search-access" />
      </View>

      {isLoading ? (
        <SkeletonList />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty.users')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Card testID={`row-access-user-${item.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text variant="body" style={{ fontWeight: '600', flex: 1 }}>
                  {item.username}
                </Text>
                <Button
                  title={t('admin.grantAccess')}
                  size="sm"
                  onPress={() => setGranting(item)}
                  testID={`button-grant-${item.id}`}
                />
              </View>
              {item.gameAssignments && item.gameAssignments.length > 0 ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  {item.gameAssignments.map((a) => (
                    <View
                      key={a.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}
                      testID={`row-assignment-${a.id}`}
                    >
                      <Badge
                        label={`${a.gameName ?? a.gameId}${a.rosterName ? ` · ${a.rosterName}` : ''}`}
                        tone={a.status === 'approved' ? 'success' : 'warning'}
                      />
                      <View style={{ flex: 1 }} />
                      <Button
                        title={t('common.delete')}
                        size="sm"
                        variant="destructive"
                        onPress={() => revokeMut.mutate(a.id)}
                        testID={`button-revoke-${a.id}`}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xs }}>
                  {t('empty.assignments')}
                </Text>
              )}
            </Card>
          )}
        />
      )}

      <BottomSheet
        visible={!!granting}
        onClose={() => setGranting(null)}
        title={`${t('admin.grantAccess')} – ${granting?.username ?? ''}`}
        testID="sheet-grant-access"
      >
        {granting ? (
          <GrantForm
            games={games ?? []}
            rosters={rosters ?? []}
            onSubmit={(b) => grantMut.mutate({ userId: granting.id, ...b })}
            loading={grantMut.isPending}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function GrantForm({
  games,
  rosters,
  onSubmit,
  loading,
}: {
  games: SupportedGame[];
  rosters: Roster[];
  onSubmit: (b: { gameId: string; rosterId?: string | null }) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [gameId, setGameId] = useState<string | null>(null);
  const [rosterId, setRosterId] = useState<string | null>(null);
  const eligibleRosters = rosters.filter((r) => r.gameId === gameId);
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="caption" tone="secondary">{t('admin.game')}</Text>
      <View style={{ gap: spacing.xs }}>
        {games.length === 0 ? (
          <Text variant="caption" tone="tertiary">{t('common.noData')}</Text>
        ) : (
          games.map((g) => (
            <Button
              key={g.id}
              title={g.name}
              variant={gameId === g.id ? 'primary' : 'outline'}
              fullWidth
              onPress={() => {
                setGameId(g.id);
                setRosterId(null);
              }}
              testID={`button-grant-game-${g.id}`}
            />
          ))
        )}
      </View>
      {gameId ? (
        <>
          <Text variant="caption" tone="secondary">{t('admin.roster')}</Text>
          <View style={{ gap: spacing.xs }}>
            <Button
              title={t('common.noData')}
              variant={rosterId === null ? 'primary' : 'outline'}
              fullWidth
              onPress={() => setRosterId(null)}
              testID="button-grant-roster-none"
            />
            {eligibleRosters.map((r) => (
              <Button
                key={r.id}
                title={r.name}
                variant={rosterId === r.id ? 'primary' : 'outline'}
                fullWidth
                onPress={() => setRosterId(r.id)}
                testID={`button-grant-roster-${r.id}`}
              />
            ))}
          </View>
        </>
      ) : null}
      <Button
        title={t('common.save')}
        disabled={!gameId}
        loading={loading}
        fullWidth
        onPress={() => gameId && onSubmit({ gameId, rosterId })}
        testID="button-submit-grant"
      />
    </View>
  );
}
