'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Save, Upload, Send, Image as ImageIcon, Sparkles } from 'lucide-react';
import type { PostCardData } from './PostCard';

const ASPECTS = [
  { value: '1:1', label: 'Square 1:1' },
  { value: '1.91:1', label: 'Landscape 1.91:1' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '9:16', label: 'Story / Reel 9:16' },
] as const;

export function EditPostModal({
  post,
  onClose,
  onSaved,
}: {
  post: PostCardData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post.title ?? '');
  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [cta, setCta] = useState(post.cta);
  const [hashtagsRaw, setHashtagsRaw] = useState(post.hashtags?.join(' ') ?? '');
  const [videoUrl, setVideoUrl] = useState(post.videoUrl ?? '');
  const [aspect, setAspect] = useState<string>('1:1');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(post.image?.finalUrl ?? null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function buildFullCaption() {
    const tags = hashtagsRaw
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);
    const head = title ? `${title}\n\n` : '';
    const tagLine = tags.length ? '\n\n' + tags.map((t) => `#${t}`).join(' ') : '';
    return {
      fullCaption: `${head}${hook}\n\n${body}\n\n${cta}${tagLine}`,
      hashtags: tags,
    };
  }

  async function save() {
    setSaving(true);
    try {
      const { fullCaption, hashtags } = buildFullCaption();
      const r = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          hook,
          body,
          cta,
          hashtags,
          fullCaption,
          videoUrl: videoUrl || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      toast.success('Saved');
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const tid = toast.loading('Uploading…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('aspect', aspect);
      const r = await fetch(`/api/posts/${post.id}/upload-image`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Upload failed');
      setImageUrl(j.image.finalUrl);
      toast.success('Image updated', { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      // First save the latest edits
      const { fullCaption, hashtags } = buildFullCaption();
      await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          hook,
          body,
          cta,
          hashtags,
          fullCaption,
          videoUrl: videoUrl || null,
        }),
      });
      const r = await fetch(`/api/posts/${post.id}/publish`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Publish failed');
      toast.success('Published to Facebook');
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit post</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Hook</label>
              <input className="input" value={hook} onChange={(e) => setHook(e.target.value)} />
            </div>
            <div>
              <label className="label">Body</label>
              <textarea
                className="input min-h-[140px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Call to action</label>
              <input className="input" value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>
            <div>
              <label className="label">Hashtags (space or comma separated)</label>
              <input
                className="input"
                value={hashtagsRaw}
                onChange={(e) => setHashtagsRaw(e.target.value)}
                placeholder="growth marketing seo"
              />
            </div>
            <div>
              <label className="label">Video URL (optional)</label>
              <input
                className="input"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Image</label>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="w-full rounded-lg bg-gray-100 object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                  <ImageIcon size={24} />
                </div>
              )}
            </div>
            <div>
              <label className="label">Aspect ratio</label>
              <select
                className="input"
                value={aspect}
                onChange={(e) => setAspect(e.target.value)}
              >
                {ASPECTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} /> {uploading ? 'Uploading…' : 'Replace image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button onClick={publish} disabled={publishing} className="btn-secondary">
            <Send size={14} /> {publishing ? 'Posting…' : 'Save & post to Facebook'}
          </button>
          <button onClick={onClose} className="btn-secondary ml-auto">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
