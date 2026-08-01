import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetTenants } from '../lib/api';

export function TenantsPage() {
  const tenantsQuery = useQuery({ queryKey: ['admin-tenants'], queryFn: adminGetTenants });
  const tenants = tenantsQuery.data ?? [];

  return (
    <PagePanel title="Tenant Management" subtitle="Create, suspend, and configure tenant accounts.">
      {tenantsQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading tenants...</p> : null}
      {tenantsQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load tenants.</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <input className="field" placeholder="Tenant name" />
        <input className="field" placeholder="Slug" />
        <button className="btn-dark" type="button">Create tenant</button>
      </div>
      <div className="mt-4 space-y-2">
        {tenants.map(tenant => (
          <div key={tenant.id} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            {tenant.slug} • {tenant.status} • {tenant.userCap.toLocaleString()} user cap
          </div>
        ))}
      </div>
    </PagePanel>
  );
}
