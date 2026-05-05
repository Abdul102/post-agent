import sharp from 'sharp';

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface OverlayOptions {
  imageBuffer: Buffer;
  logoBuffer: Buffer;
  position?: LogoPosition;
  /** Logo width as a fraction of base image width (default 0.18 = 18%). */
  scale?: number;
  /** Padding from the edge in pixels (default 32). */
  padding?: number;
  /** Render a soft white pill behind the logo for legibility. */
  withBackdrop?: boolean;
}

/**
 * Composite a logo onto a generated image.
 * Returns a PNG buffer.
 */
export async function applyLogoOverlay(opts: OverlayOptions): Promise<Buffer> {
  const {
    imageBuffer,
    logoBuffer,
    position = 'bottom-right',
    scale = 0.18,
    padding = 32,
    withBackdrop = true,
  } = opts;

  const baseMeta = await sharp(imageBuffer).metadata();
  const baseW = baseMeta.width ?? 1024;
  const baseH = baseMeta.height ?? 1024;

  const targetLogoW = Math.max(64, Math.round(baseW * scale));
  let logoResized = await sharp(logoBuffer)
    .resize({ width: targetLogoW, withoutEnlargement: false })
    .png()
    .toBuffer();

  if (withBackdrop) {
    const lm = await sharp(logoResized).metadata();
    const lw = lm.width ?? targetLogoW;
    const lh = lm.height ?? targetLogoW;
    const pad = Math.round(targetLogoW * 0.08);
    const bgW = lw + pad * 2;
    const bgH = lh + pad * 2;
    const bg = await sharp({
      create: {
        width: bgW,
        height: bgH,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.85 },
      },
    })
      .composite([{ input: logoResized, top: pad, left: pad }])
      .png()
      .toBuffer();
    logoResized = bg;
  }

  const lm = await sharp(logoResized).metadata();
  const lw = lm.width ?? targetLogoW;
  const lh = lm.height ?? targetLogoW;

  let top = padding;
  let left = padding;
  switch (position) {
    case 'top-left':
      top = padding;
      left = padding;
      break;
    case 'top-right':
      top = padding;
      left = baseW - lw - padding;
      break;
    case 'bottom-left':
      top = baseH - lh - padding;
      left = padding;
      break;
    case 'bottom-right':
    default:
      top = baseH - lh - padding;
      left = baseW - lw - padding;
      break;
  }

  return sharp(imageBuffer)
    .composite([{ input: logoResized, top, left }])
    .png()
    .toBuffer();
}
