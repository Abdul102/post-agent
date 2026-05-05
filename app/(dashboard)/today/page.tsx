'use client';

import { useEffect, useMemo, useState } from 'react';
import { PostCard } from '@/components/PostCard';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';

export default function TodayPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/posts?take=30');
    const j = await r.json();
    setPosts(j.posts ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const todays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return posts.filter((p) => new Date(p.createdAt) >= start);
  }, [posts]);

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch('/api/generate/post', { method: 'POST', body: '{}' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('Today’s post generated');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
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
    if (!r.ok) {
      toast.error(j.error ?? 'Publish failed');
    } else {
      const ok = (j.results ?? []).filter((x: any) => x.ok).length;
      const total = (j.results ?? []).length;
      toast.success(`Published ${ok}/${total}`);
    }
    await load();
  }

  async function del(id: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Today's Post</h1>
          <p className="text-sm text-gray-500">Posts created today, awaiting your review.</p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={generating}>
          <Sparkles size={16} /> {generating ? 'Generating…' : 'Generate today’s post'}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : todays.length === 0 ? (
        <div className="card text-sm text-gray-500">No posts today yet. Generate one above.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {todays.map((p) => (
            <PostCard key={p.id} post={p} onApprove={approve} onPublishAll={publishAll} onDelete={del} />
          ))}
        </div>
      )}
    </div>
  );
}
