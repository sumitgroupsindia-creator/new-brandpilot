import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

interface SidebarLink {
  to: string;
  label: string;
}

type ThemeMode = 'light' | 'dark' | 'system';

interface AppSidebarProps {
  links: SidebarLink[];
  open?: boolean;
  onNavigate?: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export function AppSidebar({ links, open = false, onNavigate, themeMode, onThemeModeChange }: AppSidebarProps) {
  return (
    <>
      <aside className="hidden h-[calc(100vh-92px)] rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 shadow-[var(--shadow-xs)] md:sticky md:top-[78px] md:block">
        <SidebarContent links={links} onNavigate={onNavigate} themeMode={themeMode} onThemeModeChange={onThemeModeChange} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-[rgba(9,12,18,0.45)] p-4 md:hidden" onClick={onNavigate}>
          <aside className="h-full w-[84%] max-w-[320px] rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 shadow-[var(--shadow-lg)]" onClick={event => event.stopPropagation()}>
            <SidebarContent links={links} onNavigate={onNavigate} themeMode={themeMode} onThemeModeChange={onThemeModeChange} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function SidebarContent({
  links,
  onNavigate,
  themeMode,
  onThemeModeChange,
}: {
  links: SidebarLink[];
  onNavigate?: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const workspaceLinks = links.slice(0, 6);
  const accountLinks = links.slice(6);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff5f2e,#ff3f8e,#7a5cff)] text-lg font-bold text-white shadow-[var(--shadow-sm)]">
            B
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-[var(--color-ink)]">BrandPilot</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-subtle)]">Design Studio</p>
          </div>
        </div>

        <Button className="mt-4 w-full border-0 bg-[linear-gradient(135deg,#ff5f2e,#ff3f8e,#7a5cff)] text-white shadow-[var(--shadow-sm)] hover:opacity-95" onClick={onNavigate}>
          + Create design
        </Button>
      </div>

      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-subtle)]">Workspace</p>
      <nav className="mt-2 space-y-1">
        {workspaceLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[linear-gradient(120deg,#ffefe9,#ffe4f7)] text-[#c2410c]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
              )
            }
          >
            <span className="nav-flag inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/80 text-[10px] font-semibold uppercase shadow-[var(--shadow-xs)]">
              {link.label.charAt(0)}
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <p className="mt-5 px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-subtle)]">Account</p>
      <nav className="mt-2 space-y-1">
        {accountLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[linear-gradient(120deg,#ffefe9,#ffe4f7)] text-[#c2410c]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
              )
            }
          >
            <span className="nav-flag inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/80 text-[10px] font-semibold uppercase shadow-[var(--shadow-xs)]">
              {link.label.charAt(0)}
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-2">
        <div className="grid grid-cols-3 gap-1 text-xs">
          {(['light', 'dark', 'system'] as ThemeMode[]).map(mode => {
            const isActive = themeMode === mode;
            return (
              <button
                key={mode}
                className={cn(
                  'rounded-[10px] border px-2 py-1.5 capitalize transition',
                  isActive
                    ? 'border-transparent bg-[#ff6b2f] text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-3)]',
                )}
                type="button"
                onClick={() => onThemeModeChange(mode)}
                aria-pressed={isActive}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
