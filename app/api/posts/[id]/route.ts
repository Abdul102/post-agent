import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

const patchSchema = z.object({
  hook: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  fullCaption: z.string().optional(),
  status: z.enum(['DRAFT', 'AWAITING_APPROVAL', 'SCHEDULED', 'PUBLISHED', 'FAILED']).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  socialAccountId: z.string().optional().nullable(),
  platform: z.enum(['facebook', 'instagram']).optional().nullable(),
});

async function ownPost(userId: string, id: string) {
  const post = await prisma.post.findFirst({ where: { id, userId } });
  return post;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const post = await prisma.post.findFirst({
    where: { id: ctx.params.id, userId },
    include: { image: true, socialAccount: true, schedule: true },
  });
  if (!post) return bad('Not found', 404);
  return ok({ post });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const existing = await ownPost(userId, ctx.params.id);
    if (!existing) return bad('Not found', 404);
    const data = patchSchema.parse(await req.json());
    const post = await prisma.post.update({
      where: { id: existing.id },
      data: {
        ...data,
        scheduledFor: data.scheduledFor === null ? null : data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      },
    });

    // If user marks as SCHEDULED, ensure a schedule row exists
    if (data.status === 'SCHEDULED' && post.scheduledFor) {
      await prisma.schedule.upsert({
        where: { postId: post.id },
        create: { userId, postId: post.id, runAt: post.scheduledFor, status: 'PENDING' },
        update: { runAt: post.scheduledFor, status: 'PENDING' },
      });
    }

    return ok({ post });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const existing = await ownPost(userId, ctx.params.id);
  if (!existing) return bad('Not found', 404);
  await prisma.post.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}
