'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Trash2,
  Copy,
  Eye,
  Send,
  FileCode,
  FileText as FileMd,
  Gauge,
} from 'lucide-react';
import { ConnectionStatus } from '@/components/ConnectionStatus';

const TONES = ['Friendly', 'Professional', 'Witty', 'Bold', 'Educational', 'Inspirational'];

type Blog = {
  id: string;
  seoTitle: string;
  metaTitle?: string | null;
  metaDescription: string;
  slug: string;
  contentMarkdown: string;
  keywords: string[];
  keywordClusters?: { label: string; keywords: string[] }[] | null;
  semanticKeywords?: string[];
  faqs?: { q: string; a: string }[] | null;
  internalLinks: string[];
  externalLinks?: string[];
  readabilityScore?: number | null;
  seoScore?: number | null;
  improvementSuggestions?: string[];
  viewCount?: number;
  createdAt: string;
};

export default function BlogsPage() {
  const [topic, setTopic] = useState('');
  const [keyword, setKeyword] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [posting, setPosting] = useState<string | null>(null);

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
        body: JSON.stringify({
          topic: topic || undefined,
          targetKeyword: keyword || undefined,
          targetAudience: audience || undefined,
          tone: tone || undefined,
          websiteUrl: websiteUrl || undefined,
        }),
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

  async function postToFacebook(id: string, all = false) {
    setPosting(id);
    try {
      const r = await fetch(`/api/blogs/${id}/to-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: !all, publishAll: all }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed');
      if (j.warning) toast(`Saved as draft: ${j.warning}`);
      else toast.success(all ? 'Published to all connected' : 'Published to Facebook');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPosting(null);
    }
  }

  function copyMarkdown(b: Blog) {
    void navigator.clipboard.writeText(b.contentMarkdown);
    toast.success('Markdown copied');
  }

  function exportHtml(b: Blog) {
    const html = mdToHtml(b);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${b.slug}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMd(b: Blog) {
    const blob = new Blob([b.contentMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${b.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">AI SEO Blog Writer</h1>
        <p className="text-sm text-gray-500">
          Keyword clusters, semantic SEO, FAQs, internal links, readability + SEO scores. One click.
        </p>
      </div>

      <ConnectionStatus />

      <div className="card space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Topic (optional)</label>
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <label className="label">Main keyword</label>
            <input
              className="input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. small business CRM"
            />
          </div>
          <div>
            <label className="label">Target audience</label>
            <input
              className="input"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. solo founders, US-based"
            />
          </div>
          <div>
            <label className="label">Tone</label>
            <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Website URL (for internal-link suggestions)</label>
            <input
              className="input"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
        <button onClick={generate} disabled={busy} className="btn-primary">
          <Sparkles size={16} /> {busy ? 'Drafting…' : 'Draft a blog'}
        </button>
      </div>

      <div className="space-y-3">
        {blogs.map((b) => (
          <div key={b.id} className="card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <button
                className="text-left flex-1 min-w-0"
                onClick={() => setOpenId(openId === b.id ? null : b.id)}
              >
                <div className="font-medium truncate">{b.seoTitle}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <span>{new Date(b.createdAt).toLocaleString()}</span>
                  {typeof b.viewCount === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      <Eye size={12} /> {b.viewCount} views
                    </span>
                  )}
                  {typeof b.seoScore === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      <Gauge size={12} /> SEO {b.seoScore}
                    </span>
                  )}
                  {typeof b.readabilityScore === 'number' && (
                    <span>Readability {b.readabilityScore}</span>
                  )}
                </div>
              </button>
              <div className="flex flex-wrap gap-1.5">
                <button className="btn-secondary" onClick={() => copyMarkdown(b)}>
                  <Copy size={14} /> Copy
                </button>
                <button className="btn-secondary" onClick={() => exportMd(b)}>
                  <FileMd size={14} /> .md
                </button>
                <button className="btn-secondary" onClick={() => exportHtml(b)}>
                  <FileCode size={14} /> .html
                </button>
                <button
                  className="btn-primary"
                  onClick={() => postToFacebook(b.id, false)}
                  disabled={posting === b.id}
                >
                  <Send size={14} /> {posting === b.id ? 'Posting…' : 'Post to Facebook'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => postToFacebook(b.id, true)}
                  disabled={posting === b.id}
                  title="Convert blog to a social post and publish to every connected account"
                >
                  Post to all
                </button>
                <button className="btn-danger" onClick={() => del(b.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {openId === b.id && (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Meta title: </span>
                  {b.metaTitle ?? b.seoTitle}
                </div>
                <div>
                  <span className="text-gray-500">Meta description: </span>
                  {b.metaDescription}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {b.keywords.map((k) => (
                    <span key={k} className="badge bg-gray-100 text-gray-700">{k}</span>
                  ))}
                </div>
                {b.keywordClusters && b.keywordClusters.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">Keyword clusters</h4>
                    {b.keywordClusters.map((c) => (
                      <div key={c.label} className="mb-1">
                        <span className="text-xs text-gray-500">{c.label}: </span>
                        {c.keywords.map((k, i) => (
                          <span key={i} className="badge bg-brand-50 text-brand-700 mr-1">{k}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {b.semanticKeywords && b.semanticKeywords.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">Semantic / LSI keywords</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {b.semanticKeywords.map((k) => (
                        <span key={k} className="badge bg-emerald-50 text-emerald-700">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {b.internalLinks?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">Internal link suggestions</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      {b.internalLinks.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                )}
                {b.externalLinks && b.externalLinks.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">External sources to cite</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      {b.externalLinks.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </div>
                )}
                {b.improvementSuggestions && b.improvementSuggestions.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <h4 className="font-medium text-amber-900 mb-1">Improvement suggestions</h4>
                    <ul className="list-disc pl-5 text-amber-900">
                      {b.improvementSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {b.faqs && b.faqs.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">FAQs</h4>
                    <div className="space-y-1.5">
                      {b.faqs.map((f, i) => (
                        <details key={i} className="rounded-lg border border-gray-200 p-2">
                          <summary className="font-medium cursor-pointer">{f.q}</summary>
                          <p className="mt-1 text-gray-700">{f.a}</p>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-medium mb-1">Content</h4>
                  <pre className="whitespace-pre-wrap bg-gray-50 rounded-lg p-3 text-xs">
                    {b.contentMarkdown}
                  </pre>
                </div>
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

function mdToHtml(b: Blog): string {
  // Minimal Markdown → HTML conversion sufficient for export.
  // Users can refine in their editor / CMS.
  let html = b.contentMarkdown
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n{2,}/g, '</p><p>');
  html = `<p>${html}</p>`;
  const faqsHtml = b.faqs?.length
    ? `<h2>FAQs</h2>` +
      b.faqs.map((f) => `<h3>${escape(f.q)}</h3><p>${escape(f.a)}</p>`).join('')
    : '';
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${escape(b.metaTitle ?? b.seoTitle)}</title>
<meta name="description" content="${escape(b.metaDescription)}" />
</head>
<body>
<article>
<h1>${escape(b.seoTitle)}</h1>
${html}
${faqsHtml}
</article>
</body></html>`;
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
