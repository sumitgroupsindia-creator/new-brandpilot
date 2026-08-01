import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetDashboard } from '../lib/api';

export function DashboardPage() {
  const dashboardQuery = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminGetDashboard });
  const kpis = dashboardQuery.data?.kpis ?? [];
  const failedJobs = dashboardQuery.data?.failedJobs ?? [];

  return (
    <>
      <PagePanel title="Platform Pulse" subtitle="Live usage and health overview.">
        {dashboardQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading dashboard...</p> : null}
        {dashboardQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load dashboard.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(kpi => (
            <div key={kpi.key} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{kpi.key}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{kpi.value}</p>
            </div>
          ))}
        </div>
      </PagePanel>

      <PagePanel title="Queue Alerts" subtitle="Recent failures across workers.">
        <div className="space-y-2">
          {failedJobs.map(job => (
            <div key={job.id} className="rounded-[20px] border border-rose-100 bg-rose-50/80 p-3 transition-all duration-300 hover:-translate-y-0.5">
              <p className="text-sm font-semibold text-rose-900">{job.id} • {job.queue}</p>
              <p className="text-xs text-rose-800">{job.reason} • {job.when}</p>
            </div>
          ))}
        </div>
      </PagePanel>
    </>
  );
}
