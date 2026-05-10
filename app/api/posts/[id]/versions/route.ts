import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

const upsertSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'twitter']),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
});

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const post = await prisma.post.findFirst({ where: { id: ctx.params.id, userId } });
  if (!post) return bad('Post not found', 404);
  const versions = await prisma.platformPostVersion.findMany({
    where: { postId: post.id },
    orderBy: { updatedAt: 'desc' },
  });
  return ok({ versions });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const post = await prisma.post.findFirst({ where: { id: ctx.params.id, userId } });
    if (!post) return bad('Post not found', 404);
    const data = upsertSchema.parse(await req.json());
    const version = await prisma.platformPostVersion.upsert({
      where: { postId_platform: { postId: post.id, platform: data.platform } },
      create: {
        postId: post.id,
        platform: data.platform,
        caption: data.caption,
        hashtags: data.hashtags,
        charCount: data.caption.length,
      },
      update: {
        caption: data.caption,
        hashtags: data.hashtags,
        charCount: data.caption.length,
      },
    });
    return ok({ version });
  } catch (e) {
    return fail(e);
  }
}
