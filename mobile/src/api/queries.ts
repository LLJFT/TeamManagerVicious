import { QueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [path, ...rest] = queryKey as [string, ...unknown[]];
        const suffix = rest
          .filter((p) => p !== undefined && p !== null)
          .map((p) => String(p))
          .join('/');
        const full = suffix ? `${path}/${suffix}` : path;
        return apiRequest(full);
      },
      retry: 1,
      staleTime: 30_000,
    },
  },
});
