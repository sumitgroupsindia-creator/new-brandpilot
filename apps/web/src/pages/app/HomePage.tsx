import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { CategoryCard } from '@shared/components/shared/CategoryCard';
import { CategoryGrid } from '@shared/components/shared/CategoryGrid';
import { TemplateCard } from '@shared/components/shared/TemplateCard';
import { TemplateGrid } from '@shared/components/shared/TemplateGrid';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
import { SearchInput } from '@shared/components/ui/SearchInput';
import { apiGetAssets, apiGetFrameCategories, apiGetFrames, apiGetImageCategories } from '../../lib/api';

export function HomePage() {
  const navigate = useNavigate();
  const framesQuery = useQuery({ queryKey: ['frames'], queryFn: apiGetFrames });
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: apiGetAssets });
  const frameCategoriesQuery = useQuery({ queryKey: ['frame-categories'], queryFn: apiGetFrameCategories });
  const imageCategoriesQuery = useQuery({ queryKey: ['image-categories'], queryFn: apiGetImageCategories });
  const [posterPrompt, setPosterPrompt] = useState('');

  const frames = framesQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const frameCategories = (frameCategoriesQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const imageCategories = (imageCategoriesQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const recentAssets = assets.slice(0, 4);
  const runningJobs = assets.filter(asset => asset.status === 'RUNNING').length;
  const featuredFrames = frames.filter(frame => frame.featured).slice(0, 6);
  const recommendedFrames = frames.filter(frame => frame.trending).slice(0, 3);
  const topImageCategories = imageCategories.slice(0, 8);
  const heroCtaClass = 'border border-white/35 bg-white/14 text-white shadow-[0_10px_28px_rgba(6,8,20,0.16)] backdrop-blur-md transition hover:bg-white/22';

  const isLoading = framesQuery.isLoading || assetsQuery.isLoading || frameCategoriesQuery.isLoading || imageCategoriesQuery.isLoading;
  const hasError = framesQuery.isError || assetsQuery.isError || frameCategoriesQuery.isError || imageCategoriesQuery.isError;

  return (
    <>
      <section className="dashboard-hero overflow-hidden rounded-[28px] border border-white/20 bg-[linear-gradient(122deg,#ff6a22_0%,#f23686_56%,#5f68ea_100%)] p-5 text-white shadow-[0_22px_58px_rgba(58,22,84,0.26)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div>
            <span className="inline-flex rounded-full bg-white/22 px-3 py-1 text-xs font-semibold tracking-[0.06em]">AI Studio • New</span>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">Hi Creator - let's ship something amazing today.</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">Search premium templates, choose a category, customize with your content, and export polished assets fast.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/app/ai-studio"><Button variant="outline" className={heroCtaClass}>+ New design</Button></Link>
              <Link to="/app/frames"><Button variant="outline" className={heroCtaClass}>Browse templates</Button></Link>
            </div>
          </div>

          <div className="dashboard-hero-panel rounded-[26px] border border-white/20 bg-white/18 p-4 backdrop-blur-md sm:p-5">
            <p className="text-xl font-semibold text-white">Text to poster</p>
            <p className="mt-1 text-sm text-white/90">Describe your design and AI will generate options.</p>
            <SearchInput
              className="mt-3"
              placeholder="e.g. Diwali sale 50% off"
              aria-label="Prompt"
              value={posterPrompt}
              onChange={event => setPosterPrompt(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className={heroCtaClass}
                onClick={() => {
                  const trimmedPrompt = posterPrompt.trim();
                  const search = trimmedPrompt ? `?prompt=${encodeURIComponent(trimmedPrompt)}` : '';
                  navigate(`/app/ai-studio${search}`);
                }}
              >
                Open in AI Studio
              </Button>
              <Link to="/app/ai-studio"><Button variant="outline" className={heroCtaClass}>New design</Button></Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Diwali sale', 'New product', 'Birthday', 'Wedding invite'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setPosterPrompt(tag)}
                  className="rounded-full bg-white/25 px-3 py-1 text-sm text-white transition hover:bg-white/32"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Active jobs</p>
                <p className="text-2xl font-semibold">{runningJobs}</p>
              </div>
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Frames</p>
                <p className="text-2xl font-semibold">{frames.length}</p>
              </div>
              <div className="dashboard-hero-metric rounded-xl bg-black/16 p-2">
                <p className="text-xs text-white/75">Categories</p>
                <p className="text-2xl font-semibold">{imageCategories.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Card className="dashboard-quick-actions p-4 sm:p-5" variant="default">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction title="New design" subtitle="Blank canvas" tone="pink" />
          <QuickAction title="AI studio" subtitle="Image + Video" tone="violet" />
          <QuickAction title="Upload image" subtitle="Edit existing" tone="blue" />
          <QuickAction title="Go Premium" subtitle="Unlock all" tone="amber" />
        </div>
      </Card>

      <Card className="dashboard-chip-surface p-4 sm:p-5" variant="default">
        <SectionHeader title="Category Chips" subtitle="Popular creative categories for quick start." />
        <div className="flex flex-wrap gap-3">
          {['Trending', 'Popular', 'Festival', 'Business', 'Political', 'Birthday', 'Wedding', 'Education', 'Social Media', 'Restaurant', 'Healthcare', 'Technology'].map((label, index) => (
            <button
              key={label}
              type="button"
              className="group inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm font-medium text-[var(--color-ink-muted)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
            >
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white ${chipTone(index)}`}>•</span>
              {label}
            </button>
          ))}
        </div>
      </Card>

      {isLoading ? <LoadingState lines={4} /> : null}
      {hasError ? <ErrorState description="Some dashboard data failed to load. You can still access core flows from navigation." /> : null}

      {!isLoading && !hasError ? (
        <section className="space-y-6">
          <Card className="p-4 sm:p-5">
            <SectionHeader
              title="Categories"
              subtitle="Start with category discovery and reach template customization in one click."
              actions={<Link to="/app/categories"><Button variant="ghost" size="sm">View all</Button></Link>}
            />
            {topImageCategories.length ? (
              <CategoryGrid>
                {topImageCategories.map(category => (
                  <CategoryCard
                    key={category.id}
                    name={category.name}
                    imageUrl={category.images[0]?.url}
                    countLabel={`${category.images.length} items`}
                  />
                ))}
              </CategoryGrid>
            ) : (
              <EmptyState title="No categories yet" description="Image categories will appear here when available." />
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader
              title="Popular and Recommended Templates"
              subtitle="AI-highlighted and featured templates for faster campaign launches."
              actions={<Link to="/app/frames"><Button variant="ghost" size="sm">Open library</Button></Link>}
            />
            {featuredFrames.length ? (
              <TemplateGrid>
                {featuredFrames.map(frame => (
                  <TemplateCard
                    key={frame.id}
                    title={frame.title}
                    category={frame.category}
                    description={frame.description}
                    thumbnailUrl={frame.thumbnailUrl}
                    tier={frame.tier}
                    credits={frame.estimatedCredits}
                    isLocked={frame.isLocked}
                    onPreview={() => undefined}
                    onUse={() => undefined}
                  />
                ))}
              </TemplateGrid>
            ) : (
              <EmptyState title="No templates yet" description="Featured templates will appear once configured." />
            )}
            {recommendedFrames.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {recommendedFrames.map(frame => (
                  <Badge key={frame.id} variant="ai">Suggested: {frame.title}</Badge>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader title="Recent Work" subtitle="Continue from your latest generated assets." actions={<Link to="/app/history"><Button variant="ghost" size="sm">See history</Button></Link>} />
            {recentAssets.length ? (
              <div className="space-y-2">
                {recentAssets.map(asset => (
                  <article key={asset.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-ink)]">{asset.title}</p>
                        <p className="text-xs text-[var(--color-ink-subtle)]">{asset.frameName} • {asset.kind}</p>
                      </div>
                      <Badge variant={asset.status === 'FAILED' ? 'error' : asset.status === 'SUCCEEDED' ? 'success' : 'warning'}>
                        {asset.status}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No recent work" description="Generated assets will show up here for quick continuation." />
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeader title="Frame Categories" subtitle="Admin-managed frame segmentation for browse and filtering." actions={<Link to="/app/frames"><Button variant="ghost" size="sm">Browse frames</Button></Link>} />
            <div className="grid gap-2 sm:grid-cols-2">
              {frameCategories.map(category => (
                <div key={category.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]">Rank {category.sortOrder}</p>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{category.name}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </>
  );
}

function QuickAction({ title, subtitle, tone }: { title: string; subtitle: string; tone: 'pink' | 'violet' | 'blue' | 'amber' }) {
  const tones = {
    pink: 'bg-[linear-gradient(135deg,#ff4f74,#ff7f35)]',
    violet: 'bg-[linear-gradient(135deg,#7b3bff,#d946ef)]',
    blue: 'bg-[linear-gradient(135deg,#2563eb,#06b6d4)]',
    amber: 'bg-[linear-gradient(135deg,#f59e0b,#f97316)]',
  };

  return (
    <button type="button" className="dashboard-quick-action rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xl font-semibold text-white ${tones[tone]}`}>+</span>
      <p className="mt-3 text-2xl font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="text-sm text-[var(--color-ink-subtle)]">{subtitle}</p>
    </button>
  );
}

function chipTone(index: number) {
  const palette = [
    'bg-[#ef4444]',
    'bg-[#f97316]',
    'bg-[#8b5cf6]',
    'bg-[#2563eb]',
    'bg-[#db2777]',
    'bg-[#c026d3]',
    'bg-[#ec4899]',
    'bg-[#0ea5e9]',
    'bg-[#7c3aed]',
    'bg-[#f59e0b]',
    'bg-[#10b981]',
    'bg-[#334155]',
  ];

  return palette[index % palette.length];
}
