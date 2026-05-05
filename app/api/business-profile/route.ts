import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { fetchWebsiteSnapshot, summarizeWebsite } from '@/lib/website-analyzer';

// Convert empty strings → undefined so optional fields don't fail URL validation.
const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

// Allow normal http(s) URLs OR data: URIs (used as a Cloudinary fallback in dev).
const urlOrDataUri = z
  .string()
  .refine((s) => /^https?:\/\//i.test(s) || /^data:/i.test(s), { message: 'Invalid url' });

const upsertSchema = z.object({
  websiteUrl: z.string().url(),
  businessName: z.string().min(1).max(120),
  services: z.string().min(1),
  targetAudience: z.string().min(1),
  brandTone: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  logoUrl: z.preprocess(emptyToUndefined, urlOrDataUri.optional().nullable()),
  logoPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  defaultPostTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  autoPublish: z.boolean().optional(),
  analyzeWebsite: z.boolean().optional(),
});

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const profile = await prisma.businessProfile.findUnique({ where: { userId } });
  return ok({ profile });
}

export async function PUT(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0].message);
    // Strip the `analyzeWebsite` flag — it's a request-time flag, not a DB column.
    const { analyzeWebsite, ...data } = parsed.data;

    let websiteSummary: string | null | undefined;
    if (analyzeWebsite) {
      try {
        const snap = await fetchWebsiteSnapshot(data.websiteUrl);
        websiteSummary = await summarizeWebsite(snap);
      } catch (e) {
        websiteSummary = null; // analysis is best-effort
      }
    }

    const profile = await prisma.businessProfile.upsert({
      where: { userId },
      create: { userId, ...data, websiteSummary: websiteSummary ?? undefined },
      update: { ...data, ...(websiteSummary !== undefined ? { websiteSummary } : {}) },
    });
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}
