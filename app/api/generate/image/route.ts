import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { generateImage, fetchImageBuffer } from '@/lib/image-provider';
import { applyLogoOverlay, type LogoPosition } from '@/lib/logo-overlay';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '@/lib/cloudinary';

const schema = z.object({
  prompt: z.string().min(4).max(2000),
  postId: z.string().optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  /** Override stored logo position. */
  logoPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  /** Skip logo overlay even if a logo is configured. */
  skipLogo: z.boolean().optional(),
});

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const body = await req.json();
    const { prompt, postId, width, height, logoPosition, skipLogo } = schema.parse(body);

    const profile = await prisma.businessProfile.findUnique({ where: { userId } });

    // 1) Generate raw image via the configured provider
    const gen = await generateImage({ prompt, width, height });
    let rawBuffer = await fetchImageBuffer(gen.url);

    // 2) Apply logo overlay if a logo is configured
    let finalBuffer = rawBuffer;
    let logoApplied = false;
    if (!skipLogo && profile?.logoUrl) {
      try {
        const logoBuffer = await fetchImageBuffer(profile.logoUrl);
        const pos = (logoPosition ?? profile.logoPosition) as LogoPosition;
        finalBuffer = await applyLogoOverlay({ imageBuffer: rawBuffer, logoBuffer, position: pos });
        logoApplied = true;
      } catch {
        // overlay is best-effort — fall back to raw image
        finalBuffer = rawBuffer;
      }
    }

    // 3) Upload to Cloudinary (or return data URL if not configured)
    let rawUrl: string;
    let finalUrl: string;
    if (isCloudinaryConfigured()) {
      const rawUp = await uploadBufferToCloudinary(rawBuffer, {
        folder: `nextgen-growth/${userId}/raw`,
        tags: ['raw', gen.provider],
      });
      const finalUp = logoApplied
        ? await uploadBufferToCloudinary(finalBuffer, {
            folder: `nextgen-growth/${userId}/final`,
            tags: ['final', gen.provider],
          })
        : rawUp;
      rawUrl = rawUp.url;
      finalUrl = finalUp.url;
    } else {
      rawUrl = `data:image/png;base64,${rawBuffer.toString('base64')}`;
      finalUrl = `data:image/png;base64,${finalBuffer.toString('base64')}`;
    }

    const image = await prisma.image.create({
      data: {
        userId,
        postId: postId || null,
        prompt,
        provider: gen.provider,
        rawUrl,
        finalUrl,
        width: gen.width,
        height: gen.height,
        logoApplied,
      },
    });

    return ok({ image });
  } catch (e) {
    return fail(e);
  }
}
