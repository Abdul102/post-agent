'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Upload } from 'lucide-react';

const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
const TONES = ['Friendly', 'Professional', 'Witty', 'Bold', 'Educational', 'Inspirational'];

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<any>({
    websiteUrl: '',
    businessName: '',
    services: '',
    targetAudience: '',
    brandTone: 'Professional',
    keywords: [] as string[],
    logoUrl: '',
    logoPosition: 'bottom-right',
    defaultPostTime: '09:00',
    autoPublish: false,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetch('/api/business-profile')
      .then((r) => r.json())
      .then((j) => {
        if (j.profile) setProfile({ ...profile, ...j.profile });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(analyzeWebsite = false) {
    if (analyzeWebsite) setAnalyzing(true);
    else setSaving(true);
    try {
      const r = await fetch('/api/business-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, analyzeWebsite }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setProfile(j.profile);
      toast.success(analyzeWebsite ? 'Saved & analyzed' : 'Saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
      setAnalyzing(false);
    }
  }

  async function uploadLogo(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) {
      toast.error(j.error ?? 'Upload failed');
      return;
    }
    setProfile({ ...profile, logoUrl: j.url });
    toast.success('Logo uploaded');
  }

  function addKeyword() {
    const k = keywordInput.trim();
    if (!k) return;
    if (profile.keywords.includes(k)) return;
    setProfile({ ...profile, keywords: [...profile.keywords, k] });
    setKeywordInput('');
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500">Configure your business profile and posting preferences.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-medium">Business profile</h2>
        <div>
          <label className="label">Website URL</label>
          <input
            className="input"
            value={profile.websiteUrl}
            onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              value={profile.businessName}
              onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Brand tone</label>
            <select
              className="input"
              value={profile.brandTone}
              onChange={(e) => setProfile({ ...profile, brandTone: e.target.value })}
            >
              {TONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Services / what you sell</label>
          <textarea
            className="input min-h-[80px]"
            value={profile.services}
            onChange={(e) => setProfile({ ...profile, services: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Target audience</label>
          <textarea
            className="input min-h-[80px]"
            value={profile.targetAudience}
            onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Target keywords</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              placeholder="add keyword and press Enter"
            />
            <button type="button" className="btn-secondary" onClick={addKeyword}>
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {profile.keywords.map((k: string) => (
              <span key={k} className="badge bg-gray-100 text-gray-700">
                {k}
                <button
                  className="ml-2 text-gray-500"
                  onClick={() => setProfile({ ...profile, keywords: profile.keywords.filter((x: string) => x !== k) })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save(false)} className="btn-primary" disabled={saving || analyzing}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => save(true)}
            className="btn-secondary"
            disabled={saving || analyzing || !profile.websiteUrl}
          >
            {analyzing ? 'Analyzing…' : 'Save & analyze website'}
          </button>
        </div>
        {profile.websiteSummary && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap">
            <span className="font-medium">Website summary:</span> {profile.websiteSummary}
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-medium">Logo</h2>
        <div className="flex items-center gap-4">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="logo" className="h-16 w-16 rounded bg-gray-100 object-contain" />
          ) : (
            <div className="h-16 w-16 rounded bg-gray-100" />
          )}
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload logo
          </button>
          <input
            type="file"
            accept="image/*"
            hidden
            ref={fileRef}
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
          />
        </div>
        <div>
          <label className="label">Default logo position</label>
          <select
            className="input"
            value={profile.logoPosition}
            onChange={(e) => setProfile({ ...profile, logoPosition: e.target.value })}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-medium">Posting</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">Default post time (24h, your local time)</label>
            <input
              className="input"
              type="time"
              value={profile.defaultPostTime}
              onChange={(e) => setProfile({ ...profile, defaultPostTime: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={profile.autoPublish}
                onChange={(e) => setProfile({ ...profile, autoPublish: e.target.checked })}
              />
              Auto-publish daily post (otherwise stays in “Awaiting approval”)
            </label>
          </div>
        </div>
        <button onClick={() => save(false)} className="btn-primary" disabled={saving}>
          Save posting preferences
        </button>
        <p className="text-xs text-gray-500">
          Need multiple posts a day at specific times?{' '}
          <a className="text-brand-700 font-medium" href="/schedules">
            Open Auto-Schedule →
          </a>{' '}
          to pick a time range and posts-per-day, and Post Agent will generate &amp; publish to all
          connected accounts automatically.
        </p>
      </div>
    </div>
  );
}
