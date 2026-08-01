import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { TemplateCard } from '@shared/components/shared/TemplateCard';
import { TemplateGrid } from '@shared/components/shared/TemplateGrid';
import { SearchInput } from '@shared/components/ui/SearchInput';
import { Card } from '@shared/components/ui/Card';
import { LoadingState } from '@shared/components/ui/LoadingState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Button } from '@shared/components/ui/Button';
import { apiGetFrameCategories, apiGetFramesByCategory } from '../../lib/api';

export function FramesPage() {
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const frameCategoriesQuery = useQuery({ queryKey: ['frame-categories'], queryFn: apiGetFrameCategories });
  const framesQuery = useQuery({
    queryKey: ['frames', categoryId],
    queryFn: () => apiGetFramesByCategory({ categoryId: categoryId || undefined }),
  });

  const frameCategoriesRaw = frameCategoriesQuery.data ?? [];
  const frameCategories = useMemo(
    () => [...frameCategoriesRaw].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [frameCategoriesRaw],
  );
  const frames = framesQuery.data ?? [];
  const filteredFrames = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return frames;
    return frames.filter(frame => {
      return (
        frame.title.toLowerCase().includes(query)
        || frame.category.toLowerCase().includes(query)
        || frame.description.toLowerCase().includes(query)
      );
    });
  }, [frames, search]);

  useEffect(() => {
    if (!frameCategories.length || categoryId) {
      return;
    }
    setCategoryId(frameCategories[0]?.id ?? '');
  }, [frameCategories, categoryId]);

  return (
    <>
      <PageHeader
        eyebrow="Template Gallery"
        title="Select a design template"
        description="Browse premium and free templates, preview visual style, and open the editor without changing underlying business logic."
      />

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Filters" subtitle="Search by name/category and refine by frame category." />
        <div className="grid gap-3 md:grid-cols-2">
          <SearchInput placeholder="Search templates" value={search} onChange={event => setSearch(event.target.value)} />
          <select className="field md:col-span-2" value={categoryId} onChange={event => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {frameCategories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Template Collection" subtitle="Preview and open any template in the existing editor flow." />
        {framesQuery.isLoading ? <LoadingState lines={4} /> : null}
        {framesQuery.isError ? <ErrorState description="Failed to load frame templates." /> : null}
        {!framesQuery.isLoading && !framesQuery.isError ? (
          filteredFrames.length ? (
            <TemplateGrid>
              {filteredFrames.map(frame => (
                <div key={frame.id} className="space-y-2">
                  <TemplateCard
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
                  <Link to={`/app/frames/${frame.id}`}>
                    <Button className="w-full" variant="secondary">Open in editor</Button>
                  </Link>
                </div>
              ))}
            </TemplateGrid>
          ) : (
            <EmptyState title="No templates match your filter" description="Try a different search term or category." />
          )
        ) : null}
      </Card>
    </>
  );
}
