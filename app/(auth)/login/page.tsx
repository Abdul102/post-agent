'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await signIn('credentials', { redirect: false, email, password });
    setLoading(false);
    if (r?.error) toast.error('Invalid email or password');
    else router.push('/dashboard');
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="w-full max-w-md card">
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Welcome back to NextGen Growth Agent</p>
        <form onSubmit={onSubmit} className="space-y-4">
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-4">
          New here? <Link className="text-brand-700" href="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
