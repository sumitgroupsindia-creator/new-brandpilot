import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '@shared/components/shared/AppHeader';
import { AppSidebar } from '@shared/components/shared/AppSidebar';
import { apiGetPublicConfig } from '../lib/api';
import { useMe } from '../hooks/useAuth';
import { useAuthStore } from '../state/authStore';

const links = [
  { to: '/app/home', label: 'Home' },
  { to: '/app/frames', label: 'Frames' },
  { to: '/app/categories', label: 'Categories' },
  { to: '/app/ai-studio', label: 'AI Studio' },
  { to: '/app/ai-generation-history', label: 'AI Gen History' },
  { to: '/app/projects', label: 'Projects' },
  { to: '/app/wallet', label: 'Wallet' },
  { to: '/app/settings', label: 'Settings' },
];

type ThemeMode = 'light' | 'dark' | 'system';
const THEME_STORAGE_KEY = 'brandpilot-theme-mode';

export function WebLayout() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const me = useMe();
  const clearAuth = useAuthStore(state => state.clear);
  const config = useQuery({ queryKey: ['public-config'], queryFn: apiGetPublicConfig });
  const appName = (config.data?.branding?.appName as string) ?? 'BrandPilot';

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      setThemeMode(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolvedTheme = themeMode === 'system'
        ? (media.matches ? 'dark' : 'light')
        : themeMode;
      root.setAttribute('data-theme', resolvedTheme);
      root.setAttribute('data-theme-mode', themeMode);
    };

    applyTheme();

    if (themeMode !== 'system') {
      return;
    }

    const onSystemThemeChange = () => applyTheme();
    media.addEventListener('change', onSystemThemeChange);
    return () => media.removeEventListener('change', onSystemThemeChange);
  }, [themeMode]);

  return (
    <div className="relative h-screen overflow-hidden bg-brand-surface text-[var(--color-ink)]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.14),_transparent_70%)]" />

      <AppHeader
        appName={appName}
        userName={me.data?.name ?? me.data?.email ?? 'User'}
        onToggleNav={() => setIsNavOpen(true)}
        onLogout={clearAuth}
      />

      <div className="mx-auto grid h-[calc(100vh-73px)] w-full max-w-[1480px] grid-cols-1 gap-3 overflow-hidden px-3 py-4 sm:px-4 lg:px-5 md:grid-cols-[248px_minmax(0,1fr)] md:items-start md:py-5 xl:gap-4">
        <AppSidebar
          links={links}
          open={isNavOpen}
          onNavigate={() => setIsNavOpen(false)}
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
        />

        <main className="min-w-0 space-y-5 overflow-y-auto pr-1 pb-4 md:h-full md:pr-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
