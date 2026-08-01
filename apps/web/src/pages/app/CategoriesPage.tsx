import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShellCard } from '../../components/ShellCard';
import { DynamicFrameFields } from '../../components/frame/DynamicFrameFields';
import { useDynamicFrameFields } from '../../hooks/useDynamicFrameFields';
import { apiGetFrame, apiGetFrames, apiGetImageCategories } from '../../lib/api';
import { exportFrameInputsAsImage, renderFrameInputsPreview } from '../../lib/frameInputImageExport';

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

function fetchImageAsDataUrl(url: string) {
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Unable to fetch selected image');
      }
      return response.blob();
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unable to read selected image'));
        }
      };
      reader.onerror = () => reject(new Error('Unable to read selected image'));
      reader.readAsDataURL(blob);
    }));
}

type ImageCategoryNode = {
  id: string;
  name: string;
  sortOrder: number;
  parentId?: string | null;
  images: Array<{
    id: string;
    name: string;
    url: string;
    sortOrder: number;
  }>;
};

export function CategoriesPage() {
  const imageCategoriesQuery = useQuery({ queryKey: ['image-categories'], queryFn: apiGetImageCategories });
  const framesQuery = useQuery({ queryKey: ['frames'], queryFn: apiGetFrames });

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedImageId, setSelectedImageId] = useState('');
  const [selectedFrameId, setSelectedFrameId] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const categories = useMemo(
    () =>
      (imageCategoriesQuery.data ?? [])
        .map(category => ({
          ...category,
          images: [...(category.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [imageCategoriesQuery.data],
  );

  const rootCategories = categories;

  const subcategoriesByParent = useMemo(() => {
    const grouped = new Map<string, ImageCategoryNode[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const existing = grouped.get(category.parentId) ?? [];
      existing.push(category);
      grouped.set(category.parentId, existing);
    }
    return grouped;
  }, [categories]);

  const selectedRoot = useMemo(
    () =>
      rootCategories.find(category => category.id === selectedCategoryId)
      ?? rootCategories.find(category => category.images.length > 0)
      ?? rootCategories[0]
      ?? null,
    [rootCategories, selectedCategoryId],
  );

  const visibleSubcategories = useMemo(
    () => (selectedRoot ? subcategoriesByParent.get(selectedRoot.id) ?? [] : []),
    [selectedRoot, subcategoriesByParent],
  );

  const selectedLeafCategory = useMemo(() => {
    if (!selectedRoot) return null;
    if (!visibleSubcategories.length || selectedRoot.images.length > 0) return selectedRoot;
    return visibleSubcategories.find(category => category.id === selectedSubcategoryId) ?? visibleSubcategories[0] ?? null;
  }, [selectedRoot, visibleSubcategories, selectedSubcategoryId]);

  const visibleImages = selectedLeafCategory?.images ?? [];
  const selectedImage = visibleImages.find(image => image.id === selectedImageId) ?? null;
  const frames = framesQuery.data ?? [];
  const selectedFrameSummary = frames.find(frame => frame.id === selectedFrameId) ?? null;
  const frameDetailQuery = useQuery({
    queryKey: ['frame', selectedFrameId],
    queryFn: () => apiGetFrame(selectedFrameId),
    enabled: Boolean(selectedFrameId),
  });
  const selectedFrame = frameDetailQuery.data ?? selectedFrameSummary;
  const dynamicFieldState = useDynamicFrameFields(selectedFrame?.dynamicFields ?? []);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState('');
  const [previewRenderMode, setPreviewRenderMode] = useState<'full-template' | 'thumbnail-fallback' | 'dynamic-only' | 'blank' | null>(null);
  const [previewDebugSummary, setPreviewDebugSummary] = useState<string>('');

  const frameFields = selectedFrame?.dynamicFields ?? [];
  const resolvedBackground = useMemo(() => {
    if (selectedImageDataUrl) {
      return { url: selectedImageDataUrl, source: 'data-url' as const };
    }

    const renderableSelectedUrl = toRenderableImageUrl(selectedImage?.url);
    if (renderableSelectedUrl) {
      return {
        url: renderableSelectedUrl,
        source: renderableSelectedUrl.startsWith('/api/image-proxy?') ? ('proxy-url' as const) : ('image-url' as const),
      };
    }

    if (selectedFrame?.thumbnailUrl) {
      return { url: selectedFrame.thumbnailUrl, source: 'frame-thumbnail' as const };
    }

    return { url: undefined, source: 'none' as const };
  }, [selectedImageDataUrl, selectedImage?.url, selectedFrame?.thumbnailUrl]);

  const areFrameValuesFilled = useMemo(() => {
    if (!selectedFrame) return false;
    if (!frameFields.length) return true;

    return frameFields.every(field => {
      if (field.type === 'image') {
        return Boolean(dynamicFieldState.values.imageDataUrl[field.key] || field.defaultValue);
      }

      const value = dynamicFieldState.values.text[field.key] ?? field.defaultValue ?? '';
      return value.trim().length > 0;
    });
  }, [selectedFrame, frameFields, dynamicFieldState.values.imageDataUrl, dynamicFieldState.values.text]);

  const onDownloadFilledFrame = async () => {
    if (!selectedFrame || !selectedImage || !areFrameValuesFilled) return;

    setDownloadError(null);
    setIsDownloading(true);
    try {
      const safeTitle = selectedFrame.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'frame';

      await exportFrameInputsAsImage({
        filename: `${safeTitle}-${selectedImage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
        frameTitle: selectedFrame.title,
        backgroundUrl: resolvedBackground.url,
        thumbnailUrl: selectedFrame.thumbnailUrl,
        templateLayers: selectedFrame.templateLayers,
        renderSize: selectedFrame.renderSize,
        fields: frameFields,
        values: dynamicFieldState.values,
      });
    } catch (error) {
      if (error instanceof Error && error.message.trim()) {
        setDownloadError(error.message);
      } else {
        setDownloadError('Download failed. Please try again.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!selectedRoot) {
      setSelectedCategoryId('');
      return;
    }
    if (selectedCategoryId !== selectedRoot.id) {
      setSelectedCategoryId(selectedRoot.id);
    }
  }, [selectedRoot, selectedCategoryId]);

  useEffect(() => {
    if (!visibleSubcategories.length) {
      setSelectedSubcategoryId('');
      return;
    }
    if (selectedRoot?.images.length) {
      setSelectedSubcategoryId('');
      return;
    }
    if (!visibleSubcategories.some(category => category.id === selectedSubcategoryId)) {
      setSelectedSubcategoryId(visibleSubcategories[0]?.id ?? '');
    }
  }, [visibleSubcategories, selectedSubcategoryId, selectedRoot]);

  useEffect(() => {
    if (!visibleImages.length) {
      setSelectedImageId('');
      setSelectedFrameId('');
      return;
    }
    if (!visibleImages.some(image => image.id === selectedImageId)) {
      setSelectedImageId('');
      setSelectedFrameId('');
    }
  }, [visibleImages, selectedImageId]);

  useEffect(() => {
    setDownloadError(null);
  }, [selectedFrameId, selectedImageId]);

  useEffect(() => {
    setSelectedImageDataUrl('');
    const sourceUrl = toRenderableImageUrl(selectedImage?.url);
    if (!sourceUrl) {
      return;
    }

    let canceled = false;
    fetchImageAsDataUrl(sourceUrl)
      .then(dataUrl => {
        if (!canceled) {
          setSelectedImageDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!canceled) {
          setSelectedImageDataUrl('');
        }
      });

    return () => {
      canceled = true;
    };
  }, [selectedImage?.url]);

  useEffect(() => {
    if (!selectedImage) {
      setIsComposerOpen(false);
    }
  }, [selectedImage]);

  useEffect(() => {
    if (!isComposerOpen || selectedFrameId || !frames.length) {
      return;
    }
    setSelectedFrameId(frames[0]?.id ?? '');
  }, [isComposerOpen, selectedFrameId, frames]);

  useEffect(() => {
    if (!isComposerOpen || !selectedImage) {
      setPreviewUrl('');
      setPreviewError(null);
      setPreviewRenderMode(null);
      setPreviewDebugSummary('');
      return;
    }

    const timer = window.setTimeout(async () => {
      if (!selectedFrame) {
        setPreviewUrl(selectedImageDataUrl || selectedImage.url);
        setPreviewError(null);
        setPreviewRenderMode(null);
        setPreviewDebugSummary('');
        return;
      }

      setIsPreviewRendering(true);
      setPreviewError(null);
      try {
        const preview = await renderFrameInputsPreview({
          filename: 'preview.png',
          frameTitle: selectedFrame.title,
          backgroundUrl: resolvedBackground.url,
          thumbnailUrl: selectedFrame.thumbnailUrl,
          templateLayers: selectedFrame.templateLayers,
          renderSize: selectedFrame.renderSize,
          fields: frameFields,
          values: dynamicFieldState.values,
        });
        setPreviewUrl(preview.dataUrl);
        setPreviewRenderMode(preview.renderMode);
        const metrics = preview.debug?.metrics;
        const sizing = preview.debug?.backgroundSizing;
        if (metrics) {
          const summary = [
            `strict=${preview.debug.strictFrame2Mode ? 'yes' : 'no'}`,
            `bgDrawn=${preview.debug.backgroundDrawn ? 'yes' : 'no'}`,
            `thumbFallback=${preview.debug.usedThumbnailFallback ? 'yes' : 'no'}`,
            `staticDrawn=${metrics.staticImageLayersDrawn}`,
            `opaqueSkipped=${metrics.skippedOpaqueFullCanvas}`,
            `bgSkipped=${metrics.skippedTemplateBackground}`,
            `loadFail=${metrics.imageLoadFailures}`,
            sizing
              ? `bgSize=${sizing.sourceWidth}x${sizing.sourceHeight}->canvas=${sizing.canvasWidth}x${sizing.canvasHeight}`
              : 'bgSize=na',
          ].join(' | ');
          setPreviewDebugSummary(summary);
        } else {
          setPreviewDebugSummary('');
        }
      } catch (error) {
        setPreviewUrl('');
        setPreviewRenderMode(null);
        setPreviewDebugSummary('');
        if (error instanceof Error && error.message.trim()) {
          setPreviewError(error.message);
        } else {
          setPreviewError('Preview render failed.');
        }
      } finally {
        setIsPreviewRendering(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    isComposerOpen,
    selectedImage,
    selectedImageDataUrl,
    resolvedBackground.url,
    selectedFrame,
    frameFields,
    dynamicFieldState.values.text,
    dynamicFieldState.values.imageDataUrl,
    dynamicFieldState.values.imagePreviewUrl,
  ]);

  const stepStates = {
    category: Boolean(selectedRoot),
    image: Boolean(selectedImage),
    frame: Boolean(selectedFrame),
    values: Boolean(selectedFrame) && areFrameValuesFilled,
  };

  const totalCategories = rootCategories.length;
  const totalImages = visibleImages.length;
  const totalFrames = frames.length;

  return (
    <>
      <ShellCard title="Creative Composition Studio" subtitle="Category se image choose karo, frame apply karo, values fill karo, aur final artwork download karo.">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-900 p-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-100">Guided Flow</p>
                <h3 className="mt-1 text-xl font-semibold">Pro Category Composer</h3>
                <p className="mt-1 text-sm text-slate-200">Is panel mein step-by-step selection karo. Har step clear status ke saath show hoga.</p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-100">
                2026 Studio UX
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`rounded-xl border px-3 py-2 ${stepStates.category ? 'border-emerald-300/70 bg-emerald-300/20' : 'border-white/20 bg-white/5'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-200">Step 1</p>
                <p className="text-sm font-medium">Category</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${stepStates.image ? 'border-emerald-300/70 bg-emerald-300/20' : 'border-white/20 bg-white/5'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-200">Step 2</p>
                <p className="text-sm font-medium">Image</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${stepStates.frame ? 'border-emerald-300/70 bg-emerald-300/20' : 'border-white/20 bg-white/5'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-200">Step 3</p>
                <p className="text-sm font-medium">Frame</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${stepStates.values ? 'border-emerald-300/70 bg-emerald-300/20' : 'border-white/20 bg-white/5'}`}>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-200">Step 4</p>
                <p className="text-sm font-medium">Values + Download</p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Categories</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totalCategories}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Images in selection</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totalImages}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Frames available</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totalFrames}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">1. Select Category</h3>
              <span className="text-xs font-medium text-slate-500">Admin synced categories</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rootCategories.map(category => {
                const isActive = selectedRoot?.id === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedSubcategoryId('');
                      setSelectedImageId('');
                      setSelectedFrameId('');
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-emerald-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Rank {category.sortOrder}</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{category.name}</p>
                    <p className="mt-1 text-xs text-slate-600">{category.images.length} direct images</p>
                  </button>
                );
              })}
              {!rootCategories.length ? <p className="text-sm text-slate-500">No categories available.</p> : null}
            </div>
          </section>

          {selectedRoot ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">2. Pick Image ({selectedRoot.name})</h3>
                <span className="text-xs font-medium text-slate-500">Category ke baad image selection</span>
              </div>

              {visibleSubcategories.length ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {visibleSubcategories.map(subcategory => {
                    const isActive = selectedLeafCategory?.id === subcategory.id;
                    return (
                      <button
                        key={subcategory.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubcategoryId(subcategory.id);
                          setSelectedImageId('');
                          setSelectedFrameId('');
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {subcategory.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleImages.map(image => {
                  const isActive = image.id === selectedImageId;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => {
                        setSelectedImageId(image.id);
                        setSelectedFrameId('');
                      }}
                      className={`group overflow-hidden rounded-2xl border text-left transition ${
                        isActive
                          ? 'border-teal-500 ring-2 ring-teal-100 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <img src={image.url} alt={image.name} className="h-36 w-full object-cover transition group-hover:scale-[1.01]" loading="lazy" />
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{image.name}</p>
                        <p className="mt-1 text-xs text-slate-500">Click to continue with frames</p>
                      </div>
                    </button>
                  );
                })}
                {!visibleImages.length ? <p className="text-sm text-slate-500">No images in this category.</p> : null}
              </div>
            </section>
          ) : null}

          {selectedImage ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">3. Frame Composer Modal</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Next steps ek focused modal mein open honge: frame selection, values fill, live preview, download.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link className="text-xs font-semibold text-teal-700 underline" to="/app/frames">
                    Open full frame library
                  </Link>
                  <button className="btn-primary" type="button" onClick={() => setIsComposerOpen(true)}>
                    Open Composer
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <img src={selectedImage.url} alt={selectedImage.name} className="h-16 w-16 rounded-xl object-cover" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected image</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedImage.name}</p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </ShellCard>

      {isComposerOpen && selectedImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Sub Modal Composer</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{selectedImage.name}</h3>
                <p className="mt-1 text-sm text-slate-600">Frame choose karo, values fill karo, live preview dekho, then final download karo.</p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setIsComposerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Choose Frame</h4>
                  <span className="text-xs text-slate-500">{frames.length} available</span>
                </div>

                {framesQuery.isLoading ? <p className="text-sm text-slate-500">Loading frames...</p> : null}
                {selectedFrameId && frameDetailQuery.isLoading ? <p className="text-xs text-slate-500">Loading full frame template...</p> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {frames.map(frame => {
                    const isActive = selectedFrameId === frame.id;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => setSelectedFrameId(frame.id)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          isActive
                            ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-emerald-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{frame.tier}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{frame.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{frame.category}</p>
                      </button>
                    );
                  })}
                </div>

                {selectedFrame ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">Fill Values ({selectedFrame.title})</h4>
                      <span className="text-xs text-slate-500">Required fields complete karo</span>
                    </div>

                    <form className="grid gap-3 md:grid-cols-2" onSubmit={event => event.preventDefault()}>
                      <DynamicFrameFields
                        fields={frameFields}
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

                      {areFrameValuesFilled ? (
                        <button
                          className="btn-primary md:col-span-2"
                          type="button"
                          onClick={onDownloadFilledFrame}
                          disabled={isDownloading}
                        >
                          {isDownloading ? 'Preparing high-quality export...' : 'Download Final Artwork'}
                        </button>
                      ) : (
                        <p className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          Download enable karne ke liye required fields complete karo.
                        </p>
                      )}

                      {downloadError ? <p className="md:col-span-2 text-sm text-rose-700">{downloadError}</p> : null}
                    </form>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Live Preview</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Image + frame + values</span>
                    {previewRenderMode ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                          previewRenderMode === 'full-template'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : previewRenderMode === 'thumbnail-fallback'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        {previewRenderMode === 'full-template' ? 'Full template' : previewRenderMode === 'thumbnail-fallback' ? 'Thumbnail fallback' : previewRenderMode.replace('-', ' ')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mb-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                  Background source: <span className="font-semibold text-slate-800">{resolvedBackground.source}</span>
                  {' | '}
                  Render mode: <span className="font-semibold text-slate-800">{previewRenderMode ?? 'none'}</span>
                </p>

                {previewDebugSummary ? (
                  <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    Render debug: <span className="font-semibold">{previewDebugSummary}</span>
                  </p>
                ) : null}

                {isPreviewRendering ? <p className="text-xs text-slate-500">Rendering preview...</p> : null}
                {previewError ? <p className="text-xs text-rose-700">{previewError}</p> : null}

                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Composed preview"
                    className="max-h-[520px] w-full rounded-xl border border-slate-200 object-contain bg-white"
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                    Frame select karke yahan live preview dekho.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
