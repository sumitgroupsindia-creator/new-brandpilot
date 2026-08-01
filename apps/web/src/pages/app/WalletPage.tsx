import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShellCard } from '../../components/ShellCard';
import {
  apiConfirmRechargeOrder,
  apiCreateRechargeOrder,
  apiGetWalletLedger,
  apiGetWalletPlans,
  apiGetWalletSummary,
} from '../../lib/api';

export function WalletPage() {
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({ queryKey: ['wallet-summary'], queryFn: apiGetWalletSummary });
  const ledgerQuery = useQuery({ queryKey: ['wallet-ledger'], queryFn: apiGetWalletLedger });
  const plansQuery = useQuery({ queryKey: ['wallet-plans'], queryFn: apiGetWalletPlans });

  const rechargeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const order = await apiCreateRechargeOrder(planId);
      return apiConfirmRechargeOrder({
        orderId: order.orderId,
        paymentId: `pay_${Date.now()}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-ledger'] });
    },
  });

  const summary = summaryQuery.data;
  const txns = ledgerQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  return (
    <>
      <ShellCard title="Wallet" subtitle="Credit balance and top-up plans.">
        {summaryQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading wallet...</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-teal-700">Available</p>
            <p className="mt-1 text-2xl font-semibold text-teal-900">{summary?.available ?? 0}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-700">Held</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{summary?.held ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">Low Balance Threshold</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{summary?.lowBalanceThreshold ?? 0}</p>
          </div>
        </div>
      </ShellCard>

      <ShellCard title="Recharge Plans" subtitle="Choose a plan and top up your credits.">
        {plansQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading plans...</p> : null}
        {plansQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load plans.</p> : null}
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map(plan => (
            <article key={plan.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">INR {plan.amountInr}</p>
              <p className="text-xs text-slate-500">Credits: {plan.credits} + Bonus: {plan.bonus}</p>
              <button
                className="btn-soft mt-3"
                type="button"
                onClick={() => rechargeMutation.mutate(plan.id)}
              >
                Recharge
              </button>
            </article>
          ))}
        </div>
        {rechargeMutation.isPending ? <p className="mt-3 text-sm text-slate-500">Processing recharge...</p> : null}
        {rechargeMutation.isError ? <p className="mt-3 text-sm text-rose-700">Recharge failed.</p> : null}
      </ShellCard>

      <ShellCard title="Transactions" subtitle="Append-only ledger history.">
        {ledgerQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading ledger...</p> : null}
        {ledgerQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load ledger.</p> : null}
        <div className="space-y-2">
          {txns.map(txn => (
            <div key={txn.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium">{txn.summary}</p>
                <p className="text-xs text-slate-500">{new Date(txn.createdAt).toLocaleString()}</p>
              </div>
              <p className={`font-semibold ${txn.amount < 0 ? 'text-rose-700' : 'text-teal-700'}`}>
                {txn.amount > 0 ? `+${txn.amount}` : txn.amount}
              </p>
            </div>
          ))}
        </div>
      </ShellCard>
    </>
  );
}
