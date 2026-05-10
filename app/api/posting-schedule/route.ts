import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail } from '@/lib/api-utils';

const upsertSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  postsPerDay: z.number().int().min(1).max(5),
  timezone: z.string().default('UTC'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  autoPublishAll: z.boolean().default(true),
});

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const schedule = await prisma.postingSchedule.findUnique({ where: { userId } });
  return ok({ schedule });
}

export async function PUT(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const data = upsertSchema.parse(await req.json());
    const schedule = await prisma.postingSchedule.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return ok({ schedule });
  } catch (e) {
    return fail(e);
  }
}
