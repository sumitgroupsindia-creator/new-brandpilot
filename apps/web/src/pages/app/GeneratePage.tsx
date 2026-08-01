import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { useFeedback } from '@brandpilot/shared';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { SearchInput } from '@shared/components/ui/SearchInput';
import {
  apiCreateGenerationJob,
  apiGetFramesByCategory,
  apiGetGenerationJobs,
} from '../../lib/api';

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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export function GeneratePage() {
  const queryClient = useQueryClient();
  const framesQuery = useQuery({ queryKey: ['frames', 'ai-studio'], queryFn: () => apiGetFramesByCategory() });
  const jobsQuery = useQuery({ queryKey: ['generation-jobs'], queryFn: apiGetGenerationJobs });

  const [kind, setKind] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [prompt, setPrompt] = useState('');
  const [referencePhotoPreviewUrl, setReferencePhotoPreviewUrl] = useState('');
  const [referencePhotoDataUrl, setReferencePhotoDataUrl] = useState('');
  const { showDialog, showToast } = useFeedback();

  const frames = framesQuery.data ?? [];
  const selectedFrame = useMemo(() => frames[0] ?? null, [frames]);
  const jobs = jobsQuery.data ?? [];
  const imageJobs = useMemo(() => jobs.filter(job => job.kind === 'IMAGE'), [jobs]);
  const videoJobs = useMemo(() => jobs.filter(job => job.kind === 'VIDEO'), [jobs]);
  const latestImageJob = imageJobs[0] ?? null;
  const latestVideoJob = videoJobs[0] ?? null;
  const promptIdeas = ['Diwali sale poster', 'New product launch', 'Birthday flyer', 'Wedding invite'];

  const createJobMutation = useMutation({
    mutationFn: apiCreateGenerationJob,
    onSuccess: () => {
      setPrompt('');
      queryClient.invalidateQueries({ queryKey: ['generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-ledger'] });
    },
  });

  const onGenerate = () => {
    if (!selectedFrame?.id) {
      showToast({
        title: 'Template missing',
        description: 'No template is available right now. Please add at least one frame.',
        tone: 'warning',
      });
      return;
    }

    if (!prompt.trim()) {
      showToast({
        title: 'Prompt required',
        description: 'Write a prompt before starting generation.',
        tone: 'warning',
      });
      return;
    }

    if (selectedFrame.isLocked) {
      showDialog({
        title: 'Premium template locked',
        description: 'This template requires an active subscription. Upgrade your plan or choose an unlocked template to continue.',
        tone: 'warning',
        confirmLabel: 'Okay',
      });
      return;
    }

    createJobMutation.mutate({
      frameId: selectedFrame.id,
      kind,
      prompt: prompt.trim(),
      title: prompt.trim().slice(0, 70),
      frameInputs: referencePhotoDataUrl
        ? {
          text: {},
          images: {
            user_reference_photo: {
              dataUrl: referencePhotoDataUrl,
              backgroundMode: 'with',
            },
          },
        }
        : undefined,
    });
  };

  return (
    <>
      <section className="dashboard-hero overflow-hidden rounded-[28px] border border-white/20 bg-[linear-gradient(122deg,#ff6a22_0%,#f23686_56%,#5f68ea_100%)] p-5 text-white shadow-[0_22px_58px_rgba(58,22,84,0.26)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="inline-flex rounded-full bg-white/22 px-3 py-1 text-xs font-semibold tracking-[0.06em]">AI Studio • New</span>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">Create premium visuals first, then turn them into motion.</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">Upload a reference photo if needed, write one sharp prompt, and generate image or video with the same creative direction.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => setKind('IMAGE')}
                variant="secondary"
                className="border border-white/50 bg-white text-[#1f2a44] shadow-[0_10px_30px_rgba(6,8,20,0.2)] hover:bg-[#f8fbff]"
              >
                Start with Image
              </Button>
              <Button
                type="button"
                onClick={() => setKind('VIDEO')}
                variant="outline"
                className="border border-white/60 bg-[#1f2a44]/30 text-white shadow-[0_10px_28px_rgba(6,8,20,0.16)] hover:bg-[#1f2a44]/44"
              >
                Switch to Video
              </Button>
            </div>
          </div>

          <div className="dashboard-hero-panel rounded-[26px] border border-white/20 bg-white/18 p-4 backdrop-blur-md sm:p-5">
            <p className="text-xl font-semibold text-white">Text to creative</p>
            <p className="mt-1 text-sm text-white/90">Describe your design idea and continue in the generator below.</p>
            <SearchInput
              className="mt-3"
              placeholder="e.g. Diwali sale 50% off"
              aria-label="AI Studio prompt helper"
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {promptIdeas.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setPrompt(tag)}
                  className="rounded-full bg-white/25 px-3 py-1 text-sm text-white transition hover:bg-white/32"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Assets</p>
                <p className="text-xl font-semibold">Signed</p>
              </div>
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Credits</p>
                <p className="text-xl font-semibold">70</p>
              </div>
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Image AI</p>
                <p className="text-xl font-semibold">Ready</p>
              </div>
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Video AI</p>
                <p className="text-xl font-semibold">Ready</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(360px,1.04fr)] xl:items-start">
        <Card variant="elevated" className="ai-studio-left overflow-hidden p-4 sm:p-5">
          <SectionHeader title="AI Generation" subtitle="Select output type, optional reference image, and prompt." />

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setKind('IMAGE')}
              className={`ai-mode-btn ${kind === 'IMAGE' ? 'ai-mode-btn-active-image' : ''}`}
            >
              <p>1. Image</p>
              <span>Selected for visual generation</span>
            </button>
            <button
              type="button"
              onClick={() => setKind('VIDEO')}
              className={`ai-mode-btn ${kind === 'VIDEO' ? 'ai-mode-btn-active-video' : ''}`}
            >
              <p>2. Video</p>
              <span>Selected for motion generation</span>
            </button>
          </div>

          <div className="space-y-3">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">Reference image</span>
              <div className="ai-upload-shell">
                <input
                  type="file"
                  accept="image/*"
                  className="ai-upload-input"
                  onChange={async event => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      setReferencePhotoDataUrl('');
                      setReferencePhotoPreviewUrl('');
                      return;
                    }
                    setReferencePhotoPreviewUrl(URL.createObjectURL(file));
                    const dataUrl = await fileToDataUrl(file);
                    setReferencePhotoDataUrl(dataUrl);
                  }}
                />
              </div>
              <p className="text-sm leading-6 text-[var(--color-ink-subtle)]">Optional image upload karo to AI us image ko edit या transform karega. Blank rakho to fresh image generate hogi.</p>
            </label>

            {referencePhotoPreviewUrl ? (
              <div className="ai-panel-muted">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-subtle)]">Selected Photo</p>
                <img src={referencePhotoPreviewUrl} alt="Reference" className="max-h-56 w-full rounded-lg border border-[var(--color-border)] object-contain" />
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">Image Prompt</span>
              <textarea
                className="ai-textarea"
                placeholder="A cinematic Indian festival celebration scene with lights, depth, and vibrant colors"
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={onGenerate}
                loading={createJobMutation.isPending}
                className="min-w-[250px] rounded-full border-0 bg-[linear-gradient(135deg,#ff7a18,#ff5b00)] text-white shadow-[0_18px_36px_rgba(255,107,43,0.28)] hover:opacity-95"
              >
                {kind === 'VIDEO' ? 'Generate Pro Video' : 'Generate Pro Image'}
              </Button>
              {latestImageJob ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-w-[220px] rounded-full"
                  onClick={() => {
                    if (latestImageJob.outputUrl) {
                      downloadGeneratedAsset(latestImageJob.outputUrl, `${latestImageJob.title || 'generated-image'}.png`);
                      return;
                    }
                    showToast({
                      title: 'Image not ready',
                      description: 'The latest generated image does not have a downloadable output yet.',
                      tone: 'warning',
                    });
                  }}
                >
                  Save last image
                </Button>
              ) : null}
            </div>
            <div className="ai-panel-muted text-sm text-[var(--color-ink-muted)]">
              Using template: <span className="font-semibold text-[var(--color-ink)]">{selectedFrame?.title ?? 'None'}</span>
            </div>

            <div className="ai-panel-muted">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-subtle)]">Generated Images</p>
                  <p className="text-xs text-[var(--color-ink-subtle)]">Click any image to preview or use it for video.</p>
                </div>
                <Button type="button" variant="ghost" size="sm">Refresh</Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {imageJobs.slice(0, 4).map((job, index) => (
                  <button
                    key={job.id}
                    type="button"
                    className="ai-gallery-thumb text-left"
                    onClick={() => {
                      if (!job.outputUrl) {
                        showToast({
                          title: 'Preview not ready',
                          description: 'This generation has no stored image output yet.',
                          tone: 'warning',
                        });
                        return;
                      }
                      downloadGeneratedAsset(job.outputUrl, `${job.title || 'generated-image'}-${job.id}.png`);
                    }}
                  >
                    {job.outputUrl && job.status === 'SUCCEEDED' ? (
                      <img src={job.outputUrl} alt={job.title} className="ai-gallery-thumb-image" />
                    ) : (
                      <div className="ai-gallery-thumb-art" />
                    )}
                    <div className="ai-gallery-thumb-meta">
                      <span>#{imageJobs.length - index}</span>
                      <span>{job.status}</span>
                    </div>
                  </button>
                ))}
                {!imageJobs.length ? (
                  <div className="col-span-full rounded-[12px] border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-ink-subtle)]">
                    No generated images yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card variant="elevated" className="p-4 sm:p-5">
            <SectionHeader title="Generated Image" subtitle="Preview area for latest image result." />
            <div className="ai-preview-board min-h-[360px]">
              {latestImageJob?.outputUrl && latestImageJob.status === 'SUCCEEDED' ? (
                <div className="ai-preview-media-shell">
                  <img src={latestImageJob.outputUrl} alt={latestImageJob.title} className="ai-preview-media-image" />
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      className="rounded-full border-0 bg-[linear-gradient(135deg,#ff7a18,#f23686_56%,#7a5cff)] text-white hover:opacity-95"
                      onClick={() => downloadGeneratedAsset(latestImageJob.outputUrl ?? '', `${latestImageJob.title || 'generated-image'}.png`)}
                    >
                      Save generated image
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{latestImageJob ? `Latest image job: ${latestImageJob.title}` : 'No generated image yet'}</p>
              )}
            </div>
          </Card>

          <Card variant="elevated" className="p-4 sm:p-5">
            <SectionHeader title="Generated Video" subtitle="Video result appears after completion." />
            <div className="ai-preview-board min-h-[260px]">
              <p>{latestVideoJob ? `Latest video job: ${latestVideoJob.title}` : 'Video result will appear here after completion'}</p>
            </div>
          </Card>

          <Card variant="elevated" className="p-4 sm:p-5">
            <SectionHeader title="Recent AI Jobs" subtitle="Operational status for image and video generation." />
            {jobsQuery.isLoading ? <p className="text-sm text-[var(--color-ink-subtle)]">Loading jobs...</p> : null}
            <div className="space-y-2">
              {jobs.slice(0, 6).map(job => (
                <div key={job.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-ink)] line-clamp-1">{job.title}</p>
                    <Badge variant={job.status === 'FAILED' ? 'error' : job.status === 'SUCCEEDED' ? 'success' : 'warning'}>{job.status}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-ink-subtle)]">{job.kind} • {job.frameName}</p>
                </div>
              ))}
              {!jobsQuery.isLoading && !jobs.length ? <p className="text-sm text-[var(--color-ink-subtle)]">No jobs yet.</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
