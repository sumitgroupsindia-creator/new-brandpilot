import { PropsWithChildren } from 'react';

interface PagePanelProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function PagePanel({ title, subtitle, children }: PagePanelProps) {
  return (
    <section className="panel-surface">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
