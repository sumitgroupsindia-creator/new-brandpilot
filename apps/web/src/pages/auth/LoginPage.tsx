import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('admin@brandpilot.app');
  const [password, setPassword] = useState('BrandPilot#Admin2026');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login.mutateAsync({ email, password, deviceName: 'web-browser' });
    navigate('/app/home');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="auth-visual">
            <div>
              <p className="auth-eyebrow text-white/80">BrandPilot</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome back to your premium creative workspace.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-white/80">
                Jump back into generation, review performance, and keep every release aligned with your brand.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold">Why teams love it</p>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li>• Instant access to polished campaign templates</li>
                <li>• Smart production workflows with clear status</li>
                <li>• Built for fast-moving creative teams</li>
              </ul>
            </div>
          </div>

          <div className="auth-form">
            <p className="auth-eyebrow">Secure sign in</p>
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-subtitle">Sign in to continue building branded assets.</p>

            <form className="mt-6 space-y-3" onSubmit={onSubmit}>
              <input className="field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              <input className="field" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <button className="btn-primary w-full" type="submit" disabled={login.isPending}>
                {login.isPending ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {login.isError ? (
              <p className="mt-3 text-sm text-rose-700">Login failed. Check credentials and tenant slug.</p>
            ) : null}

            <p className="mt-6 text-sm text-slate-600">
              New here? <Link className="font-semibold text-teal-700 underline" to="/auth/register">Create account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
