import { create } from 'zustand';
import { apiRefresh } from '../lib/api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  bootstrapFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isBootstrapping: true,
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('bp_access_token', accessToken);
    localStorage.setItem('bp_refresh_token', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true, isBootstrapping: false });
  },
  clear: () => {
    localStorage.removeItem('bp_access_token');
    localStorage.removeItem('bp_refresh_token');
    set({ accessToken: null, refreshToken: null, isAuthenticated: false, isBootstrapping: false });
  },
  bootstrapFromStorage: async () => {
    const accessToken = localStorage.getItem('bp_access_token');
    const refreshToken = localStorage.getItem('bp_refresh_token');

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
      const data = await apiRefresh(refreshToken);
      localStorage.setItem('bp_access_token', data.accessToken);
      localStorage.setItem('bp_refresh_token', data.refreshToken);
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isBootstrapping: false,
      });
    } catch {
      localStorage.removeItem('bp_access_token');
      localStorage.removeItem('bp_refresh_token');
      set({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isBootstrapping: false,
      });
    }
  },
}));
