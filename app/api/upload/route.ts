import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';

/**
 * Generic multipart upload endpoint — used by Settings page to upload a logo.
 * Field name: "file"
 */
export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return bad('No file');
    if (file.size > 5 * 1024 * 1024) return bad('Max 5MB');
    const buf = Buffer.from(await file.arrayBuffer());

    if (isCloudinaryConfigured()) {
      const up = await uploadBufferToCloudinary(buf, {
        folder: `nextgen-growth/${userId}/logos`,
        tags: ['logo'],
      });
      return ok({ url: up.url, width: up.width, height: up.height });
    }
    // Local fallback (NOT recommended for prod): return a data URL
    const mime = file.type || 'image/png';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    return ok({ url: dataUrl });
  } catch (e) {
    return fail(e);
  }
}
