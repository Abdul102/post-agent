import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { generateSeoSuggestions } from '@/lib/content-generator';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const items = await prisma.seoSuggestion.findMany({
    where: { userId },
    orderBy: { forDate: 'desc' },
    take: 30,
  });
  return ok({ items });
}

export async function POST() {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) return bad('Set up your business profile first', 412);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const g = await generateSeoSuggestions(profile);
    const suggestion = await prisma.seoSuggestion.upsert({
      where: { userId_forDate: { userId, forDate: today } },
      create: {
        userId,
        forDate: today,
        blogTitles: g.blogTitles,
        metaTitles: g.metaTitles,
        metaDescriptions: g.metaDescriptions,
        keywords: g.keywords,
        faqs: g.faqs as any,
        outreachMessages: g.outreachMessages,
        directories: g.directories,
        notes: g.notes,
      },
      update: {
        blogTitles: g.blogTitles,
        metaTitles: g.metaTitles,
        metaDescriptions: g.metaDescriptions,
        keywords: g.keywords,
        faqs: g.faqs as any,
        outreachMessages: g.outreachMessages,
        directories: g.directories,
        notes: g.notes,
      },
    });
    return ok({ suggestion });
  } catch (e) {
    return fail(e);
  }
}
