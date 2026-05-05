import { prisma } from '@/lib/prisma';
import { requireUser, ok } from '@/lib/api-utils';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;

  const [total, published, failed, scheduled, draft, awaiting, blogs, recent] = await Promise.all([
    prisma.post.count({ where: { userId } }),
    prisma.post.count({ where: { userId, status: 'PUBLISHED' } }),
    prisma.post.count({ where: { userId, status: 'FAILED' } }),
    prisma.post.count({ where: { userId, status: 'SCHEDULED' } }),
    prisma.post.count({ where: { userId, status: 'DRAFT' } }),
    prisma.post.count({ where: { userId, status: 'AWAITING_APPROVAL' } }),
    prisma.blog.count({ where: { userId } }),
    prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { image: true },
    }),
  ]);

  return ok({
    counts: { total, published, failed, scheduled, draft, awaiting, blogs },
    recentPosts: recent,
  });
}
