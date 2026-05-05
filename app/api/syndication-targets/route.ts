import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const targets = await prisma.syndicationTarget.findMany({
    where: { userId },
    orderBy: [{ platform: 'asc' }, { createdAt: 'desc' }],
  });
  return ok({ targets });
}

const createSchema = z.object({
  platform: z.string().min(1),
  /// e.g. 'webdev' for r/webdev (no leading 'r/' please)
  targetRef: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  notes: z.string().max(2000).optional(),
  cooldownHrs: z.number().int().min(1).max(720).optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const data = createSchema.parse(await req.json());
    // Normalize subreddit name (strip leading r/ or u/)
    if (data.platform === 'reddit') {
      data.targetRef = data.targetRef.replace(/^\/?r\//i, '').trim();
    }
    const target = await prisma.syndicationTarget.create({
      data: { userId, ...data },
    });
    return ok({ target });
  } catch (e) {
    return fail(e);
  }
}

const deleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const { id } = deleteSchema.parse(await req.json());
    const t = await prisma.syndicationTarget.findFirst({ where: { id, userId } });
    if (!t) return bad('Not found', 404);
    await prisma.syndicationTarget.delete({ where: { id: t.id } });
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  cooldownHrs: z.number().int().min(1).max(720).optional(),
  notes: z.string().max(2000).optional(),
  label: z.string().min(1).max(120).optional(),
});

export async function PATCH(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const { id, ...data } = patchSchema.parse(await req.json());
    const t = await prisma.syndicationTarget.findFirst({ where: { id, userId } });
    if (!t) return bad('Not found', 404);
    const updated = await prisma.syndicationTarget.update({ where: { id: t.id }, data });
    return ok({ target: updated });
  } catch (e) {
    return fail(e);
  }
}
