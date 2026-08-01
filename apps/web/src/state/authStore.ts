import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
  bootstrapFromStorage: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('bp_access_token', accessToken);
    localStorage.setItem('bp_refresh_token', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },
  clear: () => {
    localStorage.removeItem('bp_access_token');
    localStorage.removeItem('bp_refresh_token');
    set({ accessToken: null, refreshToken: null, isAuthenticated: false });
  },
  bootstrapFromStorage: () => {
    const accessToken = localStorage.getItem('bp_access_token');
    const refreshToken = localStorage.getItem('bp_refresh_token');
    set({
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(accessToken && refreshToken),
    });
  },
}));
