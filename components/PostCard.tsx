'use client';

import { Copy, Download, Trash2, CheckCircle2, Send, Pencil, Video, BarChart3, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export interface PostCardData {
  id: string;
  title?: string | null;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  fullCaption: string;
  status: string;
  createdAt: string | Date;
  topic?: string | null;
  videoUrl?: string | null;
  impressions?: number;
  reach?: number;
  engagements?: number;
  externalUrl?: string | null;
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
  onEdit,
}: {
  post: PostCardData;
  onDelete?: (id: string) => void;
  onApprove?: (id: string) => void;
  onPublishAll?: (id: string) => void;
  onEdit?: (post: PostCardData) => void;
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

  const hasInsights = (post.impressions ?? 0) + (post.reach ?? 0) + (post.engagements ?? 0) > 0;

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={`badge ${statusColor(post.status)}`}>{post.status}</span>
        <span className="text-xs text-gray-500">
          {new Date(post.createdAt).toLocaleString()}
        </span>
      </div>
      {post.topic && <div className="text-xs text-gray-500">Topic: {post.topic}</div>}
      {post.title && <h3 className="font-semibold text-base text-gray-900">{post.title}</h3>}
      {post.image?.finalUrl && (
        <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
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
      {post.videoUrl && (
        <a
          href={post.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
        >
          <Video size={12} /> Video attached
        </a>
      )}
      {hasInsights && (
        <div className="flex items-center gap-3 text-xs text-gray-600 border-t border-gray-100 pt-2">
          <BarChart3 size={12} className="text-brand-700" />
          <span>
            <span className="font-medium">{post.impressions ?? 0}</span> impressions
          </span>
          {post.reach != null && (
            <span>
              <span className="font-medium">{post.reach}</span> reach
            </span>
          )}
          {post.engagements != null && (
            <span>
              <span className="font-medium">{post.engagements}</span> engagements
            </span>
          )}
        </div>
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
        {post.externalUrl && (
          <a className="btn-secondary" href={post.externalUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> View live
          </a>
        )}
        {onEdit && (
          <button className="btn-secondary" onClick={() => onEdit(post)}>
            <Pencil size={14} /> Edit
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
