import { createContext, useContext, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserWithRole, Permission } from "@shared/schema";

interface AuthContextType {
  user: UserWithRole | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<UserWithRole>;
  register: (username: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  hasPermission: (perm: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useQuery<UserWithRole>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (error) {
      const msg = (error as any)?.message || "";
      if (msg.includes("403") || msg.includes("banned")) {
        queryClient.clear();
      }
    }
  }, [error]);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", { username, password });
      return res.json();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.clear();
    },
  });

  const login = useCallback(async (username: string, password: string) => {
    return loginMutation.mutateAsync({ username, password });
  }, [loginMutation]);

  const register = useCallback(async (username: string, password: string) => {
    return registerMutation.mutateAsync({ username, password });
  }, [registerMutation]);

  const logout = useCallback(async () => {
    return logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const hasPermission = useCallback((perm: Permission): boolean => {
    if (!user?.role) return false;
    if (user.role.name === "Owner") return true;
    const perms = user.role.permissions as string[];
    return perms.includes(perm);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user: user ?? null,
      isLoading,
      login,
      register,
      logout,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
