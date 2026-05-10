'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Plus } from 'lucide-react';

type AccountRow = { id: string; platform: string; name: string };

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'instagram', label: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { key: 'reddit', label: 'Reddit', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'devto', label: 'Dev.to', color: 'bg-gray-50 text-gray-800 border-gray-200' },
] as const;

/**
 * Reusable banner shown above publish flows so users can see at-a-glance which
 * platforms are connected and quickly jump to /social-accounts to fix the
 * missing ones.
 */
export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);

  useEffect(() => {
    fetch('/api/social-accounts')
      .then((r) => r.json())
      .then((j) => setAccounts(j.accounts ?? []))
      .catch(() => setAccounts([]));
  }, []);

  if (accounts === null) {
    return <div className="text-xs text-gray-400">Checking connections…</div>;
  }

  const byPlatform = new Set(accounts.map((a) => a.platform));
  const anyMissing = PLATFORMS.some((p) => !byPlatform.has(p.key));

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'card flex flex-wrap items-center gap-3'}>
      {!compact && <span className="text-sm font-medium text-gray-700">Connected accounts:</span>}
      {PLATFORMS.map((p) => {
        const connected = byPlatform.has(p.key);
        return (
          <span
            key={p.key}
            className={
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ' +
              (connected ? p.color : 'bg-gray-50 text-gray-500 border-gray-200')
            }
            title={connected ? `${p.label} connected` : `${p.label} not connected`}
          >
            {connected ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {p.label}
            <span className="ml-0.5 font-medium">{connected ? 'Connected' : 'Not connected'}</span>
          </span>
        );
      })}
      {anyMissing && (
        <Link
          href="/social-accounts"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline ml-auto"
        >
          <Plus size={12} /> Connect accounts
        </Link>
      )}
    </div>
  );
}
