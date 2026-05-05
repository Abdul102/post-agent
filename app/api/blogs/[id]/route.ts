import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { z } from 'zod';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const blog = await prisma.blog.findFirst({ where: { id: ctx.params.id, userId } });
  if (!blog) return bad('Not found', 404);
  return ok({ blog });
}

const patchSchema = z.object({
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  contentMarkdown: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const existing = await prisma.blog.findFirst({ where: { id: ctx.params.id, userId } });
    if (!existing) return bad('Not found', 404);
    const data = patchSchema.parse(await req.json());
    const blog = await prisma.blog.update({ where: { id: existing.id }, data });
    return ok({ blog });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const existing = await prisma.blog.findFirst({ where: { id: ctx.params.id, userId } });
  if (!existing) return bad('Not found', 404);
  await prisma.blog.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}
