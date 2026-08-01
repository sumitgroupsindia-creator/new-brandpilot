import { create } from 'zustand';
import { adminRefresh } from '../lib/api';

interface AdminAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  bootstrap: () => Promise<void>;
}

export const useAdminAuthStore = create<AdminAuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isBootstrapping: true,
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('bp_admin_access_token', accessToken);
    localStorage.setItem('bp_admin_refresh_token', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true, isBootstrapping: false });
  },
  clear: () => {
    localStorage.removeItem('bp_admin_access_token');
    localStorage.removeItem('bp_admin_refresh_token');
    set({ accessToken: null, refreshToken: null, isAuthenticated: false, isBootstrapping: false });
  },
  bootstrap: async () => {
    const accessToken = localStorage.getItem('bp_admin_access_token');
    const refreshToken = localStorage.getItem('bp_admin_refresh_token');

    if (!refreshToken) {
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isBootstrapping: false,
      });
      return;
    }

    set({
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken),
      isBootstrapping: true,
    });

    try {
      const data = await adminRefresh(refreshToken);
      localStorage.setItem('bp_admin_access_token', data.accessToken);
      localStorage.setItem('bp_admin_refresh_token', data.refreshToken);
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isBootstrapping: false,
      });
    } catch {
      localStorage.removeItem('bp_admin_access_token');
      localStorage.removeItem('bp_admin_refresh_token');
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isBootstrapping: false,
      });
    }
  },
}));
