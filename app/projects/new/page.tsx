'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProject() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) { setError('Failed to create project'); setLoading(false); return; }
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch {
      setError('Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-lg mx-auto">
      <Link href="/" className="text-sm text-[#71717a] hover:text-white transition-colors flex items-center gap-1 mb-8">
        ← Back to Projects
      </Link>

      <h1 className="text-2xl font-semibold mb-1">New Project</h1>
      <p className="text-[#71717a] text-sm mb-8">Give your project a name — usually the niche or channel you want to model.</p>

      <form onSubmit={create} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Project Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg px-4 py-3 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            placeholder="e.g. Finance Channel, Tech Reviews, Fitness Niche…"
            maxLength={80}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? 'Creating…' : 'Create Project →'}
        </button>
      </form>
    </div>
  );
}
