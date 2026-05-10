'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, Sparkles, Copy, FileText } from 'lucide-react';

export default function SeoPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/seo');
    const j = await r.json();
    setItems(j.items ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const r = await fetch('/api/seo', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('SEO bundle generated');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function makeBlog(title: string) {
    setActionBusy(`blog:${title}`);
    const tid = toast.loading('Drafting blog…');
    try {
      const r = await fetch('/api/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: title }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('Blog drafted', { id: tid });
      router.push('/blogs');
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setActionBusy(null);
    }
  }

  async function makePost(topic: string) {
    setActionBusy(`post:${topic}`);
    const tid = toast.loading('Generating post…');
    try {
      const r = await fetch('/api/generate/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('Post generated — opening Create Post', { id: tid });
      router.push('/create-post');
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setActionBusy(null);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success('Copied');
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">SEO Suggestions</h1>
          <p className="text-sm text-gray-500">
            Daily ideas — click any item to turn it into a draft, no copy-paste required.
          </p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={busy}>
          <Search size={16} /> {busy ? 'Generating…' : "Generate today's bundle"}
        </button>
      </div>

      {items.map((it) => (
        <div key={it.id} className="card space-y-4">
          <div className="text-sm text-gray-500">For {new Date(it.forDate).toLocaleDateString()}</div>

          <ActionList
            title="Blog title ideas"
            items={it.blogTitles}
            renderActions={(title) => (
              <>
                <button
                  className="btn-primary"
                  onClick={() => makeBlog(title)}
                  disabled={actionBusy === `blog:${title}`}
                >
                  <FileText size={12} />{' '}
                  {actionBusy === `blog:${title}` ? 'Drafting…' : 'Draft blog'}
                </button>
                <button className="btn-secondary" onClick={() => copyText(title)}>
                  <Copy size={12} /> Copy
                </button>
              </>
            )}
          />

          <ActionList
            title="Meta titles"
            items={it.metaTitles}
            renderActions={(t) => (
              <button className="btn-secondary" onClick={() => copyText(t)}>
                <Copy size={12} /> Copy
              </button>
            )}
          />

          <ActionList
            title="Meta descriptions"
            items={it.metaDescriptions}
            pre
            renderActions={(t) => (
              <button className="btn-secondary" onClick={() => copyText(t)}>
                <Copy size={12} /> Copy
              </button>
            )}
          />

          {it.keywords?.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Target keywords</h3>
              <div className="flex flex-wrap gap-2">
                {it.keywords.map((k: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => makePost(k)}
                    title="Click to generate a social post about this keyword"
                    className="badge bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer"
                    disabled={actionBusy === `post:${k}`}
                  >
                    <Sparkles size={10} /> {k}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Click any keyword to generate a social post about it.
              </p>
            </div>
          )}

          <ActionList
            title="Suggested directories (manual submission)"
            items={it.directories}
            renderActions={(t) => (
              <button className="btn-secondary" onClick={() => copyText(t)}>
                <Copy size={12} /> Copy
              </button>
            )}
          />

          {it.outreachMessages?.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Backlink outreach drafts (review before sending)</h3>
              <div className="space-y-2">
                {it.outreachMessages.map((m: string, i: number) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap">
                    {m}
                    <div className="mt-2">
                      <button className="btn-secondary" onClick={() => copyText(m)}>
                        <Copy size={12} /> Copy message
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(it.faqs) && it.faqs.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">FAQs</h3>
              <div className="space-y-2">
                {it.faqs.map((f: any, i: number) => (
                  <details key={i} className="rounded-lg border border-gray-200 p-3">
                    <summary className="font-medium cursor-pointer">{f.q}</summary>
                    <p className="mt-2 text-sm text-gray-700">{f.a}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn-secondary"
                        onClick={() => copyText(`Q: ${f.q}\nA: ${f.a}`)}
                      >
                        <Copy size={12} /> Copy Q&amp;A
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => makeBlog(f.q)}
                        disabled={actionBusy === `blog:${f.q}`}
                      >
                        <FileText size={12} /> Turn into blog
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
          {it.notes && <p className="text-sm text-gray-700 italic">{it.notes}</p>}
        </div>
      ))}
      {items.length === 0 && <div className="card text-sm text-gray-500">No suggestions yet.</div>}
    </div>
  );
}

function ActionList({
  title,
  items,
  pre,
  renderActions,
}: {
  title: string;
  items: string[];
  pre?: boolean;
  renderActions: (item: string) => React.ReactNode;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((m, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white p-2"
          >
            <div
              className={
                'flex-1 ' +
                (pre ? 'whitespace-pre-wrap text-sm bg-gray-50 rounded p-2' : 'text-sm')
              }
            >
              {m}
            </div>
            <div className="flex flex-wrap gap-1">{renderActions(m)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
