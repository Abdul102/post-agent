'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  Globe,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Save,
  X,
} from 'lucide-react';

type Insight = {
  id: string;
  commonTopics: string[];
  postingFrequency: string | null;
  contentGaps: string[];
  contentIdeas: string[];
  recommendedTopics: string[];
  summary: string | null;
  generatedAt: string;
};

type Competitor = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  notes?: string | null;
  insights: Insight[];
};

const EMPTY: Partial<Competitor> = {
  name: '',
  websiteUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  notes: '',
};

export default function CompetitorsPage() {
  const [list, setList] = useState<Competitor[] | null>(null);
  const [editing, setEditing] = useState<Partial<Competitor> | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/competitors');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Load failed');
      setList(j.competitors ?? []);
    } catch (e: any) {
      toast.error(e.message);
      setList([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing?.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    setBusy(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? '/api/competitors' : `/api/competitors/${editing.id}`;
      const r = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          websiteUrl: editing.websiteUrl || null,
          linkedinUrl: editing.linkedinUrl || null,
          twitterUrl: editing.twitterUrl || null,
          instagramUrl: editing.instagramUrl || null,
          facebookUrl: editing.facebookUrl || null,
          notes: editing.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      toast.success(isNew ? 'Competitor added' : 'Competitor updated');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this competitor and all insights?')) return;
    await fetch(`/api/competitors/${id}`, { method: 'DELETE' });
    await load();
  }

  async function generateInsights(id: string) {
    setGeneratingFor(id);
    const tid = toast.loading('Generating AI insights…');
    try {
      const r = await fetch(`/api/competitors/${id}/insights`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Generate failed');
      toast.success('Insights ready', { id: tid });
      await load();
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setGeneratingFor(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Competitor Tracking</h1>
          <p className="text-sm text-gray-500">
            Track competitors and let AI suggest content gaps + post topics that win.
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
          <Plus size={16} /> Add competitor
        </button>
      </div>

      {list === null ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-500 mb-3">No competitors yet.</p>
          <button onClick={() => setEditing({ ...EMPTY })} className="btn-primary">
            <Plus size={14} /> Add your first competitor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const latest = c.insights?.[0];
            return (
              <div key={c.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base">{c.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
                      {c.websiteUrl && (
                        <a className="text-brand-700 hover:underline inline-flex items-center gap-1" href={c.websiteUrl} target="_blank" rel="noreferrer">
                          <Globe size={12} /> Website
                        </a>
                      )}
                      {c.linkedinUrl && (
                        <a className="text-brand-700 hover:underline inline-flex items-center gap-1" href={c.linkedinUrl} target="_blank" rel="noreferrer">
                          <Linkedin size={12} /> LinkedIn
                        </a>
                      )}
                      {c.twitterUrl && (
                        <a className="text-brand-700 hover:underline inline-flex items-center gap-1" href={c.twitterUrl} target="_blank" rel="noreferrer">
                          <Twitter size={12} /> X
                        </a>
                      )}
                      {c.instagramUrl && (
                        <a className="text-brand-700 hover:underline inline-flex items-center gap-1" href={c.instagramUrl} target="_blank" rel="noreferrer">
                          <Instagram size={12} /> Instagram
                        </a>
                      )}
                      {c.facebookUrl && (
                        <a className="text-brand-700 hover:underline inline-flex items-center gap-1" href={c.facebookUrl} target="_blank" rel="noreferrer">
                          <Facebook size={12} /> Facebook
                        </a>
                      )}
                    </div>
                    {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="btn-primary"
                      onClick={() => generateInsights(c.id)}
                      disabled={generatingFor === c.id}
                    >
                      <Sparkles size={14} />
                      {generatingFor === c.id ? 'Generating…' : 'Generate AI insights'}
                    </button>
                    <button className="btn-secondary" onClick={() => setEditing(c)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn-danger" onClick={() => del(c.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {latest && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2 text-sm">
                    {latest.summary && <p className="italic text-gray-700">{latest.summary}</p>}
                    {latest.postingFrequency && (
                      <div>
                        <span className="text-gray-500">Posting frequency: </span>
                        {latest.postingFrequency}
                      </div>
                    )}
                    {latest.commonTopics?.length > 0 && (
                      <ChipRow title="Common topics" items={latest.commonTopics} color="bg-gray-100 text-gray-700" />
                    )}
                    {latest.contentGaps?.length > 0 && (
                      <ChipRow title="Content gaps (your opportunity)" items={latest.contentGaps} color="bg-emerald-50 text-emerald-700" />
                    )}
                    {latest.recommendedTopics?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-xs text-gray-600 mb-1">Recommended post topics</h4>
                        <ul className="list-disc pl-5 text-gray-700 text-sm">
                          {latest.recommendedTopics.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {latest.contentIdeas?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-xs text-gray-600 mb-1">Content ideas</h4>
                        <ul className="list-disc pl-5 text-gray-700 text-sm">
                          {latest.contentIdeas.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 pt-1">
                      Generated {new Date(latest.generatedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => setEditing(null)}
        >
          <div className="card w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing.id ? 'Edit competitor' : 'Add competitor'}
              </h2>
              <button onClick={() => setEditing(null)} className="text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Name *" v={editing.name ?? ''} on={(v) => setEditing({ ...editing, name: v })} />
              <Field label="Website URL" v={editing.websiteUrl ?? ''} on={(v) => setEditing({ ...editing, websiteUrl: v })} />
              <Field label="LinkedIn URL" v={editing.linkedinUrl ?? ''} on={(v) => setEditing({ ...editing, linkedinUrl: v })} />
              <Field label="X / Twitter URL" v={editing.twitterUrl ?? ''} on={(v) => setEditing({ ...editing, twitterUrl: v })} />
              <Field label="Instagram URL" v={editing.instagramUrl ?? ''} on={(v) => setEditing({ ...editing, instagramUrl: v })} />
              <Field label="Facebook URL" v={editing.facebookUrl ?? ''} on={(v) => setEditing({ ...editing, facebookUrl: v })} />
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input min-h-[80px]"
                  value={editing.notes ?? ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={save} disabled={busy} className="btn-primary">
                <Save size={14} /> {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary ml-auto">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function ChipRow({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <h4 className="font-medium text-xs text-gray-600 mb-1">{title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span key={i} className={`badge ${color}`}>{t}</span>
        ))}
      </div>
    </div>
  );
}
