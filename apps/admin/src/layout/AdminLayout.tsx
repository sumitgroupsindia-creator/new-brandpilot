import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuthStore } from '../state/authStore';

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/frames', label: 'Frames' },
  { to: '/categories', label: 'Categories' },
  { to: '/wallet-ops', label: 'Wallet Ops' },
  { to: '/plans', label: 'Recharge Plans' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/ai-config', label: 'AI Config' },
  { to: '/config', label: 'System Config' },
  { to: '/branding', label: 'Branding' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/audit', label: 'Audit' },
  { to: '/tenants', label: 'Tenants' },
];

export function AdminLayout() {
  const clearAuth = useAdminAuthStore(state => state.clear);

  return (
    <div className="relative min-h-screen bg-admin-surface text-slate-900 transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0 bg-admin-grid opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_70%)]" />

      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="admin-eyebrow">BrandPilot</p>
            <h1 className="text-base font-semibold tracking-tight">Platform Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-800">
              SUPER_ADMIN
            </div>
            <button className="btn-soft" type="button" onClick={clearAuth}>Logout</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="panel-surface h-fit p-3 lg:sticky lg:top-24">
          <div className="mb-3 rounded-2xl bg-slate-950 p-3 text-white shadow-inner">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Operations</p>
            <p className="mt-1 text-sm font-semibold">Control the platform with precision.</p>
          </div>
          <nav className="space-y-1">
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'block rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                    isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')
                }
              >
                {item.label}
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
