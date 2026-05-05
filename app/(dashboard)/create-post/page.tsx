'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Image as ImageIcon, Save } from 'lucide-react';
import { PostCard, PostCardData } from '@/components/PostCard';

export default function CreatePostPage() {
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [post, setPost] = useState<PostCardData | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imgGenerating, setImgGenerating] = useState(false);
  const [logoPosition, setLogoPosition] =
    useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');

  async function generate() {
    setGenerating(true);
    try {
      const r = await fetch('/api/generate/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topic ? { topic } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed');
      setPost({ ...j.post, image: null });
      setImagePrompt(j.imagePrompt ?? '');
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

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Post</h1>
        <p className="text-sm text-gray-500">Generate a fresh, on-brand social post in seconds.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Topic (optional)</label>
          <input
            className="input"
            placeholder="e.g. how to choose the right plan for our small business customers"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave blank to let the AI pick a fresh topic that fits your brand and avoids recent posts.
          </p>
        </div>
        <button onClick={generate} disabled={generating} className="btn-primary">
          <Sparkles size={16} /> {generating ? 'Generating…' : 'Generate post'}
        </button>
      </div>

      {post && (
        <div className="grid md:grid-cols-2 gap-6">
          <PostCard post={post} />
          <div className="card space-y-3">
            <h2 className="font-medium">Image</h2>
            <label className="label">Image prompt</label>
            <textarea
              className="input min-h-[100px]"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
            />
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
            <div className="flex gap-2 pt-1">
              <button onClick={generateImage} disabled={imgGenerating} className="btn-primary">
                <ImageIcon size={16} /> {imgGenerating ? 'Generating…' : 'Generate image'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Logo overlay only applies if you've uploaded one in Settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
