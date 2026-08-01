import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
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
      <PageHeader
        eyebrow="Credits and Billing"
        title="Wallet"
        description="Track balance, recharge credits, and monitor ledger activity with clear status feedback."
      />

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Balance Overview" subtitle="Live credit balances from the wallet summary endpoint." />
        {summaryQuery.isLoading ? <LoadingState lines={1} /> : null}
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
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Recharge Plans" subtitle="Choose a plan and top up your credits." />
        {plansQuery.isLoading ? <LoadingState lines={3} /> : null}
        {plansQuery.isError ? <ErrorState description="Failed to load plans." /> : null}
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map(plan => (
            <article key={plan.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">INR {plan.amountInr}</p>
              <p className="text-xs text-slate-500">Credits: {plan.credits} + Bonus: {plan.bonus}</p>
              <Button className="mt-3" variant="secondary" size="sm" type="button" onClick={() => rechargeMutation.mutate(plan.id)}>
                Recharge
              </Button>
            </article>
          ))}
        </div>
        {rechargeMutation.isPending ? <p className="mt-3 text-sm text-slate-500">Processing recharge...</p> : null}
        {rechargeMutation.isError ? <ErrorState description="Recharge failed." /> : null}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Transactions" subtitle="Append-only ledger history." />
        {ledgerQuery.isLoading ? <LoadingState lines={4} /> : null}
        {ledgerQuery.isError ? <ErrorState description="Failed to load ledger." /> : null}
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
        {!ledgerQuery.isLoading && !txns.length ? <Badge variant="default">No transactions yet</Badge> : null}
      </Card>
    </>
  );
}
