import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DynamicFrameFields } from '../../components/frame/DynamicFrameFields';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { useDynamicFrameFields } from '../../hooks/useDynamicFrameFields';
import {
  apiCreateGenerationJob,
  apiGetFrame,
  apiGetFrameCategories,
  apiGetFramesByCategory,
  apiGetGenerationJobs,
  apiGetImageCategories,
} from '../../lib/api';
import { readFrameInputDraft } from '../../lib/frameInputDrafts';
import { renderFrameInputsAsDataUrl } from '../../lib/frameInputImageExport';

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

  function toRenderableImageUrl(url?: string | null) {
    const value = (url ?? '').trim();
    if (!value) {
      return undefined;
    }

    if (/^https?:\/\//i.test(value)) {
      return `/api/image-proxy?url=${encodeURIComponent(value)}`;
    }

    return value;
  }

export function GeneratePage() {
  const queryClient = useQueryClient();
  const frameCategoriesQuery = useQuery({ queryKey: ['frame-categories'], queryFn: apiGetFrameCategories });
  const imageCategoriesQuery = useQuery({ queryKey: ['image-categories'], queryFn: apiGetImageCategories });

  const [frameCategoryId, setFrameCategoryId] = useState('');
  const [imageCategoryId, setImageCategoryId] = useState('');
  const [imageSubcategoryId, setImageSubcategoryId] = useState('');
  const [imageId, setImageId] = useState('');
  const [frameFilter, setFrameFilter] = useState<'all' | 'featured' | 'trending'>('all');
  const [kind, setKind] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [frameId, setFrameId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('gpt-image-1');
  const [title, setTitle] = useState('');
  const [composeMode, setComposeMode] = useState<'manual' | 'preview'>('manual');

  const framesQuery = useQuery({
    queryKey: ['frames', frameCategoryId, frameFilter],
    queryFn: () =>
      apiGetFramesByCategory({
        categoryId: frameCategoryId || undefined,
        filter: frameFilter,
      }),
  });

  const frames = framesQuery.data ?? [];
  const selectedFrameId = useMemo(() => frameId || frames[0]?.id || '', [frameId, frames]);

  const frameDetailQuery = useQuery({
    queryKey: ['frame', selectedFrameId],
    queryFn: () => apiGetFrame(selectedFrameId),
    enabled: Boolean(selectedFrameId),
  });

  const jobsQuery = useQuery({ queryKey: ['generation-jobs'], queryFn: apiGetGenerationJobs });

  const frameCategoriesRaw = frameCategoriesQuery.data ?? [];
  const imageCategoriesRaw = imageCategoriesQuery.data ?? [];
  const jobs = jobsQuery.data ?? [];
  const frameCategories = useMemo(
    () => [...frameCategoriesRaw].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [frameCategoriesRaw],
  );

  const imageCategories = useMemo(
    () =>
      [...imageCategoriesRaw]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(category => ({
          ...category,
          images: [...category.images].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        })),
    [imageCategoriesRaw],
  );

  const rootImageCategories = useMemo(() => imageCategories.filter(category => !category.parentId), [imageCategories]);
  const childImageCategories = useMemo(
    () => imageCategories.filter(category => category.parentId === imageCategoryId),
    [imageCategories, imageCategoryId],
  );

  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedImageCategory = useMemo(() => {
    if (imageSubcategoryId) {
      return imageCategories.find(category => category.id === imageSubcategoryId) ?? null;
    }
    return imageCategories.find(category => category.id === imageCategoryId) ?? rootImageCategories[0] ?? null;
  }, [imageCategories, imageCategoryId, imageSubcategoryId, rootImageCategories]);

  const selectedImages = useMemo(() => selectedImageCategory?.images ?? [], [selectedImageCategory]);

  const selectedImage = useMemo(
    () => selectedImages.find(image => image.id === imageId) ?? selectedImages[0] ?? null,
    [selectedImages, imageId],
  );

  const frame = frameDetailQuery.data;
  const dynamicFieldState = useDynamicFrameFields(frame?.dynamicFields ?? []);

  useEffect(() => {
    if (!imageCategories.length) {
      setImageCategoryId('');
      setImageSubcategoryId('');
      return;
    }

    if (!imageCategoryId && rootImageCategories.length) {
      setImageCategoryId(rootImageCategories[0]?.id ?? '');
      return;
    }

    if (imageCategoryId && !rootImageCategories.some(category => category.id === imageCategoryId)) {
      setImageCategoryId(rootImageCategories[0]?.id ?? '');
    }
  }, [imageCategories, imageCategoryId, rootImageCategories]);

  useEffect(() => {
    if (!imageCategoryId) {
      setImageSubcategoryId('');
      return;
    }

    if (!childImageCategories.length) {
      setImageSubcategoryId('');
      return;
    }

    if (!childImageCategories.some(category => category.id === imageSubcategoryId)) {
      setImageSubcategoryId(childImageCategories[0]?.id ?? '');
    }
  }, [childImageCategories, imageCategoryId, imageSubcategoryId]);

  useEffect(() => {
    if (!selectedImageCategory) {
      setImageId('');
      return;
    }
    if (!selectedImages.some(image => image.id === imageId)) {
      setImageId(selectedImages[0]?.id ?? '');
    }
  }, [selectedImageCategory, selectedImages, imageId]);

  useEffect(() => {
    if (!selectedFrameId) {
      setPreviewUrl('');
      return;
    }

    const timer = window.setTimeout(async () => {
      if (!frame) {
        return;
      }

      setIsPreviewRendering(true);
      setPreviewError(null);
      try {
        const nextUrl = await renderFrameInputsAsDataUrl({
          filename: 'preview.png',
          frameTitle: frame.title,
            backgroundUrl: toRenderableImageUrl(selectedImage?.url) ?? frame.thumbnailUrl,
          thumbnailUrl: frame.thumbnailUrl,
          templateLayers: frame.templateLayers,
          renderSize: frame.renderSize,
          fields: frame.dynamicFields ?? [],
          values: dynamicFieldState.values,
        });
        setPreviewUrl(nextUrl);
      } catch {
        setPreviewError('Preview failed to render.');
      } finally {
        setIsPreviewRendering(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    selectedFrameId,
    frame,
    selectedImage,
    dynamicFieldState.values.text,
    dynamicFieldState.values.imageDataUrl,
    dynamicFieldState.values.imagePreviewUrl,
  ]);

  const createJobMutation = useMutation({
    mutationFn: apiCreateGenerationJob,
    onSuccess: () => {
      setPrompt('');
      setNegativePrompt('');
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['generation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-ledger'] });
    },
  });

  const onQueueGeneration = () => {
    if (!selectedFrameId || !prompt.trim()) return;
    const selectedFrame = frames.find(frame => frame.id === selectedFrameId);
    if (selectedFrame?.isLocked) {
      setSubmissionError('This frame requires an active subscription.');
      return;
    }
    if (selectedImage?.isLocked) {
      setSubmissionError('This image requires an active subscription.');
      return;
    }

    const draftFromFrameDetail = readFrameInputDraft(selectedFrameId);
    const frameInputs = {
      text: {
        ...(draftFromFrameDetail?.text ?? {}),
        ...dynamicFieldState.values.text,
      },
      images: {
        ...(draftFromFrameDetail?.images ?? {}),
        ...Object.fromEntries(
          Object.entries(dynamicFieldState.values.imageDataUrl)
            .filter(([, dataUrl]) => Boolean(dataUrl))
            .map(([key, dataUrl]) => [
              key,
              {
                dataUrl,
                backgroundMode: dynamicFieldState.values.imageBackgroundMode[key] ?? 'with',
              },
            ]),
        ),
      },
    };

    setSubmissionError(null);
    createJobMutation.mutate({
      frameId: selectedFrameId,
      imageId: selectedImage?.id,
      kind,
      prompt,
      title: title.trim() || undefined,
      negativePrompt: negativePrompt.trim() || undefined,
      model,
      frameInputs: Object.keys(frameInputs.text).length || Object.keys(frameInputs.images).length ? frameInputs : undefined,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="AI Compose"
        title="Compose and queue branded assets"
        description="Pick image + frame, fill dynamic values, preview, and queue generation using existing backend logic."
      />

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Composition Setup" subtitle="Keep your current generation behavior with a cleaner workspace." />
        <div className="mb-4 rounded-[24px] border border-teal-100 bg-teal-50/80 p-4">
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
            <span className="rounded-full bg-white px-2.5 py-1">1. Pick image</span>
            <span className="rounded-full bg-white px-2.5 py-1">2. Choose frame</span>
            <span className="rounded-full bg-white px-2.5 py-1">3. Fill values</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Start with the image you want to brand, then place a frame over it and complete the fields needed for the final export.
          </p>
        </div>

        <form className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Image category</span>
            <select className="field" value={imageCategoryId} onChange={event => setImageCategoryId(event.target.value)}>
              <option value="">Select collection</option>
              {rootImageCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          {childImageCategories.length ? (
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Subcategory</span>
              <select className="field" value={imageSubcategoryId} onChange={event => setImageSubcategoryId(event.target.value)}>
                <option value="">All in this collection</option>
                {childImageCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Base image</span>
            <select className="field" value={imageId} onChange={event => setImageId(event.target.value)}>
              <option value="">Select image</option>
              {selectedImages.map(image => (
                <option key={image.id} value={image.id} disabled={Boolean(image.isLocked)}>
                  {image.name}{image.isLocked ? ' (subscription required)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Output type</span>
            <select
              className="field"
              value={kind}
              onChange={event => {
                const nextKind = event.target.value as 'IMAGE' | 'VIDEO';
                setKind(nextKind);
                setModel(nextKind === 'VIDEO' ? 'runway-gen' : 'gpt-image-1');
              }}
            >
              <option value="IMAGE">Image composition</option>
              <option value="VIDEO">Video composition</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Render mode</span>
            <select className="field" value={composeMode} onChange={event => setComposeMode(event.target.value as 'manual' | 'preview')}>
              <option value="manual">Manual compose</option>
              <option value="preview">Preview only</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Frame category</span>
            <select className="field" value={frameCategoryId} onChange={event => setFrameCategoryId(event.target.value)}>
              <option value="">All frame categories</option>
              {frameCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Frame filter</span>
            <select
              className="field"
              value={frameFilter}
              onChange={event => setFrameFilter(event.target.value as 'all' | 'featured' | 'trending')}
            >
              <option value="all">All frames</option>
              <option value="featured">Featured frames</option>
              <option value="trending">Trending frames</option>
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Choose frame</span>
            <select className="field" value={selectedFrameId} onChange={event => setFrameId(event.target.value)}>
              {frames.map(frame => (
                <option key={frame.id} value={frame.id} disabled={Boolean(frame.isLocked)}>
                  {frame.title}{frame.isLocked ? ' (subscription required)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2 rounded-[24px] border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Selection summary</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedImage?.name ?? 'No image selected'} + {frames.find(frame => frame.id === selectedFrameId)?.title ?? 'No frame selected'}
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                {selectedFrameId ? 'Ready to render' : 'Pick a frame'}
              </div>
            </div>
          </div>

          <DynamicFrameFields
            fields={frame?.dynamicFields ?? []}
            values={dynamicFieldState.values}
            onTextChange={dynamicFieldState.setTextValue}
            onImageSelect={async (key, file) => {
              const previewObjectUrl = URL.createObjectURL(file);
              dynamicFieldState.setImagePreview(key, previewObjectUrl);
              const dataUrl = await fileToDataUrl(file);
              dynamicFieldState.setImageData(key, dataUrl);
            }}
            onImageBackgroundModeChange={dynamicFieldState.setImageBackground}
          />

          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Live Preview</p>
            {isPreviewRendering ? <p className="text-xs text-slate-500">Rendering preview...</p> : null}
            {previewError ? <p className="text-xs text-rose-600">{previewError}</p> : null}
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Live preview" className="max-h-[360px] w-full rounded-lg border border-slate-200 object-contain" />
                <div className="mt-2">
                  <a
                    className="btn-secondary inline-flex"
                    href={previewUrl}
                    download={`${(title.trim() || frame?.title || 'framed-image').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                  >
                    Download Preview
                  </a>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Pick image and frame to see preview.</p>
            )}
          </div>

          <input
            className="field md:col-span-2"
            placeholder="Optional title"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
          <textarea
            className="field md:col-span-2"
            rows={4}
            placeholder="Optional notes for the composition"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
          />
          <textarea
            className="field md:col-span-2"
            rows={3}
            placeholder="Optional negative notes"
            value={negativePrompt}
            onChange={event => setNegativePrompt(event.target.value)}
          />
          <Button className="md:col-span-2" type="button" onClick={onQueueGeneration} loading={createJobMutation.isPending}>
            Queue composition
          </Button>
          {submissionError ? <p className="text-sm text-amber-700">{submissionError}</p> : null}
          {createJobMutation.isError ? <p className="text-sm text-rose-700">Failed to queue job.</p> : null}
        </form>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Composition Status" subtitle="Queued and running jobs for your image-and-frame compositions." />
        {jobsQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading jobs...</p> : null}
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-medium">{job.title}</p>
              <p className="text-xs text-slate-500">{job.status} • {job.kind} • {job.frameName}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
