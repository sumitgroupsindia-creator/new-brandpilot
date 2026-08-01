import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
import { apiGetAssets } from '../../lib/api';

export function HistoryPage() {
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: apiGetAssets });
  const assets = assetsQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Generation Timeline"
        title="AI History"
        description="Track generated assets, status transitions, and credit usage in one place."
      />

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Generated Assets" subtitle="Latest job outcomes and output artifacts." />
        {assetsQuery.isLoading ? <LoadingState lines={4} /> : null}
        {assetsQuery.isError ? <ErrorState description="Failed to load history." /> : null}
        {!assetsQuery.isLoading && !assetsQuery.isError ? (
          assets.length ? (
            <div className="space-y-2">
              {assets.map(asset => (
                <article key={asset.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[var(--color-ink)]">{asset.title}</h3>
                      <p className="text-sm text-[var(--color-ink-muted)]">{asset.frameName} • {asset.kind}</p>
                    </div>
                    <Badge variant={asset.status === 'FAILED' ? 'error' : asset.status === 'SUCCEEDED' ? 'success' : 'warning'}>{asset.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-ink-subtle)]">{new Date(asset.createdAt).toLocaleString()} • {asset.creditsUsed} credits</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No generated assets" description="Once a generation completes, it will appear here." />
          )
        ) : null}
      </Card>
    </>
  );
}
