import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetBranding } from '../lib/api';

export function BrandingPage() {
  const brandingQuery = useQuery({ queryKey: ['admin-branding'], queryFn: adminGetBranding });
  const branding = brandingQuery.data;

  return (
    <PagePanel title="Branding" subtitle="Tenant-level app name, logo, and theme tokens.">
      {brandingQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading branding...</p> : null}
      {brandingQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load branding.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <input className="field" defaultValue={branding?.appName ?? ''} />
        <input className="field" defaultValue={branding?.primaryColor ?? ''} />
        <input className="field md:col-span-2" defaultValue={branding?.logoUrl ?? ''} placeholder="Logo URL" />
        <button className="btn-dark md:col-span-2" type="button">Update branding</button>
      </div>
    </PagePanel>
  );
}
