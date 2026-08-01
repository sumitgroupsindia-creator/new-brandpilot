import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetAudit } from '../lib/api';

export function AuditPage() {
  const auditQuery = useQuery({ queryKey: ['admin-audit'], queryFn: adminGetAudit });
  const auditRows = auditQuery.data ?? [];

  return (
    <PagePanel title="Audit Logs" subtitle="Immutable admin mutation history.">
      {auditQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading audit log...</p> : null}
      {auditQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load audit log.</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map(row => (
              <tr key={`${row.action}-${row.when}`} className="border-t border-slate-200">
                <td className="px-3 py-2">{row.action}</td>
                <td className="px-3 py-2">{row.actor}</td>
                <td className="px-3 py-2">{row.entity}</td>
                <td className="px-3 py-2">{row.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PagePanel>
  );
}
