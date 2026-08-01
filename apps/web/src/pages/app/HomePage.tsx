import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShellCard } from '../../components/ShellCard';
import { apiGetAssets, apiGetFrameCategories, apiGetFrames, apiGetImageCategories } from '../../lib/api';

export function HomePage() {
  const framesQuery = useQuery({ queryKey: ['frames'], queryFn: apiGetFrames });
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: apiGetAssets });
  const frameCategoriesQuery = useQuery({ queryKey: ['frame-categories'], queryFn: apiGetFrameCategories });
  const imageCategoriesQuery = useQuery({ queryKey: ['image-categories'], queryFn: apiGetImageCategories });

  const frames = framesQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const frameCategories = (frameCategoriesQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const imageCategories = (imageCategoriesQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const runningJobs = assets.filter(a => a.status === 'RUNNING').length;
  const featuredFrames = frames.filter(f => f.featured).slice(0, 3);

  return (
    <>
      <ShellCard className="hero-shell overflow-hidden">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="pill">AI creative command center</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Build polished campaigns with a premium studio experience.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Review assets, launch generation flows, and keep every creative decision on-brand from a beautifully organized workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/app/generate">
                Generate new asset
              </Link>
              <Link className="btn-secondary" to="/app/frames">
                Explore frames
              </Link>
            </div>
          </div>

          <div className="glass-panel p-4">
            <div className="rounded-[24px] bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Live pulse</p>
                  <p className="mt-1 text-lg font-semibold">Momentum is strong</p>
                </div>
                <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300">
                  +12%
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                    <span>Quality score</span>
                    <span>94%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[94%] rounded-full bg-gradient-to-r from-teal-400 to-cyan-400" />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                    <span>Delivery velocity</span>
                    <span>87%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[87%] rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ShellCard>

      <ShellCard title="Today at a glance" subtitle="A polished snapshot of your creative performance.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Generated" value="148" tone="teal" />
          <Metric title="Running jobs" value={String(runningJobs)} tone="amber" />
          <Metric title="Top frame" value={frames[0]?.title ?? 'N/A'} tone="slate" />
          <Metric title="Featured" value={String(featuredFrames.length)} tone="violet" />
        </div>
      </ShellCard>

      <ShellCard title="Featured frames" subtitle="Premium picks for your next campaign.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {featuredFrames.map(frame => (
            <article key={frame.id} className="rounded-[24px] border border-slate-200/70 bg-slate-50/80 p-4">
              <div className="h-24 rounded-2xl bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_rgba(109,40,217,0.12))]" />
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">{frame.category}</p>
              <h3 className="mt-1 font-semibold text-slate-900">{frame.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{frame.description}</p>
              <p className="mt-3 text-sm font-semibold text-amber-700">{frame.estimatedCredits} credits</p>
            </article>
          ))}
        </div>
      </ShellCard>

      <ShellCard title="Categories" subtitle="Use ranked categories exactly as configured by admin.">
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Frame categories</h3>
              <Link className="text-xs font-semibold text-teal-700 underline" to="/app/frames">
                Open frames
              </Link>
            </div>
            <div className="space-y-2">
              {frameCategories.map(category => (
                <article key={category.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Rank {category.sortOrder}</p>
                  <p className="mt-1 font-medium text-slate-900">{category.name}</p>
                </article>
              ))}
              {!frameCategories.length ? <p className="text-sm text-slate-500">No frame categories available.</p> : null}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Image categories</h3>
              <Link className="text-xs font-semibold text-teal-700 underline" to="/app/generate">
                Open generate
              </Link>
            </div>
            <div className="space-y-2">
              {imageCategories.map(category => (
                <article key={category.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Rank {category.sortOrder}</p>
                  <p className="mt-1 font-medium text-slate-900">{category.name}</p>
                  <p className="text-xs text-slate-500">{category.images.length} images</p>
                </article>
              ))}
              {!imageCategories.length ? <p className="text-sm text-slate-500">No image categories available.</p> : null}
            </div>
          </section>
        </div>
      </ShellCard>
    </>
  );
}

function Metric({ title, value, tone }: { title: string; value: string; tone: 'teal' | 'amber' | 'slate' | 'violet' }) {
  const classes = {
    teal: 'border-teal-100 bg-teal-50 text-teal-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-slate-100 text-slate-900',
    violet: 'border-violet-100 bg-violet-50 text-violet-900',
  };

  return (
    <div className={`rounded-[22px] border p-4 ${classes[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.24em]">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
