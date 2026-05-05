import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { generateBlog } from '@/lib/content-generator';
import { TEXT_MODEL } from '@/lib/openai';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const blogs = await prisma.blog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return ok({ blogs });
}

const generateSchema = z.object({
  topic: z.string().optional(),
  targetKeyword: z.string().optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) return bad('Set up your business profile first', 412);

    const { topic, targetKeyword } = generateSchema.parse(await req.json().catch(() => ({})));
    const g = await generateBlog(profile, { topic, targetKeyword });

    // Ensure unique slug per user
    let slug = g.slug;
    let i = 1;
    while (await prisma.blog.findUnique({ where: { userId_slug: { userId, slug } } })) {
      slug = `${g.slug}-${i++}`;
    }

    const blog = await prisma.blog.create({
      data: {
        userId,
        seoTitle: g.seoTitle,
        metaDescription: g.metaDescription,
        slug,
        contentMarkdown: g.contentMarkdown,
        headings: g.headings,
        keywords: g.keywords,
        internalLinks: g.internalLinks,
        cta: g.cta,
        status: 'DRAFT',
        modelUsed: TEXT_MODEL,
      },
    });
    return ok({ blog });
  } catch (e) {
    return fail(e);
  }
}
