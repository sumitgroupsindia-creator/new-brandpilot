import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="admin-auth-wrap">
      <div className="admin-auth-card">
        <p className="admin-eyebrow">404</p>
        <h1 className="text-2xl font-semibold">Route not found</h1>
        <p className="mt-1 text-sm text-slate-600">The admin route is missing or not configured.</p>
        <Link className="btn-dark mt-4 inline-flex" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
