import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../../hooks/useAuth';
import { Button } from '@brandpilot/shared';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await register.mutateAsync({ name, email, password });
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
                Create your workspace and launch with confidence.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-white/80">
                Set up your profile in minutes and start shaping polished brand experiences for your next release.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold">What you get</p>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li>• Guided onboarding for modern teams</li>
                <li>• Structured asset generation and review</li>
                <li>• Beautiful dashboards built for speed</li>
              </ul>
            </div>
          </div>

          <div className="auth-form">
            <p className="auth-eyebrow">Create account</p>
            <h2 className="auth-title">Create your workspace</h2>
            <p className="auth-subtitle">Set up your branding profile and start generating.</p>

            <form className="mt-6 space-y-3" onSubmit={onSubmit}>
              <input className="field" type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
              <input className="field" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              <input className="field" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              <Button className="w-full rounded-[16px]" type="submit" loading={register.isPending}>
                {register.isPending ? 'Creating...' : 'Create account'}
              </Button>
            </form>

            {register.isError ? (
              <p className="mt-3 text-sm text-rose-700">Registration failed. Please verify input and tenant slug.</p>
            ) : null}

            <p className="mt-6 text-sm text-slate-600">
              Already have an account? <Link className="font-semibold text-teal-700 underline" to="/auth/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
