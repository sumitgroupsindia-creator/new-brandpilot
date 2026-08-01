import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <p className="auth-eyebrow">404</p>
        <h1 className="auth-title">Page not found</h1>
        <p className="auth-subtitle">The route does not exist yet in this environment.</p>
        <Link className="btn-primary inline-flex" to="/app/home">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
