import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetFailedJobs } from '../lib/api';

export function JobsPage() {
  const jobsQuery = useQuery({ queryKey: ['admin-failed-jobs'], queryFn: adminGetFailedJobs });
  const failedJobs = jobsQuery.data ?? [];

  return (
    <PagePanel title="Jobs & Queues" subtitle="Queue depth, failed jobs, and retries.">
      {jobsQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading jobs...</p> : null}
      {jobsQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load jobs.</p> : null}
      <div className="space-y-2">
        {failedJobs.map(job => (
          <article key={job.id} className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-semibold">{job.id} • {job.queue}</h3>
            <p className="text-sm text-slate-600">{job.reason}</p>
            <button className="btn-soft mt-2" type="button">Retry job</button>
          </article>
        ))}
      </div>
    </PagePanel>
  );
}
