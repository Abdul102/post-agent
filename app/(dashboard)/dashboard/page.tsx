'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface Counts {
  total: number;
  published: number;
  failed: number;
  scheduled: number;
  draft: number;
  awaiting: number;
  blogs: number;
}

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((j) => {
        setCounts(j.counts);
        setRecent(j.recentPosts ?? []);
      })
      .catch(() => {});
  }, []);

  const stats = [
    { label: 'Generated posts', v: counts?.total ?? '—' },
    { label: 'Published', v: counts?.published ?? '—' },
    { label: 'Awaiting approval', v: counts?.awaiting ?? '—' },
    { label: 'Scheduled', v: counts?.scheduled ?? '—' },
    { label: 'Failed', v: counts?.failed ?? '—' },
    { label: 'Blogs', v: counts?.blogs ?? '—' },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">Your daily growth at a glance.</p>
        </div>
        <Link className="btn-primary" href="/create-post">
          <Sparkles size={16} /> Generate post
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Recent posts</h2>
          <Link href="/posts" className="text-sm text-brand-700">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-sm text-gray-500">
            No posts yet. <Link href="/create-post" className="text-brand-700">Generate your first one →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map((p) => (
              <li key={p.id} className="py-3 flex items-center gap-3">
                {p.image?.finalUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image.finalUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.hook}</div>
                  <div className="text-xs text-gray-500">{p.topic ?? '—'} · {p.status}</div>
                </div>
                <Link href={`/posts`} className="text-sm text-brand-700">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
