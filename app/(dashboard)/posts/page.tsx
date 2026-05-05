'use client';

import { useEffect, useState } from 'react';
import { PostCard } from '@/components/PostCard';
import toast from 'react-hot-toast';

const FILTERS = ['ALL', 'DRAFT', 'AWAITING_APPROVAL', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as const;

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const url = filter === 'ALL' ? '/api/posts?take=100' : `/api/posts?status=${filter}&take=100`;
    const r = await fetch(url);
    const j = await r.json();
    setPosts(j.posts ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function del(id: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    await load();
  }
  async function approve(id: string) {
    const r = await fetch(`/api/posts/${id}/publish`, { method: 'POST' });
    const j = await r.json();
    if (!r.ok) toast.error(j.error ?? 'Publish failed');
    else toast.success('Published');
    await load();
  }
  async function publishAll(id: string) {
    const r = await fetch(`/api/posts/${id}/publish-multi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const j = await r.json();
    if (!r.ok) toast.error(j.error ?? 'Publish failed');
    else {
      const ok = (j.results ?? []).filter((x: any) => x.ok).length;
      const total = (j.results ?? []).length;
      toast.success(`Published ${ok}/${total}`);
    }
    await load();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Post History</h1>
        <p className="text-sm text-gray-500">Every post you've generated.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              'btn-secondary ' + (filter === f ? '!bg-brand-600 !text-white !border-brand-600' : '')
            }
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="card text-sm text-gray-500">Nothing here yet.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onApprove={approve} onPublishAll={publishAll} onDelete={del} />
          ))}
        </div>
      )}
    </div>
  );
}
