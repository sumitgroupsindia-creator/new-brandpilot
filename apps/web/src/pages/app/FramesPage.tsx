import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShellCard } from '../../components/ShellCard';
import { apiGetFrameCategories, apiGetFramesByCategory } from '../../lib/api';

export function FramesPage() {
  const [categoryId, setCategoryId] = useState('');
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

  useEffect(() => {
    if (!frameCategories.length || categoryId) {
      return;
    }
    setCategoryId(frameCategories[0]?.id ?? '');
  }, [frameCategories, categoryId]);

  return (
    <ShellCard title="Frame Catalogue" subtitle="Free and premium templates with dynamic placeholders.">
      {framesQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading frames...</p> : null}
      {framesQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load frames.</p> : null}
      <div className="mb-4 grid gap-3 md:max-w-sm">
        <select className="field" value={categoryId} onChange={event => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {frameCategories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {frames.map(frame => (
          <article key={frame.id} className="rounded-xl border border-slate-200 p-4">
              {frame.thumbnailUrl ? (
                <img src={frame.thumbnailUrl} alt={frame.title} className="mb-3 h-32 w-full rounded-lg object-cover" />
              ) : null}
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{frame.category}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${frame.tier === 'PREMIUM' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                {frame.tier}
              </span>
            </div>
            <h3 className="mt-2 font-semibold">{frame.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{frame.description}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{frame.estimatedCredits} credits</span>
              <div className="flex items-center gap-3">
                {frame.isLocked ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Subscription required</span>
                ) : null}
                <Link className="text-sm font-semibold text-teal-700 underline" to={`/app/frames/${frame.id}`}>
                  Open
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </ShellCard>
  );
}
