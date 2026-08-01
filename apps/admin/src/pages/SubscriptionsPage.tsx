import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import {
  adminGetSubscriptionPlans,
  adminGetSubscriptions,
  adminUpsertSubscriptionPlan,
} from '../lib/api';

export function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ['admin-subscription-plans'], queryFn: adminGetSubscriptionPlans });
  const subscriptionsQuery = useQuery({ queryKey: ['admin-subscriptions'], queryFn: adminGetSubscriptions });

  const [name, setName] = useState('Premium Monthly');
  const [amountInr, setAmountInr] = useState('499');
  const [period, setPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [graceDays, setGraceDays] = useState('3');
  const [displayOrder, setDisplayOrder] = useState('1');

  const upsertPlanMutation = useMutation({
    mutationFn: adminUpsertSubscriptionPlan,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
    },
  });

  const onCreatePlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    upsertPlanMutation.mutate({
      name: name.trim(),
      amountInr: Number(amountInr),
      period,
      graceDays: Number(graceDays),
      displayOrder: Number(displayOrder),
      active: true,
      premiumFrames: true,
      monthlyCredits: 0,
      currency: 'INR',
    });
  };

  const plans = plansQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];

  return (
    <>
      <PagePanel title="Subscription Plans" subtitle="Create and manage premium plans.">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={onCreatePlan}>
          <input className="field" value={name} onChange={event => setName(event.target.value)} placeholder="Plan name" />
          <input className="field" value={amountInr} onChange={event => setAmountInr(event.target.value)} placeholder="Amount INR" />
          <select className="field" value={period} onChange={event => setPeriod(event.target.value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')}>
            <option value="MONTHLY">MONTHLY</option>
            <option value="QUARTERLY">QUARTERLY</option>
            <option value="YEARLY">YEARLY</option>
          </select>
          <input className="field" value={graceDays} onChange={event => setGraceDays(event.target.value)} placeholder="Grace days" />
          <input className="field" value={displayOrder} onChange={event => setDisplayOrder(event.target.value)} placeholder="Order" />
          <button className="btn-dark md:col-span-5" type="submit" disabled={upsertPlanMutation.isPending}>
            {upsertPlanMutation.isPending ? 'Saving...' : 'Save subscription plan'}
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Grace</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{plan.name}</td>
                  <td className="px-3 py-2">INR {plan.amountInr}</td>
                  <td className="px-3 py-2">{plan.period}</td>
                  <td className="px-3 py-2">{plan.graceDays} days</td>
                  <td className="px-3 py-2">{plan.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PagePanel>

      <PagePanel title="Active Subscriptions" subtitle="Track customer premium access.">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Period End</th>
                <th className="px-3 py-2">Cancel At End</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(subscription => (
                <tr key={subscription.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{subscription.userEmail}</td>
                  <td className="px-3 py-2">{subscription.planName}</td>
                  <td className="px-3 py-2">{subscription.status}</td>
                  <td className="px-3 py-2">
                    {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-3 py-2">{subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PagePanel>
    </>
  );
}
