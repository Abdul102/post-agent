'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Plus, Power } from 'lucide-react';

const PLATFORMS = [
  { value: 'reddit', label: 'Reddit subreddit', placeholder: 'webdev (without r/)', help: 'Add subreddits where you are an active member and self-promo is allowed.' },
  { value: 'medium-pub', label: 'Medium publication', placeholder: 'better-programming', help: 'Slug of a Medium publication you write for.' },
  { value: 'hashnode-blog', label: 'Hashnode blog', placeholder: 'your-blog-host.hashnode.dev', help: 'Your Hashnode blog hostname.' },
];

export default function TargetsPage() {
  const [targets, setTargets] = useState<any[]>([]);
  const [platform, setPlatform] = useState('reddit');
  const [targetRef, setTargetRef] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/syndication-targets');
    const j = await r.json();
    setTargets(j.targets ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!targetRef.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/syndication-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          targetRef: targetRef.trim(),
          label: label.trim() || targetRef.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success('Target added');
      setTargetRef('');
      setLabel('');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t: any) {
    await fetch('/api/syndication-targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, enabled: !t.enabled }),
    });
    await load();
  }

  async function del(id: string) {
    if (!confirm('Delete this target?')) return;
    await fetch('/api/syndication-targets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  const grouped = targets.reduce<Record<string, any[]>>((acc, t) => {
    (acc[t.platform] ||= []).push(t);
    return acc;
  }, {});

  const activePlatform = PLATFORMS.find((p) => p.value === platform)!;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Syndication Targets</h1>
        <p className="text-sm text-gray-500">
          List of places (subreddits, publications, blogs) where the agent will post your content.
          You only post to targets you've explicitly added.
        </p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-medium">Add a target</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="label">Platform</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Target</label>
            <input
              className="input"
              placeholder={activePlatform.placeholder}
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Label (optional)</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-gray-500">{activePlatform.help}</p>
        <button onClick={add} disabled={busy} className="btn-primary">
          <Plus size={16} /> {busy ? 'Adding…' : 'Add target'}
        </button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card text-sm text-gray-500">No targets yet. Add some above.</div>
      ) : (
        Object.entries(grouped).map(([plat, list]) => (
          <div key={plat} className="card">
            <h3 className="font-medium mb-3 capitalize">{plat.replace('-', ' ')}</h3>
            <ul className="divide-y divide-gray-100">
              {list.map((t) => (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={'font-medium ' + (t.enabled ? '' : 'text-gray-400')}>
                      {t.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.platform === 'reddit' ? `r/${t.targetRef}` : t.targetRef}
                      {t.lastPostedAt && ` · last: ${new Date(t.lastPostedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={() => toggle(t)} title="Enable / disable">
                    <Power size={14} /> {t.enabled ? 'On' : 'Off'}
                  </button>
                  <button className="btn-danger" onClick={() => del(t.id)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
