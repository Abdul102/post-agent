/**
 * Pluggable image-generation provider.
 *
 * Default provider is Pollinations.ai — completely FREE, no API key required,
 * uses FLUX under the hood. Swap to OpenAI or Replicate by setting
 * IMAGE_PROVIDER in your .env file.
 *
 * All providers return a public URL pointing to the generated image.
 * The URL is then downloaded, watermarked with the user's logo via Sharp,
 * and uploaded to Cloudinary.
 */

import { getOpenAI } from '@/lib/openai';

export type ImageProviderName = 'pollinations' | 'openai' | 'replicate';

export interface GenerateImageInput {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface GenerateImageOutput {
  provider: ImageProviderName;
  url: string;
  width: number;
  height: number;
}

function activeProvider(): ImageProviderName {
  const v = (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase();
  if (v === 'openai' || v === 'replicate' || v === 'pollinations') return v;
  return 'pollinations';
}

/* ── Pollinations (FREE, no API key) ───────────────────────────────────── */
async function generatePollinations(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const w = input.width ?? 1024;
  const h = input.height ?? 1024;
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const params = new URLSearchParams({
    width: String(w),
    height: String(h),
    seed: String(seed),
    nologo: 'true',
    enhance: 'true',
    model: 'flux',
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(input.prompt)}?${params}`;
  // Pre-warm: Pollinations generates on first GET. We just return the URL —
  // the caller's fetch step will block until generation completes.
  return { provider: 'pollinations', url, width: w, height: h };
}

/* ── OpenAI gpt-image-1 / DALL·E 3 ─────────────────────────────────────── */
async function generateOpenAI(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const client = getOpenAI();
  const size = pickOpenAISize(input.width, input.height);
  const r = await client.images.generate({
    model: 'gpt-image-1',
    prompt: input.prompt,
    size,
    n: 1,
  });
  const first = r.data?.[0];
  if (!first) throw new Error('OpenAI image API returned no data');
  // gpt-image-1 returns base64 by default
  if (first.b64_json) {
    const dataUrl = `data:image/png;base64,${first.b64_json}`;
    const [w, h] = sizeToWh(size);
    return { provider: 'openai', url: dataUrl, width: w, height: h };
  }
  if (first.url) {
    const [w, h] = sizeToWh(size);
    return { provider: 'openai', url: first.url, width: w, height: h };
  }
  throw new Error('OpenAI image API returned neither url nor b64_json');
}

function pickOpenAISize(w?: number, h?: number): '1024x1024' | '1024x1536' | '1536x1024' {
  if (!w || !h || w === h) return '1024x1024';
  if (w > h) return '1536x1024';
  return '1024x1536';
}
function sizeToWh(s: string): [number, number] {
  const [w, h] = s.split('x').map(Number);
  return [w, h];
}

/* ── Replicate (FLUX, SDXL, …) ─────────────────────────────────────────── */
async function generateReplicate(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set');
  // Use FLUX-schnell — fastest free-tier-friendly model.
  const create = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt: input.prompt,
        aspect_ratio:
          (input.width ?? 1024) === (input.height ?? 1024)
            ? '1:1'
            : (input.width ?? 1024) > (input.height ?? 1024)
              ? '16:9'
              : '9:16',
        output_format: 'png',
      },
    }),
  });
  if (!create.ok) throw new Error(`Replicate error: ${create.status} ${await create.text()}`);
  const json = await create.json();
  const url: string | undefined = Array.isArray(json.output) ? json.output[0] : json.output;
  if (!url) throw new Error('Replicate returned no output URL');
  return { provider: 'replicate', url, width: input.width ?? 1024, height: input.height ?? 1024 };
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  switch (activeProvider()) {
    case 'openai':
      return generateOpenAI(input);
    case 'replicate':
      return generateReplicate(input);
    case 'pollinations':
    default:
      return generatePollinations(input);
  }
}

/** Download a remote (or data:) URL into a Buffer for further processing. */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const b64 = url.split(',')[1] ?? '';
    return Buffer.from(b64, 'base64');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
