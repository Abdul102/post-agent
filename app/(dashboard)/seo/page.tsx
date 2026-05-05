'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';

export default function SeoPage() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SEO Suggestions</h1>
          <p className="text-sm text-gray-500">Daily ideas, never spammy.</p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={busy}>
          <Search size={16} /> {busy ? 'Generating…' : 'Generate today’s SEO bundle'}
        </button>
      </div>

      {items.map((it) => (
        <div key={it.id} className="card space-y-4">
          <div className="text-sm text-gray-500">For {new Date(it.forDate).toLocaleDateString()}</div>
          <Section title="Blog title ideas" items={it.blogTitles} />
          <Section title="Meta titles" items={it.metaTitles} />
          <Section title="Meta descriptions" items={it.metaDescriptions} />
          <Section title="Target keywords" items={it.keywords} chips />
          <Section title="Suggested directories (manual submission)" items={it.directories} />
          <Section title="Backlink outreach drafts (review before sending)" items={it.outreachMessages} pre />
          {Array.isArray(it.faqs) && it.faqs.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">FAQs</h3>
              <div className="space-y-2">
                {it.faqs.map((f: any, i: number) => (
                  <details key={i} className="rounded-lg border border-gray-200 p-3">
                    <summary className="font-medium cursor-pointer">{f.q}</summary>
                    <p className="mt-2 text-sm text-gray-700">{f.a}</p>
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

function Section({
  title,
  items,
  pre,
  chips,
}: {
  title: string;
  items: string[];
  pre?: boolean;
  chips?: boolean;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      {chips ? (
        <div className="flex flex-wrap gap-2">
          {items.map((k, i) => (
            <span key={i} className="badge bg-gray-100 text-gray-700">
              {k}
            </span>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((m, i) => (
            <li key={i} className={pre ? 'whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-3' : 'text-sm'}>
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
