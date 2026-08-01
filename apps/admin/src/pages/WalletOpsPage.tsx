import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetWalletOps } from '../lib/api';

export function WalletOpsPage() {
  const walletOpsQuery = useQuery({ queryKey: ['admin-wallet-ops'], queryFn: adminGetWalletOps });
  const walletOps = walletOpsQuery.data ?? [];

  return (
    <PagePanel title="Wallet Operations" subtitle="Manual credit adjustments, bonuses, and refunds.">
      {walletOpsQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading wallet operations...</p> : null}
      {walletOpsQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load wallet operations.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <input className="field" placeholder="User email" />
        <select className="field"><option>Operation type</option></select>
        <input className="field" placeholder="Amount" />
        <input className="field" placeholder="Reason" />
        <button className="btn-dark md:col-span-2" type="button">Submit audited action</button>
      </div>
      <div className="mt-4 space-y-2">
        {walletOps.map(op => (
          <article key={op.id} className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">{op.userEmail} • {op.type} • {op.amount}</p>
            <p className="text-xs text-slate-600">{op.reason} • {op.when}</p>
          </article>
        ))}
      </div>
    </PagePanel>
  );
}
