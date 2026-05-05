'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Facebook, Hash, Globe } from 'lucide-react';

const PLATFORM_INFO: Record<string, { label: string; color: string }> = {
  facebook: { label: 'Facebook Page', color: 'bg-blue-100 text-blue-700' },
  instagram: { label: 'Instagram', color: 'bg-pink-100 text-pink-700' },
  reddit: { label: 'Reddit', color: 'bg-orange-100 text-orange-700' },
  devto: { label: 'Dev.to', color: 'bg-gray-100 text-gray-800' },
  threads: { label: 'Threads', color: 'bg-purple-100 text-purple-700' },
};

export default function SocialAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [devtoKey, setDevtoKey] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/social-accounts');
    const j = await r.json();
    setAccounts(j.accounts ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function disconnect(id: string) {
    if (!confirm('Disconnect this account?')) return;
    const r = await fetch('/api/social-accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (r.ok) {
      toast.success('Disconnected');
      await load();
    }
  }

  async function connectDevto() {
    if (!devtoKey.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/social-accounts/devto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: devtoKey.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('Dev.to connected');
      setDevtoKey('');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Social Accounts</h1>
        <p className="text-sm text-gray-500">
          Connect each platform once. We never see your password.
        </p>
      </div>

      {/* ── Meta (Facebook + Instagram) ──────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Facebook size={20} className="text-blue-600" />
          <h2 className="font-medium">Facebook & Instagram</h2>
        </div>
        <p className="text-sm text-gray-600">
          You'll be redirected to Facebook to choose which Pages and Instagram Business accounts
          to grant access to. We only publish to accounts you explicitly select.
        </p>
        <a className="btn-primary" href="/api/social-accounts/meta/start">
          Connect Facebook & Instagram
        </a>
      </div>

      {/* ── Reddit ────────────────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Hash size={20} className="text-orange-600" />
          <h2 className="font-medium">Reddit</h2>
        </div>
        <p className="text-sm text-gray-600">
          Connect your Reddit account, then add the subreddits where you want to post in{' '}
          <a className="text-brand-700" href="/targets">Syndication Targets</a>. We post link
          posts pointing to your website. Subreddit rules vary — only add ones that allow self-promo.
        </p>
        <a className="btn-primary" href="/api/social-accounts/reddit/start">
          Connect Reddit
        </a>
        <p className="text-xs text-gray-500">
          Requires <code>REDDIT_CLIENT_ID</code>, <code>REDDIT_CLIENT_SECRET</code>, and{' '}
          <code>REDDIT_REDIRECT_URI</code> in your <code>.env</code>.{' '}
          <a className="text-brand-700" href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer">
            Create a Reddit app →
          </a>
        </p>
      </div>

      {/* ── Dev.to ────────────────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={20} className="text-gray-700" />
          <h2 className="font-medium">Dev.to</h2>
        </div>
        <p className="text-sm text-gray-600">
          Paste your Dev.to API key. We'll publish full-length articles directly to your profile,
          with the canonical URL pointing back to your website (great for SEO).
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Your Dev.to API key"
            className="input flex-1"
            value={devtoKey}
            onChange={(e) => setDevtoKey(e.target.value)}
          />
          <button className="btn-primary" disabled={busy || !devtoKey.trim()} onClick={connectDevto}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Get your key:{' '}
          <a
            className="text-brand-700"
            href="https://dev.to/settings/extensions"
            target="_blank"
            rel="noreferrer"
          >
            dev.to/settings/extensions →
          </a>
        </p>
      </div>

      {/* ── Connected accounts list ─────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-medium mb-3">Connected accounts</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="text-sm text-gray-500">No accounts connected yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {accounts.map((a) => {
              const info = PLATFORM_INFO[a.platform] ?? { label: a.platform, color: 'bg-gray-100 text-gray-700' };
              return (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  {a.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.pictureUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className={`badge ${info.color}`}>{info.label}</span>
                      {a.tokenExpiresAt && `expires ${new Date(a.tokenExpiresAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button className="btn-danger" onClick={() => disconnect(a.id)}>
                    <Trash2 size={14} /> Disconnect
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
