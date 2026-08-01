import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { DownloadButton } from '@shared/components/shared/DownloadButton';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
import { apiGetGenerationJobs } from '../../lib/api';

function downloadGeneratedAsset(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function AiGenerationHistoryPage() {
  const jobsQuery = useQuery({ queryKey: ['generation-jobs'], queryFn: apiGetGenerationJobs });
  const jobs = jobsQuery.data ?? [];
  const [imagePage, setImagePage] = useState(1);
  const [videoPage, setVideoPage] = useState(1);
  const pageSize = 4;

  const imageJobs = useMemo(() => jobs.filter(job => job.kind === 'IMAGE'), [jobs]);
  const videoJobs = useMemo(() => jobs.filter(job => job.kind === 'VIDEO'), [jobs]);
  const successfulJobs = useMemo(() => jobs.filter(job => job.status === 'SUCCEEDED'), [jobs]);
  const latestSuccess = successfulJobs[0] ?? null;
  const activeJobs = useMemo(() => jobs.filter(job => job.status === 'QUEUED' || job.status === 'RUNNING'), [jobs]);
  const failedJobs = useMemo(() => jobs.filter(job => job.status === 'FAILED'), [jobs]);

  const imagePageCount = Math.max(1, Math.ceil(imageJobs.length / pageSize));
  const videoPageCount = Math.max(1, Math.ceil(videoJobs.length / pageSize));

  useEffect(() => {
    setImagePage(current => Math.min(current, imagePageCount));
  }, [imagePageCount]);

  useEffect(() => {
    setVideoPage(current => Math.min(current, videoPageCount));
  }, [videoPageCount]);

  const imageJobsPage = imageJobs.slice((imagePage - 1) * pageSize, imagePage * pageSize);
  const videoJobsPage = videoJobs.slice((videoPage - 1) * pageSize, videoPage * pageSize);

  return (
    <>
      <PageHeader
        eyebrow="AI Output Timeline"
        title="AI Generation History"
        description="Track image and video generation jobs separately with status and credit usage."
        actions={<Button variant="outline" onClick={() => window.location.assign('/app/ai-studio')}>Open AI Studio</Button>}
        className="ai-history-shell overflow-hidden shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
      />

      {jobsQuery.isLoading ? <LoadingState lines={5} /> : null}
      {jobsQuery.isError ? <ErrorState description="Failed to load generation history." /> : null}

      {!jobsQuery.isLoading && !jobsQuery.isError ? (
        <div className="ai-history-page space-y-6">
          <Card className="ai-history-hero overflow-hidden p-5 shadow-[0_22px_64px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-ink-subtle)]">Premium output vault</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">Your best AI renders, ready to review and download.</h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--color-ink-muted)]">See completed work, monitor jobs in progress, and export any successful generation straight from this page.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Badge variant="ai">{jobs.length} total jobs</Badge>
                  <Badge variant="success">{successfulJobs.length} succeeded</Badge>
                  <Badge variant="warning">{activeJobs.length} running</Badge>
                  <Badge variant="error">{failedJobs.length} failed</Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatTile label="Image jobs" value={imageJobs.length.toString()} accent="from-[#ff7a18] to-[#ff3d77]" />
                <StatTile label="Video jobs" value={videoJobs.length.toString()} accent="from-[#6366f1] to-[#8b5cf6]" />
                <StatTile label="Downloads" value={successfulJobs.length.toString()} accent="from-[#0ea5e9] to-[#14b8a6]" />
                <StatTile label="Credits used" value={jobs.reduce((sum, job) => sum + job.creditsUsed, 0).toString()} accent="from-[#f59e0b] to-[#ef4444]" />
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
            <div className="space-y-6">
              <Card className="ai-history-featured overflow-hidden p-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:p-5">
                <SectionHeader title="Featured Output" subtitle="Latest successful render with download shortcut." />
                {latestSuccess ? (
                  <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr] lg:items-stretch">
                    <div className="ai-history-preview-shell overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                      {latestSuccess.outputUrl ? (
                        <img src={latestSuccess.outputUrl} alt={latestSuccess.title} className="h-full min-h-[300px] w-full object-cover" />
                      ) : (
                        <div className="ai-history-empty-preview flex min-h-[300px] items-center justify-center text-white">
                          <div className="text-center">
                            <p className="text-sm uppercase tracking-[0.24em] text-white/70">Output ready</p>
                            <p className="mt-2 text-2xl font-semibold">{latestSuccess.title}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="ai-history-featured-panel flex h-full flex-col justify-between rounded-[26px] border border-[var(--color-border)] p-4">
                      <div>
                        <Badge variant={latestSuccess.kind === 'VIDEO' ? 'ai' : 'success'}>{latestSuccess.kind}</Badge>
                        <h3 className="mt-3 text-2xl font-semibold text-[var(--color-ink)]">{latestSuccess.title}</h3>
                        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{latestSuccess.frameName}</p>
                        <p className="mt-4 text-sm leading-7 text-[var(--color-ink-subtle)]">{new Date(latestSuccess.createdAt).toLocaleString()} • {latestSuccess.creditsUsed} credits used</p>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {latestSuccess.outputUrl ? (
                          <DownloadButton
                            isDownloading={false}
                            onClick={() => downloadGeneratedAsset(latestSuccess.outputUrl ?? '', `${latestSuccess.title || 'generated-asset'}.${latestSuccess.kind === 'VIDEO' ? 'mp4' : 'png'}`)}
                            className="bg-[linear-gradient(135deg,#ff7a18,#ff4f74)] text-white shadow-[0_18px_34px_rgba(255,94,78,0.18)] hover:opacity-95"
                          >
                            Download asset
                          </DownloadButton>
                        ) : null}
                        <Button variant="secondary" onClick={() => window.location.assign('/app/ai-studio')}>Create new</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No completed output yet" description="Once a generation succeeds, the latest result will appear here with a download button." />
                )}
              </Card>

              <Card className="ai-history-list-card overflow-hidden p-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:p-5">
                <SectionHeader title="Image Generation" subtitle="Jobs produced via image-generation models." />
                {imageJobs.length ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      {imageJobsPage.map(job => (
                        <article key={job.id} className="ai-history-job-card group overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[0_12px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(15,23,42,0.1)]">
                          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4">
                            <div>
                              <h3 className="text-[1.02rem] font-semibold text-[var(--color-ink)]">{job.title}</h3>
                              <p className="text-sm text-[var(--color-ink-muted)]">{job.frameName} • IMAGE</p>
                            </div>
                            <Badge variant={job.status === 'FAILED' ? 'error' : job.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                              {job.status}
                            </Badge>
                          </div>

                          <div className="p-4">
                            {job.outputUrl && job.status === 'SUCCEEDED' ? (
                              <img src={job.outputUrl} alt={job.title} className="h-56 w-full rounded-[24px] border border-[var(--color-border)] object-cover shadow-[0_14px_34px_rgba(15,23,42,0.08)]" />
                            ) : (
                              <div className="flex h-56 items-center justify-center rounded-[24px] border border-dashed border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(15,23,42,0.02),rgba(255,122,24,0.04))] text-center">
                                <div>
                                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">Preview unavailable</p>
                                  <p className="mt-2 text-sm text-[var(--color-ink-muted)]">This job is still processing or failed before a downloadable output was produced.</p>
                                </div>
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm text-[var(--color-ink-subtle)]">{new Date(job.createdAt).toLocaleString()} • {job.creditsUsed} credits</p>
                              {job.outputUrl && job.status === 'SUCCEEDED' ? (
                                <DownloadButton
                                  type="button"
                                  variant="secondary"
                                  isDownloading={false}
                                  onClick={() => downloadGeneratedAsset(job.outputUrl ?? '', `${job.title || 'generated-image'}-${job.id}.png`)}
                                >
                                  Download image
                                </DownloadButton>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <Pager
                      page={imagePage}
                      totalPages={imagePageCount}
                      totalItems={imageJobs.length}
                      startIndex={(imagePage - 1) * pageSize + 1}
                      endIndex={Math.min(imagePage * pageSize, imageJobs.length)}
                      onPrev={() => setImagePage(page => Math.max(1, page - 1))}
                      onNext={() => setImagePage(page => Math.min(imagePageCount, page + 1))}
                    />
                  </>
                ) : (
                  <EmptyState title="No image generations yet" description="Image jobs from AI Studio will appear here." />
                )}
              </Card>

              <Card className="ai-history-list-card overflow-hidden p-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:p-5">
                <SectionHeader title="Video Generation" subtitle="Jobs produced via video-generation models." />
                {videoJobs.length ? (
                  <>
                    <div className="space-y-3">
                      {videoJobsPage.map(job => (
                        <article key={job.id} className="ai-history-job-card rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-[1.02rem] font-semibold text-[var(--color-ink)]">{job.title}</h3>
                              <p className="text-sm text-[var(--color-ink-muted)]">{job.frameName} • VIDEO</p>
                            </div>
                            <Badge variant={job.status === 'FAILED' ? 'error' : job.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                              {job.status}
                            </Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-[var(--color-ink-subtle)]">{new Date(job.createdAt).toLocaleString()} • {job.creditsUsed} credits</p>
                            {job.outputUrl && job.status === 'SUCCEEDED' ? (
                              <DownloadButton
                                type="button"
                                variant="secondary"
                                isDownloading={false}
                                onClick={() => downloadGeneratedAsset(job.outputUrl ?? '', `${job.title || 'generated-video'}-${job.id}.mp4`)}
                              >
                                Download video
                              </DownloadButton>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>

                    <Pager
                      page={videoPage}
                      totalPages={videoPageCount}
                      totalItems={videoJobs.length}
                      startIndex={(videoPage - 1) * pageSize + 1}
                      endIndex={Math.min(videoPage * pageSize, videoJobs.length)}
                      onPrev={() => setVideoPage(page => Math.max(1, page - 1))}
                      onNext={() => setVideoPage(page => Math.min(videoPageCount, page + 1))}
                    />
                  </>
                ) : (
                  <EmptyState title="No video generations yet" description="Video jobs from AI Studio will appear here." />
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="ai-history-side-card overflow-hidden p-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:p-5">
                <SectionHeader title="Workflow Notes" subtitle="Quick view of your generation status." />
                <div className="space-y-3">
                  <SummaryRow label="Queued or running" value={activeJobs.length.toString()} />
                  <SummaryRow label="Succeeded" value={successfulJobs.length.toString()} />
                  <SummaryRow label="Failed" value={failedJobs.length.toString()} />
                  <SummaryRow label="Images" value={imageJobs.length.toString()} />
                  <SummaryRow label="Videos" value={videoJobs.length.toString()} />
                </div>
              </Card>

              <Card className="ai-history-cta overflow-hidden p-5 text-white shadow-[0_24px_64px_rgba(15,23,42,0.18)] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Premium action</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Create the next asset from a fresh prompt.</h3>
                <p className="mt-2 text-sm leading-6 text-white/82">Jump back into AI Studio and continue from your latest creative idea.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => window.location.assign('/app/ai-studio')}>
                    Open AI Studio
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-subtle)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ai-history-summary-row flex items-center justify-between rounded-[20px] border border-[var(--color-border)] px-4 py-3">
      <span className="text-sm text-[var(--color-ink-muted)]">{label}</span>
      <strong className="text-base font-semibold text-[var(--color-ink)]">{value}</strong>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="ai-history-pager mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--color-border)] px-4 py-3">
      <p className="text-sm text-[var(--color-ink-muted)]">
        Showing {totalItems === 0 ? 0 : startIndex}-{endIndex} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onPrev} disabled={page <= 1}>
          Prev
        </Button>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-1 text-sm font-semibold text-[var(--color-ink)]">
          Page {page} / {totalPages}
        </span>
        <Button type="button" variant="secondary" size="sm" onClick={onNext} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}