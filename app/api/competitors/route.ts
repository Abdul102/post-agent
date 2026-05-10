import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail } from '@/lib/api-utils';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  websiteUrl: z.string().url().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  facebookUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const competitors = await prisma.competitor.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      insights: { orderBy: { generatedAt: 'desc' }, take: 1 },
    },
  });
  return ok({ competitors });
}

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const data = createSchema.parse(await req.json());
    const competitor = await prisma.competitor.create({
      data: { userId, ...data },
    });
    return ok({ competitor });
  } catch (e) {
    return fail(e);
  }
}
