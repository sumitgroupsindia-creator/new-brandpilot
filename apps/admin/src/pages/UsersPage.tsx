import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetUsers } from '../lib/api';

export function UsersPage() {
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: adminGetUsers });
  const users = usersQuery.data ?? [];

  return (
    <PagePanel title="User Management" subtitle="Create, suspend, restore, and inspect users.">
      {usersQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading users...</p> : null}
      {usersQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load users.</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <input className="field" placeholder="Search email/name" />
        <select className="field"><option>Status: All</option></select>
        <select className="field"><option>Role: All</option></select>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">{user.status}</td>
                <td className="px-3 py-2"><button className="btn-soft" type="button">Suspend</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PagePanel>
  );
}
