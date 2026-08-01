import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetPlans } from '../lib/api';

export function PlansPage() {
  const plansQuery = useQuery({ queryKey: ['admin-plans'], queryFn: adminGetPlans });
  const plans = plansQuery.data ?? [];

  return (
    <PagePanel title="Recharge Plans" subtitle="Configure amount to credit mappings.">
      {plansQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading plans...</p> : null}
      {plansQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load plans.</p> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <input className="field" placeholder="Amount INR" />
        <input className="field" placeholder="Credits" />
        <input className="field" placeholder="Bonus" />
        <button className="btn-dark" type="button">Add plan</button>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Credits</th>
              <th className="px-3 py-2">Bonus</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(plan => (
              <tr key={plan.id} className="border-t border-slate-200">
                <td className="px-3 py-2">INR {plan.amountInr}</td>
                <td className="px-3 py-2">{plan.credits}</td>
                <td className="px-3 py-2">{plan.bonus}</td>
                <td className="px-3 py-2">{plan.active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PagePanel>
  );
}
