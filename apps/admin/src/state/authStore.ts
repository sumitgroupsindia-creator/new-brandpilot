import { create } from 'zustand';

interface AdminAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  bootstrap: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('bp_admin_access_token', accessToken);
    localStorage.setItem('bp_admin_refresh_token', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },
  clear: () => {
    localStorage.removeItem('bp_admin_access_token');
    localStorage.removeItem('bp_admin_refresh_token');
    set({ accessToken: null, refreshToken: null, isAuthenticated: false });
  },
  bootstrap: () => {
    const accessToken = localStorage.getItem('bp_admin_access_token');
    const refreshToken = localStorage.getItem('bp_admin_refresh_token');
    set({
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken && refreshToken),
    });
  },
}));
