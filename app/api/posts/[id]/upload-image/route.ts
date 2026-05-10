import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '@/lib/cloudinary';
import { applyLogoOverlay, type LogoPosition } from '@/lib/logo-overlay';
import { fetchImageBuffer } from '@/lib/image-provider';

export const runtime = 'nodejs';

/**
 * Upload a custom image for a Post (replaces any existing image).
 *
 * multipart/form-data fields:
 *   file        — image file (required)
 *   aspect      — "1:1" | "1.91:1" | "4:5" | "9:16"  (optional, default "1:1")
 *   logoPos     — "top-left" | "top-right" | "bottom-left" | "bottom-right"
 *   skipLogo    — "true" to skip logo overlay
 *
 * Server-side resize/crop with Sharp so users don't need to crop manually.
 */
const ASPECTS: Record<string, { w: number; h: number; label: string }> = {
  '1:1': { w: 1080, h: 1080, label: 'Square (FB / IG)' },
  '1.91:1': { w: 1200, h: 628, label: 'Facebook landscape' },
  '4:5': { w: 1080, h: 1350, label: 'Instagram portrait' },
  '9:16': { w: 1080, h: 1920, label: 'Story / Reel' },
};

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const post = await prisma.post.findFirst({ where: { id: ctx.params.id, userId } });
    if (!post) return bad('Post not found', 404);

    const form = await req.formData();
    const file = form.get('file');
    const aspect = String(form.get('aspect') ?? '1:1');
    const logoPos = (form.get('logoPos') as LogoPosition | null) ?? null;
    const skipLogo = String(form.get('skipLogo') ?? 'false') === 'true';

    if (!(file instanceof File)) return bad('No file provided');
    if (file.size > 10 * 1024 * 1024) return bad('Max 10MB');

    const target = ASPECTS[aspect] ?? ASPECTS['1:1'];
    const inputBuf = Buffer.from(await file.arrayBuffer());

    // Resize + center-crop to target aspect with Sharp
    const rawBuffer = await sharp(inputBuf)
      .rotate() // auto-orient via EXIF
      .resize(target.w, target.h, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Optional logo overlay (uses business profile logo)
    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    let finalBuffer = rawBuffer;
    let logoApplied = false;
    if (!skipLogo && profile?.logoUrl) {
      try {
        const logoBuffer = await fetchImageBuffer(profile.logoUrl);
        const pos = (logoPos ?? profile.logoPosition) as LogoPosition;
        finalBuffer = await applyLogoOverlay({ imageBuffer: rawBuffer, logoBuffer, position: pos });
        logoApplied = true;
      } catch {
        finalBuffer = rawBuffer;
      }
    }

    // Upload to Cloudinary, fallback to data URL (dev only)
    let rawUrl: string;
    let finalUrl: string;
    if (isCloudinaryConfigured()) {
      const rawUp = await uploadBufferToCloudinary(rawBuffer, {
        folder: `nextgen-growth/${userId}/uploads/raw`,
        tags: ['upload', 'raw'],
      });
      const finalUp = logoApplied
        ? await uploadBufferToCloudinary(finalBuffer, {
            folder: `nextgen-growth/${userId}/uploads/final`,
            tags: ['upload', 'final'],
          })
        : rawUp;
      rawUrl = rawUp.url;
      finalUrl = finalUp.url;
    } else {
      rawUrl = `data:image/jpeg;base64,${rawBuffer.toString('base64')}`;
      finalUrl = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`;
    }

    // Replace any existing image for this post
    await prisma.image.deleteMany({ where: { postId: post.id } });
    const image = await prisma.image.create({
      data: {
        userId,
        postId: post.id,
        prompt: 'user-uploaded',
        provider: 'upload',
        source: 'uploaded',
        aspectRatio: aspect,
        rawUrl,
        finalUrl,
        width: target.w,
        height: target.h,
        logoApplied,
      },
    });

    return ok({ image });
  } catch (e) {
    return fail(e);
  }
}
