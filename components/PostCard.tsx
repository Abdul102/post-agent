'use client';

import Image from 'next/image';
import { Copy, Download, Trash2, CheckCircle2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export interface PostCardData {
  id: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  fullCaption: string;
  status: string;
  createdAt: string | Date;
  topic?: string | null;
  image?: { finalUrl: string } | null;
}

export function statusColor(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-green-100 text-green-700';
    case 'SCHEDULED':
      return 'bg-blue-100 text-blue-700';
    case 'AWAITING_APPROVAL':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function PostCard({
  post,
  onDelete,
  onApprove,
  onPublishAll,
}: {
  post: PostCardData;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onPublishAll?: (id: string) => void;
}) {
  async function copyCaption() {
    await navigator.clipboard.writeText(post.fullCaption);
    toast.success('Caption copied');
  }
  function downloadImage() {
    if (!post.image?.finalUrl) return;
    const a = document.createElement('a');
    a.href = post.image.finalUrl;
    a.download = `nextgen-post-${post.id}.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`badge ${statusColor(post.status)}`}>{post.status}</span>
        <span className="text-xs text-gray-500">
          {new Date(post.createdAt).toLocaleString()}
        </span>
      </div>
      {post.topic && <div className="text-sm text-gray-500">Topic: {post.topic}</div>}
      {post.image?.finalUrl && (
        <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
          {/* Use plain img to avoid Next/Image domain config for data: URLs */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image.finalUrl} alt="post" className="h-full w-full object-cover" />
        </div>
      )}
      <p className="font-medium">{post.hook}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.body}</p>
      <p className="text-sm text-gray-700">{post.cta}</p>
      {post.hashtags.length > 0 && (
        <p className="text-xs text-brand-700">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <button className="btn-secondary" onClick={copyCaption}>
          <Copy size={14} /> Copy caption
        </button>
        {post.image?.finalUrl && (
          <button className="btn-secondary" onClick={downloadImage}>
            <Download size={14} /> Download image
          </button>
        )}
        {onApprove && (post.status === 'AWAITING_APPROVAL' || post.status === 'DRAFT' || post.status === 'FAILED') && (
          <button className="btn-primary" onClick={() => onApprove(post.id)}>
            <CheckCircle2 size={14} /> Publish to Facebook
          </button>
        )}
        {onPublishAll && (post.status === 'AWAITING_APPROVAL' || post.status === 'DRAFT' || post.status === 'FAILED') && (
          <button className="btn-secondary" onClick={() => onPublishAll(post.id)}>
            <Send size={14} /> Publish to all
          </button>
        )}
        {onDelete && (
          <button className="btn-danger" onClick={() => onDelete(post.id)}>
            <Trash2 size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
