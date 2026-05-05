'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Trash2, Copy } from 'lucide-react';

export default function BlogsPage() {
  const [topic, setTopic] = useState('');
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/blogs');
    const j = await r.json();
    setBlogs(j.blogs ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const r = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic || undefined, targetKeyword: keyword || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('Blog drafted');
      setTopic('');
      setKeyword('');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this blog?')) return;
    await fetch(`/api/blogs/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Blog Generator</h1>
        <p className="text-sm text-gray-500">SEO-optimized drafts in one click.</p>
      </div>
      <div className="card space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Topic (optional)</label>
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <label className="label">Primary keyword (optional)</label>
            <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
        </div>
        <button onClick={generate} disabled={busy} className="btn-primary">
          <Sparkles size={16} /> {busy ? 'Drafting…' : 'Draft a blog'}
        </button>
      </div>

      <div className="space-y-3">
        {blogs.map((b) => (
          <div key={b.id} className="card">
            <div className="flex items-center justify-between gap-3">
              <button
                className="text-left flex-1"
                onClick={() => setOpenId(openId === b.id ? null : b.id)}
              >
                <div className="font-medium">{b.seoTitle}</div>
                <div className="text-xs text-gray-500">{new Date(b.createdAt).toLocaleString()}</div>
              </button>
              <button
                className="btn-secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(b.contentMarkdown);
                  toast.success('Markdown copied');
                }}
              >
                <Copy size={14} /> Copy
              </button>
              <button className="btn-danger" onClick={() => del(b.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            {openId === b.id && (
              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Meta description: </span>
                  {b.metaDescription}
                </div>
                <div>
                  <span className="text-gray-500">Keywords: </span>
                  {b.keywords.join(', ')}
                </div>
                <pre className="whitespace-pre-wrap bg-gray-50 rounded-lg p-3 text-xs">
                  {b.contentMarkdown}
                </pre>
              </div>
            )}
          </div>
        ))}
        {blogs.length === 0 && (
          <div className="card text-sm text-gray-500">No blogs yet.</div>
        )}
      </div>
    </div>
  );
}
