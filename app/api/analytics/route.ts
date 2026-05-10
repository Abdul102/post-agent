import { prisma } from '@/lib/prisma';
import { requireUser, ok } from '@/lib/api-utils';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;

  const [
    total,
    published,
    failed,
    scheduled,
    draft,
    awaiting,
    blogsCount,
    recent,
    impressionsAgg,
    blogViewsAgg,
    topBlogs,
  ] = await Promise.all([
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
    prisma.post.aggregate({
      where: { userId },
      _sum: { impressions: true, reach: true, engagements: true },
    }),
    prisma.blog.aggregate({
      where: { userId },
      _sum: { viewCount: true },
    }),
    prisma.blog.findMany({
      where: { userId },
      orderBy: { viewCount: 'desc' },
      take: 5,
      select: {
        id: true,
        seoTitle: true,
        slug: true,
        viewCount: true,
        createdAt: true,
        seoScore: true,
      },
    }),
  ]);

  return ok({
    counts: {
      total,
      published,
      failed,
      scheduled,
      draft,
      awaiting,
      blogs: blogsCount,
    },
    insights: {
      totalImpressions: impressionsAgg._sum.impressions ?? 0,
      totalReach: impressionsAgg._sum.reach ?? 0,
      totalEngagements: impressionsAgg._sum.engagements ?? 0,
      totalBlogViews: blogViewsAgg._sum.viewCount ?? 0,
    },
    topBlogs,
    recentPosts: recent,
  });
}
