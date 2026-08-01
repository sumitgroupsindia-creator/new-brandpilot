import { useMutation, useQuery } from '@tanstack/react-query';
import {
  apiGetMe,
  apiLogin,
  apiRefresh,
  apiRegister,
  apiUpdateMe,
} from '../lib/api';
import { useAuthStore } from '../state/authStore';

export function useMe() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return useQuery({
    queryKey: ['me'],
    queryFn: apiGetMe,
    enabled: isAuthenticated,
  });
}

export function useLogin() {
  const setTokens = useAuthStore(state => state.setTokens);
  return useMutation({
    mutationFn: apiLogin,
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
    },
  });
}

export function useRegister() {
  const setTokens = useAuthStore(state => state.setTokens);
  return useMutation({
    mutationFn: apiRegister,
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
    },
  });
}

export function useRefreshToken() {
  const setTokens = useAuthStore(state => state.setTokens);
  const refreshToken = useAuthStore(state => state.refreshToken);

  return useMutation({
    mutationFn: async () => {
      if (!refreshToken) throw new Error('No refresh token');
      return apiRefresh(refreshToken);
    },
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
    },
  });
}

export function useUpdateMe() {
  return useMutation({
    mutationFn: apiUpdateMe,
  });
}
