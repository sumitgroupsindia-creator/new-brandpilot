import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DynamicFrameFields } from '../../components/frame/DynamicFrameFields';
import { CategoryCard } from '@shared/components/shared/CategoryCard';
import { CategoryGrid } from '@shared/components/shared/CategoryGrid';
import { DownloadButton } from '@shared/components/shared/DownloadButton';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { TemplateCard } from '@shared/components/shared/TemplateCard';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Modal } from '@shared/components/ui/Modal';
import { SearchInput } from '@shared/components/ui/SearchInput';
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
  const [categorySearch, setCategorySearch] = useState('');
  const [imageSearch, setImageSearch] = useState('');
  const [frameSearch, setFrameSearch] = useState('');
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

  const filteredRootCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return rootCategories;
    return rootCategories.filter(category => category.name.toLowerCase().includes(query));
  }, [rootCategories, categorySearch]);

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
  const filteredVisibleImages = useMemo(() => {
    const query = imageSearch.trim().toLowerCase();
    if (!query) return visibleImages;
    return visibleImages.filter(image => image.name.toLowerCase().includes(query));
  }, [visibleImages, imageSearch]);
  const selectedImage = visibleImages.find(image => image.id === selectedImageId) ?? null;
  const frames = framesQuery.data ?? [];
  const filteredFrames = useMemo(() => {
    const query = frameSearch.trim().toLowerCase();
    if (!query) return frames;
    return frames.filter(frame => {
      return (
        frame.title.toLowerCase().includes(query)
        || frame.category.toLowerCase().includes(query)
      );
    });
  }, [frames, frameSearch]);
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

  const totalCategories = rootCategories.length;
  const totalImages = visibleImages.length;
  const totalFrames = frames.length;

  return (
    <>
      <PageHeader
        eyebrow="Discover • Select • Customize"
        title="Category-driven creation workspace"
        description="Use your existing business flow with a redesigned interface that surfaces recommendations, clear progress, and a focused composition studio."
        actions={<Link to="/app/frames"><Button variant="secondary">Template Library</Button></Link>}
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]">Categories</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{totalCategories}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]">Images in view</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{totalImages}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]">Templates</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{totalFrames}</p>
          </div>
        </div>
      </PageHeader>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Step 1: Choose Category" subtitle="Search and select from admin-synced image categories." />
        <SearchInput placeholder="Search categories" value={categorySearch} onChange={event => setCategorySearch(event.target.value)} />
        <div className="mt-3">
          {filteredRootCategories.length ? (
            <CategoryGrid>
              {filteredRootCategories.map(category => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  imageUrl={category.images[0]?.url}
                  countLabel={`${category.images.length} images`}
                  selected={selectedRoot?.id === category.id}
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setSelectedSubcategoryId('');
                    setSelectedImageId('');
                    setSelectedFrameId('');
                  }}
                />
              ))}
            </CategoryGrid>
          ) : (
            <EmptyState title="No categories found" description="Try a different search term." />
          )}
        </div>
      </Card>

      {selectedRoot ? (
        <Card className="p-4 sm:p-5">
          <SectionHeader title={`Step 2: Pick an Image (${selectedRoot.name})`} subtitle="Optional subcategories and searchable image gallery." />

          {visibleSubcategories.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {visibleSubcategories.map(subcategory => {
                const isActive = selectedLeafCategory?.id === subcategory.id;
                return (
                  <Button
                    key={subcategory.id}
                    variant={isActive ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      setSelectedSubcategoryId(subcategory.id);
                      setSelectedImageId('');
                      setSelectedFrameId('');
                    }}
                  >
                    {subcategory.name}
                  </Button>
                );
              })}
            </div>
          ) : null}

          <SearchInput placeholder="Search images in selected category" value={imageSearch} onChange={event => setImageSearch(event.target.value)} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredVisibleImages.map(image => (
              <button
                key={image.id}
                type="button"
                onClick={() => {
                  setSelectedImageId(image.id);
                  setSelectedFrameId('');
                }}
                className={`overflow-hidden rounded-[var(--radius-lg)] border text-left transition ${
                  selectedImageId === image.id
                    ? 'border-[var(--color-brand-500)] ring-2 ring-cyan-100'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                <img src={image.url} alt={image.name} className="h-36 w-full object-cover" loading="lazy" />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{image.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">Select to continue</p>
                </div>
              </button>
            ))}
          </div>
          {!filteredVisibleImages.length ? <div className="mt-3"><EmptyState title="No images found" description="Try a different search or subcategory." /></div> : null}
        </Card>
      ) : null}

      {selectedImage ? (
        <Card className="p-4 sm:p-5">
          <SectionHeader title="Step 3: Open Composition Studio" subtitle="Launch template selection, customization, live preview, and download in one focused workspace." />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center gap-3">
              <img src={selectedImage.url} alt={selectedImage.name} className="h-14 w-14 rounded-[var(--radius-md)] object-cover" />
              <div>
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]">Selected image</p>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{selectedImage.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/app/frames"><Button variant="ghost" size="sm">Browse all templates</Button></Link>
              <Button onClick={() => setIsComposerOpen(true)}>Open Composer</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Modal
        open={isComposerOpen && Boolean(selectedImage)}
        onClose={() => setIsComposerOpen(false)}
        title={selectedImage?.name ?? 'Composer'}
        description="Choose template, fill dynamic fields, preview, and download your final output."
      >
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.2fr_1fr]">
          <Card className="p-4">
            <SectionHeader title="Templates" subtitle={`${filteredFrames.length} available`} />
            <SearchInput placeholder="Search templates" value={frameSearch} onChange={event => setFrameSearch(event.target.value)} />
            <div className="mt-3 space-y-3">
              {framesQuery.isLoading ? <p className="text-sm text-[var(--color-ink-subtle)]">Loading templates...</p> : null}
              {filteredFrames.map(frame => (
                <TemplateCard
                  key={frame.id}
                  title={frame.title}
                  category={frame.category}
                  description={frame.description}
                  thumbnailUrl={frame.thumbnailUrl}
                  tier={frame.tier}
                  credits={frame.estimatedCredits}
                  isLocked={frame.isLocked}
                  onPreview={() => setSelectedFrameId(frame.id)}
                  onUse={() => setSelectedFrameId(frame.id)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="Editor" subtitle={selectedFrame ? selectedFrame.title : 'Select a template to customize'} />
            {selectedFrameId && frameDetailQuery.isLoading ? <p className="mb-2 text-xs text-[var(--color-ink-subtle)]">Loading full frame template...</p> : null}
            {selectedFrame ? (
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
                  <DownloadButton className="md:col-span-2" isDownloading={isDownloading} onClick={onDownloadFilledFrame}>
                    Download Final Artwork
                  </DownloadButton>
                ) : (
                  <p className="md:col-span-2 rounded-[var(--radius-md)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2 text-sm text-[var(--color-warning-700)]">
                    Complete required fields to enable export.
                  </p>
                )}

                {downloadError ? <p className="md:col-span-2 text-sm text-[var(--color-danger-700)]">{downloadError}</p> : null}
              </form>
            ) : (
              <EmptyState title="Template required" description="Select a template from the left panel to start editing." />
            )}
          </Card>

          <Card className="p-4">
            <SectionHeader title="Live Preview" subtitle="Real-time composed output" />
            <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-ink-subtle)]">
              <span>Source: {resolvedBackground.source}</span>
              {previewRenderMode ? <Badge variant={previewRenderMode === 'full-template' ? 'success' : 'warning'}>{previewRenderMode}</Badge> : null}
            </div>

            {previewDebugSummary ? <p className="mb-2 rounded-[var(--radius-sm)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-2 py-1 text-[11px] text-[var(--color-warning-700)]">{previewDebugSummary}</p> : null}
            {isPreviewRendering ? <p className="text-xs text-[var(--color-ink-subtle)]">Rendering preview...</p> : null}
            {previewError ? <p className="text-xs text-[var(--color-danger-700)]">{previewError}</p> : null}

            {previewUrl ? (
              <img src={previewUrl} alt="Composed preview" className="max-h-[560px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] object-contain bg-white" />
            ) : (
              <EmptyState title="Preview pending" description="Select a template and add values to render the preview." />
            )}
          </Card>
        </div>
      </Modal>
    </>
  );
}
