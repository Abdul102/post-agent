import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  websiteUrl: z.string().url().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  facebookUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const existing = await prisma.competitor.findFirst({
      where: { id: ctx.params.id, userId },
    });
    if (!existing) return bad('Not found', 404);
    const data = patchSchema.parse(await req.json());
    const competitor = await prisma.competitor.update({
      where: { id: existing.id },
      data,
    });
    return ok({ competitor });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const existing = await prisma.competitor.findFirst({
    where: { id: ctx.params.id, userId },
  });
  if (!existing) return bad('Not found', 404);
  await prisma.competitor.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}
