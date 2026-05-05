'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? 'Could not register');
      setLoading(false);
      return;
    }
    await signIn('credentials', { redirect: false, email, password });
    setLoading(false);
    router.push('/settings?welcome=1');
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="w-full max-w-md card">
        <h1 className="text-2xl font-semibold mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 mb-6">Start growing your business today</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <Link className="text-brand-700" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
