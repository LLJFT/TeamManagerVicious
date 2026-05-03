import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest, setSessionCookie } from '@/api/client';

export type OrgRole = 'super_admin' | 'org_admin' | 'game_manager' | 'coach_analyst' | 'player';

export type AuthUser = {
  id: number;
  username: string;
  orgRole: OrgRole;
  role?: { id: number; name: string; permissions?: string[] };
  subscription?: { status: string; endsAt?: string | null };
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasOrgRole: (...roles: OrgRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await apiRequest<AuthUser>('/api/auth/me');
      setUser(me ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const res = await apiRequest<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setUser(res);
    } catch (e: any) {
      setError(e?.message ?? 'Sign in failed');
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {}
    await setSessionCookie(null);
    setUser(null);
  }, []);

  const hasOrgRole = useCallback(
    (...roles: OrgRole[]) => !!user?.orgRole && roles.includes(user.orgRole),
    [user],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.orgRole === 'super_admin' || user.orgRole === 'org_admin') return true;
      return user.role?.permissions?.includes(permission) ?? false;
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signOut, hasOrgRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
