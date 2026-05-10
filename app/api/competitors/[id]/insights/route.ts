import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { generateCompetitorInsights } from '@/lib/content-generator';
import { TEXT_MODEL } from '@/lib/openai';

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const competitor = await prisma.competitor.findFirst({
      where: { id: ctx.params.id, userId },
    });
    if (!competitor) return bad('Not found', 404);

    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) return bad('Set up your business profile first', 412);

    const insights = await generateCompetitorInsights(profile, competitor);

    const row = await prisma.competitorInsight.create({
      data: {
        competitorId: competitor.id,
        commonTopics: insights.commonTopics,
        postingFrequency: insights.postingFrequency,
        contentGaps: insights.contentGaps,
        contentIdeas: insights.contentIdeas,
        recommendedTopics: insights.recommendedTopics,
        summary: insights.summary,
        modelUsed: TEXT_MODEL,
      },
    });

    return ok({ insight: row });
  } catch (e) {
    return fail(e);
  }
}
