import { useQuery } from '@tanstack/react-query';
import type { AuthUser } from '../lib/auth';
import { withBase } from '../lib/url';
import { useAuthConfig } from './useAuthConfig';

export interface AuthSession {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  data: { user: AuthUser } | null;
}

export function useAuth(): AuthSession {
  const { authRequired } = useAuthConfig();

  if (authRequired === false) {
    return {
      status: 'authenticated',
      data: null,
    };
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: could be skipped if auth not required
  const { data, isLoading } = useQuery<{
    user?: AuthUser;
    expires: string;
  }>({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const response = await fetch(withBase('/api/auth/session'));
      if (!response.ok) {
        throw new Error('Failed to get session');
      }
      return response.json();
    },
    retry: false,
    staleTime: 60000,
  });

  if (authRequired === null) {
    return {
      status: 'loading',
      data: null,
    };
  }

  if (isLoading) {
    return {
      status: 'loading',
      data: null,
    };
  }

  if (data?.user) {
    return {
      status: 'authenticated',
      data: {
        user: data.user,
      },
    };
  }

  return {
    status: 'unauthenticated',
    data: null,
  };
}
