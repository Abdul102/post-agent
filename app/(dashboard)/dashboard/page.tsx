'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, BarChart3, Eye, Heart, Users } from 'lucide-react';
import { ConnectionStatus } from '@/components/ConnectionStatus';

interface Counts {
  total: number;
  published: number;
  failed: number;
  scheduled: number;
  draft: number;
  awaiting: number;
  blogs: number;
}

interface Insights {
  totalImpressions: number;
  totalReach: number;
  totalEngagements: number;
  totalBlogViews: number;
}

interface TopBlog {
  id: string;
  seoTitle: string;
  slug: string;
  viewCount: number;
  seoScore: number | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [topBlogs, setTopBlogs] = useState<TopBlog[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((j) => {
        setCounts(j.counts);
        setInsights(j.insights ?? null);
        setTopBlogs(j.topBlogs ?? []);
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

      <ConnectionStatus />

      {/* Insights row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InsightCard
          icon={<Eye size={16} />}
          label="Blog views"
          value={insights?.totalBlogViews}
          tint="bg-emerald-50 text-emerald-700"
        />
        <InsightCard
          icon={<BarChart3 size={16} />}
          label="Post impressions"
          value={insights?.totalImpressions}
          tint="bg-blue-50 text-blue-700"
        />
        <InsightCard
          icon={<Users size={16} />}
          label="Reach"
          value={insights?.totalReach}
          tint="bg-purple-50 text-purple-700"
        />
        <InsightCard
          icon={<Heart size={16} />}
          label="Engagements"
          value={insights?.totalEngagements}
          tint="bg-pink-50 text-pink-700"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
            <div className="text-2xl font-semibold mt-1">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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
                    <div className="text-sm font-medium truncate">{p.title || p.hook}</div>
                    <div className="text-xs text-gray-500">
                      {p.topic ?? '—'} · {p.status}
                      {p.impressions ? ` · ${p.impressions} impressions` : ''}
                    </div>
                  </div>
                  <Link href={`/posts`} className="text-sm text-brand-700">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Top blogs (by views)</h2>
            <Link href="/blogs" className="text-sm text-brand-700">
              View all
            </Link>
          </div>
          {topBlogs.length === 0 ? (
            <div className="text-sm text-gray-500">
              No blogs yet. <Link href="/blogs" className="text-brand-700">Draft your first →</Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topBlogs.map((b) => (
                <li key={b.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{b.seoTitle}</div>
                    <div className="text-xs text-gray-500">
                      {b.viewCount} views
                      {b.seoScore != null ? ` · SEO ${b.seoScore}` : ''}
                    </div>
                  </div>
                  <a
                    href={`/blog/${b.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-700"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  tint: string;
}) {
  return (
    <div className="card">
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${tint}`}>
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold mt-2">{value ?? '—'}</div>
    </div>
  );
}
