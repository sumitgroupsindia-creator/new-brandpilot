import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
import { apiGetGenerationJobs } from '../../lib/api';

export function AiGenerationHistoryPage() {
  const jobsQuery = useQuery({ queryKey: ['generation-jobs'], queryFn: apiGetGenerationJobs });
  const jobs = jobsQuery.data ?? [];

  const imageJobs = useMemo(() => jobs.filter(job => job.kind === 'IMAGE'), [jobs]);
  const videoJobs = useMemo(() => jobs.filter(job => job.kind === 'VIDEO'), [jobs]);

  return (
    <>
      <PageHeader
        eyebrow="AI Output Timeline"
        title="AI Generation History"
        description="Track image and video generation jobs separately with status and credit usage."
      />

      {jobsQuery.isLoading ? <LoadingState lines={5} /> : null}
      {jobsQuery.isError ? <ErrorState description="Failed to load generation history." /> : null}

      {!jobsQuery.isLoading && !jobsQuery.isError ? (
        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <SectionHeader title="Image Generation" subtitle="Jobs produced via image-generation models." />
            {imageJobs.length ? (
              <div className="space-y-2">
                {imageJobs.map(job => (
                  <article key={job.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--color-ink)]">{job.title}</h3>
                        <p className="text-sm text-[var(--color-ink-muted)]">{job.frameName} • IMAGE</p>
                      </div>
                      <Badge variant={job.status === 'FAILED' ? 'error' : job.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                        {job.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-ink-subtle)]">{new Date(job.createdAt).toLocaleString()} • {job.creditsUsed} credits</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No image generations yet" description="Image jobs from AI Studio will appear here." />
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader title="Video Generation" subtitle="Jobs produced via video-generation models." />
            {videoJobs.length ? (
              <div className="space-y-2">
                {videoJobs.map(job => (
                  <article key={job.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--color-ink)]">{job.title}</h3>
                        <p className="text-sm text-[var(--color-ink-muted)]">{job.frameName} • VIDEO</p>
                      </div>
                      <Badge variant={job.status === 'FAILED' ? 'error' : job.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                        {job.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-ink-subtle)]">{new Date(job.createdAt).toLocaleString()} • {job.creditsUsed} credits</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No video generations yet" description="Video jobs from AI Studio will appear here." />
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
