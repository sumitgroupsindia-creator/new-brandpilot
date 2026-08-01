import { PropsWithChildren } from 'react';

interface ShellCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ShellCard({ title, subtitle, className, children }: ShellCardProps) {
  return (
    <section
      className={[
        'glass-panel p-5 sm:p-6',
        className ?? '',
      ].join(' ')}
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
