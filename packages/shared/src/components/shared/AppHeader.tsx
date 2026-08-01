import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';

interface AppHeaderProps {
  appName: string;
  userName: string;
  onToggleNav: () => void;
  onLogout: () => void;
}

export function AppHeader({ appName, userName, onToggleNav, onLogout }: AppHeaderProps) {
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--color-border)] bg-white/92 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(210px,260px)_1fr_auto] items-center gap-4 px-3 py-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button className="md:hidden" variant="ghost" size="sm" onClick={onToggleNav} aria-label="Open navigation">
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
              <path d="M2.5 5.75A.75.75 0 0 1 3.25 5h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Zm0 4.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 1 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Zm.75 3.5a.75.75 0 0 0 0 1.5h8a.75.75 0 1 0 0-1.5h-8Z" />
            </svg>
          </Button>
          <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff5f2e,#ff3f8e,#7a5cff)] text-lg font-bold text-white shadow-[var(--shadow-sm)] sm:flex">
            B
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">{appName}</p>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Home</p>
          </div>
        </div>

        <div className="mx-auto hidden w-full max-w-[860px] md:block">
          <SearchInput placeholder="Search templates, festivals, products..." aria-label="Search" />
        </div>

        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <Badge variant="success">Live</Badge>
          <span className="hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-ink-muted)] lg:inline-flex">
            {userName}
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff6b3d,#b743ff)] text-sm font-bold text-white">
            {userInitial}
          </span>
          <Button variant="secondary" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
