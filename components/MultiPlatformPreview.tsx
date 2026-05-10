'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Save, Facebook, Instagram, Linkedin, Twitter, AlertTriangle } from 'lucide-react';
import type { PostCardData } from './PostCard';

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'twitter';

const LIMITS: Record<Platform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  twitter: 280,
};

const META: Record<Platform, { label: string; icon: any; color: string }> = {
  facebook: { label: 'Facebook', icon: Facebook, color: 'text-blue-600' },
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-600' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: 'text-sky-700' },
  twitter: { label: 'X (Twitter)', icon: Twitter, color: 'text-gray-900' },
};

function formatForPlatform(post: PostCardData, platform: Platform): { caption: string; hashtags: string[] } {
  const hashtagsLine = post.hashtags?.length ? '\n\n' + post.hashtags.map((h) => `#${h}`).join(' ') : '';
  switch (platform) {
    case 'twitter': {
      // Tight: hook + short body, must fit 280 incl hashtags
      const base = `${post.hook}\n\n${post.cta}`;
      const tags = post.hashtags?.slice(0, 3) ?? [];
      const tagLine = tags.length ? '\n' + tags.map((h) => `#${h}`).join(' ') : '';
      let caption = base + tagLine;
      if (caption.length > 280) caption = caption.slice(0, 277) + '…';
      return { caption, hashtags: tags };
    }
    case 'linkedin': {
      // Long-form, professional, fewer hashtags at end
      const tags = post.hashtags?.slice(0, 5) ?? [];
      const head = post.title ? `${post.title}\n\n` : '';
      const caption = `${head}${post.hook}\n\n${post.body}\n\n${post.cta}` + (tags.length ? '\n\n' + tags.map((h) => `#${h}`).join(' ') : '');
      return { caption, hashtags: tags };
    }
    case 'instagram': {
      // First line is the hook (acts as headline). Up to 30 hashtags allowed.
      const tags = post.hashtags?.slice(0, 30) ?? [];
      const head = post.title ? `${post.title}\n\n` : '';
      const caption = `${head}${post.hook}\n\n${post.body}\n\n${post.cta}` + (tags.length ? '\n.\n.\n' + tags.map((h) => `#${h}`).join(' ') : '');
      return { caption, hashtags: tags };
    }
    case 'facebook':
    default: {
      const head = post.title ? `${post.title}\n\n` : '';
      return {
        caption: `${head}${post.hook}\n\n${post.body}\n\n${post.cta}${hashtagsLine}`,
        hashtags: post.hashtags ?? [],
      };
    }
  }
}

export function MultiPlatformPreview({ post }: { post: PostCardData }) {
  const [active, setActive] = useState<Platform>('facebook');
  const [savingFor, setSavingFor] = useState<Platform | null>(null);

  const versions = useMemo(() => {
    const map = {} as Record<Platform, ReturnType<typeof formatForPlatform>>;
    (Object.keys(LIMITS) as Platform[]).forEach((p) => {
      map[p] = formatForPlatform(post, p);
    });
    return map;
  }, [post]);

  const current = versions[active];
  const limit = LIMITS[active];
  const overLimit = current.caption.length > limit;

  async function copy() {
    await navigator.clipboard.writeText(current.caption);
    toast.success(`${META[active].label} caption copied`);
  }

  async function saveVersion() {
    setSavingFor(active);
    try {
      const r = await fetch(`/api/posts/${post.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: active,
          caption: current.caption,
          hashtags: current.hashtags,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? 'Save failed');
      }
      toast.success('Version saved');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingFor(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-medium">Multi-platform preview</h2>
        <p className="text-xs text-gray-500">Same post, formatted for each network — copy or save a version.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2">
        {(Object.keys(META) as Platform[]).map((p) => {
          const Icon = META[p].icon;
          const isActive = p === active;
          return (
            <button
              key={p}
              onClick={() => setActive(p)}
              className={
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ' +
                (isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50')
              }
            >
              <Icon size={14} className={META[p].color} /> {META[p].label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
          {/* Mobile-style preview card */}
          <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
            <div className="h-7 w-7 rounded-full bg-gray-300" />
            <div>Your Brand · just now</div>
          </div>
          {post.image?.finalUrl && active !== 'twitter' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image.finalUrl}
              alt="preview"
              className="rounded-lg w-full max-h-72 object-cover mb-2"
            />
          )}
          <pre className="whitespace-pre-wrap text-sm font-sans text-gray-800">{current.caption}</pre>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className={overLimit ? 'text-red-600 font-medium' : 'text-gray-600'}>
            {current.caption.length} / {limit} chars
          </span>
          {overLimit && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <AlertTriangle size={12} /> over limit, will be truncated
            </span>
          )}
          {current.hashtags.length > 0 && (
            <span className="text-gray-500">{current.hashtags.length} hashtags</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="btn-secondary">
            <Copy size={14} /> Copy
          </button>
          <button onClick={saveVersion} disabled={savingFor === active} className="btn-secondary">
            <Save size={14} /> {savingFor === active ? 'Saving…' : 'Save version'}
          </button>
        </div>
      </div>
    </div>
  );
}
