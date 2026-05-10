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
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  websiteUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) return bad('Set up your business profile first', 412);

    const params = generateSchema.parse(await req.json().catch(() => ({})));
    const g = await generateBlog(profile, params);

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
        metaTitle: g.metaTitle ?? g.seoTitle,
        metaDescription: g.metaDescription,
        slug,
        contentMarkdown: g.contentMarkdown,
        headings: g.headings,
        keywords: g.keywords,
        keywordClusters: (g.keywordClusters ?? []) as any,
        semanticKeywords: g.semanticKeywords ?? [],
        faqs: (g.faqs ?? []) as any,
        internalLinks: g.internalLinks,
        externalLinks: g.externalLinks ?? [],
        readabilityScore: g.readabilityScore,
        seoScore: g.seoScore,
        improvementSuggestions: g.improvementSuggestions ?? [],
        cta: g.cta,
        targetAudience: params.targetAudience ?? null,
        tone: params.tone ?? null,
        websiteUrl: params.websiteUrl ?? profile.websiteUrl,
        status: 'DRAFT',
        modelUsed: TEXT_MODEL,
      },
    });
    return ok({ blog });
  } catch (e) {
    return fail(e);
  }
}
