import { PropsWithChildren } from 'react';
import { cn } from '@shared/lib/cn';

interface ShellCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ShellCard({ title, subtitle, className, children }: ShellCardProps) {
  return (
    <section
      className={cn('rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-xs)] sm:p-6', className)}
    >
      {(title || subtitle) && (
        <header className="mb-4">
          {title ? <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
