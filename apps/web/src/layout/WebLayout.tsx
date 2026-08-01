import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGetPublicConfig } from '../lib/api';
import { useMe } from '../hooks/useAuth';
import { useAuthStore } from '../state/authStore';

const links = [
  { to: '/app/home', label: 'Home' },
  { to: '/app/frames', label: 'Frames' },
  { to: '/app/categories', label: 'Categories' },
  { to: '/app/generate', label: 'Generate' },
  { to: '/app/history', label: 'History' },
  { to: '/app/projects', label: 'Projects' },
  { to: '/app/wallet', label: 'Wallet' },
  { to: '/app/settings', label: 'Settings' },
];

export function WebLayout() {
  const me = useMe();
  const clearAuth = useAuthStore(state => state.clear);
  const config = useQuery({ queryKey: ['public-config'], queryFn: apiGetPublicConfig });
  const appName = (config.data?.branding?.appName as string) ?? 'BrandPilot';

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-surface text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.14),_transparent_70%)]" />

      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-teal-700">{appName}</p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Creative control center</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="pill">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Studio online
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
              64 credits
            </div>
            <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700">
              {me.data?.name ?? me.data?.email ?? 'User'}
            </div>
            <button className="btn-secondary" type="button" onClick={clearAuth}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="glass-panel h-fit p-3 lg:sticky lg:top-24">
          <div className="mb-3 rounded-2xl bg-slate-950 p-3 text-white shadow-inner">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Workspace</p>
            <p className="mt-1 text-sm font-semibold">A premium launchpad for every asset</p>
          </div>
          <nav className="space-y-1">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    'block rounded-2xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive ? 'bg-teal-700 text-white shadow-lg shadow-teal-700/20' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
