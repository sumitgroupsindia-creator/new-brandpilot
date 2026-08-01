import { useQuery } from '@tanstack/react-query';
import { ShellCard } from '../../components/ShellCard';
import { apiGetAssets } from '../../lib/api';

export function HistoryPage() {
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: apiGetAssets });
  const assets = assetsQuery.data ?? [];

  return (
    <ShellCard title="AI History" subtitle="Generated assets and job outcomes.">
      {assetsQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading history...</p> : null}
      {assetsQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load history.</p> : null}
      <div className="space-y-2">
        {assets.map(asset => (
          <article key={asset.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{asset.title}</h3>
                <p className="text-sm text-slate-600">{asset.frameName} • {asset.kind}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{asset.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{new Date(asset.createdAt).toLocaleString()} • {asset.creditsUsed} credits</p>
          </article>
        ))}
      </div>
    </ShellCard>
  );
}
