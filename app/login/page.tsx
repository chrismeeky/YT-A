'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await signIn(email, password);
    if (err) { setError(err); setBusy(false); }
    else router.replace('/');
  };

  if (loading) return null;

  return (
    <div
      className="w-full max-w-sm rounded-2xl border p-8 space-y-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
        <div className="text-center space-y-1">
          <div className="text-3xl mb-3">▶</div>
          <h1 className="text-xl font-semibold">ReelIQ</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sign in to your account</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg px-4 py-2.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg px-4 py-2.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-sm font-medium transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
    </div>
  );
}
