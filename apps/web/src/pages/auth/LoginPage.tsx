import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuth';
import { Button } from '@brandpilot/shared';

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
    <div className="auth-wrap bg-[radial-gradient(circle_at_top_left,_rgba(255,122,24,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(95,104,234,0.18),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef3fb_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-35" />
      <div className="auth-card relative z-10">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="auth-visual relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,#ff5f2e,#f23686_56%,#5f68ea)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div>
                <p className="auth-eyebrow text-white/80">BrandPilot • Design Studio</p>
                <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
                  Welcome back to a premium creative workspace.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/82">
                  Resume the exact theme, workspace, and creative flow you last used. Your dashboard, studio, and history all come back in the same polished state.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <FeaturePill label="Theme saved" value="Auto restore" />
                <FeaturePill label="Creative flow" value="Studio ready" />
                <FeaturePill label="Output history" value="One place" />
              </div>

              <div className="rounded-[28px] border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Built for teams</p>
                <p className="mt-2 text-sm leading-7 text-white/82">
                  Fast sign-in, premium layouts, and consistent light or dark mode across devices.
                </p>
              </div>
            </div>
          </div>

          <div className="auth-form bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,255,0.92))]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-ink-subtle)] shadow-[var(--shadow-xs)]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#ff7a18]" />
              Secure sign in
            </div>

            <h2 className="auth-title text-[2.3rem]">Welcome back</h2>
            <p className="auth-subtitle max-w-md">Sign in to continue building branded assets with your saved preferences and workspace state.</p>

            <form className="mt-7 space-y-3" onSubmit={onSubmit}>
              <input className="field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              <input className="field" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <Button className="w-full rounded-[16px]" type="submit" loading={login.isPending}>
                {login.isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {login.isError ? (
              <p className="mt-3 text-sm text-rose-700">Login failed. Check credentials and tenant slug.</p>
            ) : null}

            <div className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>New here? Create your account.</span>
              <Link className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-4" to="/auth/register">
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function FeaturePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/18 bg-white/10 p-4 text-white shadow-[0_12px_30px_rgba(10,16,30,0.12)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
