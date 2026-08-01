import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminLogin } from '../hooks/useAdminAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAdminLogin();
  const [email, setEmail] = useState('admin@sumitgroups.com');
  const [password, setPassword] = useState('admin@sumit');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login.mutateAsync({ email, password });
    navigate('/dashboard');
  };

  return (
    <div className="admin-auth-wrap">
      <div className="admin-auth-card">
        <div className="rounded-[24px] bg-slate-950 p-4 text-white">
          <p className="admin-eyebrow text-slate-400">BrandPilot</p>
          <h1 className="mt-2 text-2xl font-semibold">Admin Sign In</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use privileged credentials to access the control plane.</p>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input className="field" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="field" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="btn-dark w-full" type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {login.isError ? <p className="mt-3 text-sm text-rose-700">Admin login failed.</p> : null}
        <p className="mt-4 text-sm text-slate-600">
          Back to app? <Link className="font-semibold underline" to="/dashboard">Open dashboard</Link>
        </p>
      </div>
    </div>
  );
}
