import { useMutation } from '@tanstack/react-query';
import { adminLogin } from '../lib/api';
import { useAdminAuthStore } from '../state/authStore';

export function useAdminLogin() {
  const setTokens = useAdminAuthStore(state => state.setTokens);

  return useMutation({
    mutationFn: adminLogin,
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
    },
  });
}
