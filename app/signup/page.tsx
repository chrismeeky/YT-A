'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function SignupPage() {
  const { user, loading, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    setError('');
    const err = await signUp(email, password);
    if (err) {
      setError(err);
      setBusy(false);
    } else {
      setSuccess(true);
    }
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    setError('');
    const err = await signInWithGoogle();
    if (err) { setError(err); setGoogleBusy(false); }
  };

  if (loading) return null;

  if (success) {
    return (
      <div
        className="w-full max-w-sm rounded-2xl border p-6 sm:p-8 space-y-4 text-center mx-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="text-4xl">📬</div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
        </p>
        <Link
          href="/login"
          className="inline-block w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors text-center"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-sm rounded-2xl border p-6 sm:p-8 space-y-6 mx-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="text-center space-y-1">
        <div className="text-3xl mb-3">▶</div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Start analyzing channels and scripting videos</p>
      </div>

      {/* Google */}
      <button
        onClick={handleGoogle}
        disabled={googleBusy || busy}
        className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:border-[#444] disabled:opacity-40"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {googleBusy ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--text-3)' }}>or</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
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
            placeholder="Min. 6 characters"
            className="w-full rounded-lg px-4 py-2.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
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
          disabled={busy || googleBusy}
          className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-sm font-medium transition-colors"
        >
          {busy ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm" style={{ color: 'var(--text-3)' }}>
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
