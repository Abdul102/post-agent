'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Image as ImageIcon, Upload, Send, CheckCircle2, Video } from 'lucide-react';
import { PostCard, PostCardData } from '@/components/PostCard';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { MultiPlatformPreview } from '@/components/MultiPlatformPreview';

const ASPECTS = [
  { value: '1:1', label: 'Square 1:1 (FB feed / IG)' },
  { value: '1.91:1', label: 'Landscape 1.91:1 (FB link)' },
  { value: '4:5', label: 'Portrait 4:5 (IG feed)' },
  { value: '9:16', label: 'Story / Reel 9:16' },
] as const;

export default function CreatePostPage() {
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [post, setPost] = useState<PostCardData | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imgGenerating, setImgGenerating] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [aspect, setAspect] = useState<string>('1:1');
  const [videoUrl, setVideoUrl] = useState('');
  const [logoPosition, setLogoPosition] =
    useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Push title edits back to the post (debounced via setTimeout)
  useEffect(() => {
    if (!post) return;
    if (title === post.title) return;
    const t = setTimeout(() => {
      void fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || null }),
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch('/api/generate/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic || undefined, title: title || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed');
      setPost({ ...j.post, image: null });
      setImagePrompt(j.imagePrompt ?? '');
      if (!title && j.post?.title) setTitle(j.post.title);
      toast.success('Post generated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateImage() {
    if (!post || !imagePrompt) return;
    setImgGenerating(true);
    try {
      const r = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, postId: post.id, logoPosition }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed');
      setPost({ ...post, image: { finalUrl: j.image.finalUrl } });
      toast.success('Image generated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImgGenerating(false);
    }
  }

  async function uploadImage(file: File) {
    if (!post) {
      toast.error('Generate a post first');
      return;
    }
    setImgUploading(true);
    const tid = toast.loading('Uploading & cropping…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('aspect', aspect);
      fd.append('logoPos', logoPosition);
      const r = await fetch(`/api/posts/${post.id}/upload-image`, {
        method: 'POST',
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Upload failed');
      setPost({ ...post, image: { finalUrl: j.image.finalUrl } });
      toast.success('Image uploaded & cropped', { id: tid });
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setImgUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveVideoUrl() {
    if (!post || !videoUrl) return;
    try {
      const r = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      });
      if (!r.ok) throw new Error('Save failed');
      toast.success('Video URL saved');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function publishToFacebook() {
    if (!post) return;
    setPublishing(true);
    try {
      const r = await fetch(`/api/posts/${post.id}/publish`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Publish failed');
      toast.success('Published to Facebook');
      setPost({ ...post, status: 'PUBLISHED' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  }

  async function publishToAll() {
    if (!post) return;
    setPublishing(true);
    try {
      const r = await fetch(`/api/posts/${post.id}/publish-multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Publish failed');
      const ok = (j.results ?? []).filter((x: any) => x.ok).length;
      const total = (j.results ?? []).length;
      toast.success(`Published ${ok}/${total}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Post</h1>
        <p className="text-sm text-gray-500">Title, body, image, video — then post anywhere.</p>
      </div>

      <ConnectionStatus />

      <div className="card space-y-4">
        <div>
          <label className="label">Title (optional)</label>
          <input
            className="input"
            placeholder="Catchy headline (used as Facebook headline / IG first line)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Topic</label>
          <input
            className="input"
            placeholder="e.g. how to choose the right plan for our small business customers"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to let the AI pick a fresh topic that fits your brand.
          </p>
        </div>
        <button onClick={generate} disabled={generating} className="btn-primary">
          <Sparkles size={16} /> {generating ? 'Generating…' : 'Generate post'}
        </button>
      </div>

      {post && (
        <div className="grid md:grid-cols-2 gap-6">
          <PostCard post={{ ...post, title }} />

          <div className="space-y-4">
            {/* ── Image card ─────────────────────────────────────────── */}
            <div className="card space-y-3">
              <h2 className="font-medium">Image</h2>

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
                <p className="text-xs text-gray-500 mt-1">
                  Uploaded photos will be auto-cropped to this aspect (no manual cropping needed).
                </p>
              </div>

              <div>
                <label className="label">Logo position</label>
                <select
                  className="input"
                  value={logoPosition}
                  onChange={(e) => setLogoPosition(e.target.value as any)}
                >
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-right">Top right</option>
                  <option value="top-left">Top left</option>
                </select>
              </div>

              <div>
                <label className="label">AI image prompt</label>
                <textarea
                  className="input min-h-[80px]"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateImage}
                  disabled={imgGenerating || imgUploading}
                  className="btn-primary"
                >
                  <ImageIcon size={16} /> {imgGenerating ? 'Generating…' : 'Generate AI image'}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imgGenerating || imgUploading}
                  className="btn-secondary"
                >
                  <Upload size={16} /> {imgUploading ? 'Uploading…' : 'Upload my own photo'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
              </div>
              <p className="text-xs text-gray-500">
                Logo overlay only applies if you've uploaded one in Settings.
              </p>
            </div>

            {/* ── Video card ─────────────────────────────────────────── */}
            <div className="card space-y-3">
              <h2 className="font-medium flex items-center gap-2">
                <Video size={16} /> Video (optional)
              </h2>
              <input
                className="input"
                placeholder="Public video URL (.mp4) or YouTube/Vimeo link"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <button onClick={saveVideoUrl} disabled={!videoUrl} className="btn-secondary">
                Save video
              </button>
              <p className="text-xs text-gray-500">
                Videos are linked in the post body (FB native video upload coming soon).
              </p>
            </div>

            {/* ── Publish card ───────────────────────────────────────── */}
            <div className="card space-y-3">
              <h2 className="font-medium">Publish</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={publishToFacebook}
                  disabled={publishing}
                  className="btn-primary"
                >
                  <Send size={16} /> {publishing ? 'Posting…' : 'Post to Facebook'}
                </button>
                <button
                  onClick={publishToAll}
                  disabled={publishing}
                  className="btn-secondary"
                >
                  <CheckCircle2 size={16} /> Publish to all connected
                </button>
              </div>
              <p className="text-xs text-gray-500">
                "Publish to all" pushes to every connected platform. For IG you need a public image
                (Cloudinary configured).
              </p>
            </div>
          </div>
        </div>
      )}

      {post && <MultiPlatformPreview post={{ ...post, title }} />}
    </div>
  );
}
