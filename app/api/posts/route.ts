import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

const querySchema = z.object({
  status: z.enum(['DRAFT', 'AWAITING_APPROVAL', 'SCHEDULED', 'PUBLISHED', 'FAILED']).optional(),
  take: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export async function GET(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const { status, take } = querySchema.parse({
    status: url.searchParams.get('status') ?? undefined,
    take: url.searchParams.get('take') ?? undefined,
  });
  const posts = await prisma.post.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
    include: { image: true, socialAccount: true, schedule: true },
  });
  return ok({ posts });
}

const createSchema = z.object({
  title: z.string().max(200).optional(),
  hook: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  fullCaption: z.string().min(1),
  websiteLink: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  topic: z.string().optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const data = createSchema.parse(await req.json());
    const post = await prisma.post.create({ data: { userId, status: 'DRAFT', ...data } });
    return ok({ post });
  } catch (e) {
    return fail(e);
  }
}
