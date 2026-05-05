/**
 * Content generation helpers — daily social post, blog drafts, SEO suggestions.
 * All functions return strongly-typed objects parsed from JSON-mode LLM output.
 */
import { getOpenAI, TEXT_MODEL } from '@/lib/openai';
import type { BusinessProfile } from '@prisma/client';

export interface GeneratedPost {
  topic: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  imagePrompt: string;
  fullCaption: string;
}

export interface GeneratedBlog {
  seoTitle: string;
  metaDescription: string;
  slug: string;
  contentMarkdown: string;
  headings: string[];
  keywords: string[];
  internalLinks: string[];
  cta: string;
}

export interface GeneratedSeo {
  blogTitles: string[];
  metaTitles: string[];
  metaDescriptions: string[];
  keywords: string[];
  faqs: { q: string; a: string }[];
  outreachMessages: string[];
  directories: string[];
  notes: string;
}

function brandBrief(profile: BusinessProfile): string {
  return [
    `Business name: ${profile.businessName}`,
    `Website: ${profile.websiteUrl}`,
    `Services: ${profile.services}`,
    `Target audience: ${profile.targetAudience}`,
    `Brand tone: ${profile.brandTone}`,
    profile.keywords.length ? `Target keywords: ${profile.keywords.join(', ')}` : '',
    profile.websiteSummary ? `Website summary: ${profile.websiteSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function jsonCompletion<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const client = getOpenAI();
  const r = await client.chat.completions.create({
    model: TEXT_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.85,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  const txt = r.choices[0]?.message?.content ?? '{}';
  return JSON.parse(txt) as T;
}

/** Generate a single Facebook+Instagram-friendly post. */
export async function generateDailyPost(
  profile: BusinessProfile,
  opts: { recentTopics?: string[]; userTopic?: string } = {},
): Promise<GeneratedPost> {
  const system = `You are a senior social media strategist who writes high-engagement Facebook and Instagram posts.
You ALWAYS respond with valid JSON matching this exact shape:
{
  "topic": string,           // 3-7 word topic label
  "hook": string,            // 1 sentence scroll-stopping opener
  "body": string,            // 2-4 short sentences, value-packed
  "cta": string,             // 1 sentence call to action
  "hashtags": string[],      // 6-12 relevant hashtags, no '#' prefix
  "imagePrompt": string,     // a vivid prompt for an image generator (no text-on-image)
  "fullCaption": string      // hook + body + cta + hashtags joined, ready to post
}
Rules:
- Tone matches the brand tone provided.
- Never use offensive, misleading, or copyrighted-character imagery in imagePrompt.
- imagePrompt must describe a clean, professional, photographic or illustrative scene WITHOUT requesting text or letters.
- Avoid duplicating any "recent topics" listed by the user.`;

  const user = [
    'Brand brief:',
    brandBrief(profile),
    '',
    opts.recentTopics?.length ? `Recent topics to avoid: ${opts.recentTopics.join(' | ')}` : '',
    opts.userTopic ? `User-requested topic: ${opts.userTopic}` : 'Pick a fresh topic that fits the brand.',
    '',
    'Write the post now.',
  ]
    .filter(Boolean)
    .join('\n');

  const out = await jsonCompletion<GeneratedPost>(system, user);
  // Defensive normalization
  out.hashtags = (out.hashtags ?? []).map((h) => h.replace(/^#/, '')).slice(0, 12);
  if (!out.fullCaption) {
    out.fullCaption = `${out.hook}\n\n${out.body}\n\n${out.cta}\n\n${out.hashtags
      .map((h) => `#${h}`)
      .join(' ')}\n\n${profile.websiteUrl}`;
  } else if (!out.fullCaption.includes(profile.websiteUrl)) {
    out.fullCaption = `${out.fullCaption}\n\n${profile.websiteUrl}`;
  }
  return out;
}

/** Generate an SEO-friendly blog draft. */
export async function generateBlog(
  profile: BusinessProfile,
  opts: { topic?: string; targetKeyword?: string } = {},
): Promise<GeneratedBlog> {
  const system = `You are an SEO content writer. Respond ONLY with JSON matching:
{
  "seoTitle": string,           // ≤60 chars
  "metaDescription": string,    // 140-160 chars
  "slug": string,               // url-safe kebab-case
  "contentMarkdown": string,    // 800-1200 word blog post in Markdown with H2/H3
  "headings": string[],         // ordered list of H2 headings
  "keywords": string[],         // 6-12 target keywords
  "internalLinks": string[],    // anchor text suggestions for internal linking
  "cta": string                 // closing CTA
}
Rules: Real, useful content. Cite no fake statistics. Avoid hype.`;

  const user = [
    'Brand brief:',
    brandBrief(profile),
    '',
    opts.topic ? `Topic: ${opts.topic}` : 'Pick a high-intent topic for this brand.',
    opts.targetKeyword ? `Primary keyword to rank for: ${opts.targetKeyword}` : '',
    '',
    'Write the blog now.',
  ]
    .filter(Boolean)
    .join('\n');

  const out = await jsonCompletion<GeneratedBlog>(system, user);
  out.slug = (out.slug || out.seoTitle || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return out;
}

/** Generate a daily SEO suggestion bundle. */
export async function generateSeoSuggestions(profile: BusinessProfile): Promise<GeneratedSeo> {
  const system = `You are an SEO consultant. Respond ONLY with JSON matching:
{
  "blogTitles": string[],          // 5 SEO-friendly blog title ideas
  "metaTitles": string[],          // 5 meta titles ≤60 chars
  "metaDescriptions": string[],    // 5 meta descriptions 140-160 chars
  "keywords": string[],            // 10-15 target keywords/long-tails
  "faqs": [{"q": string, "a": string}],  // 5 FAQs answering search intent
  "outreachMessages": string[],    // 3 polite, non-spammy backlink outreach messages (under 120 words each)
  "directories": string[],         // 8 reputable directories or platforms suitable for manual submission
  "notes": string                  // 2-4 sentences of strategic advice
}
Rules: NEVER suggest spam tactics, mass commenting, link farms, PBNs, or anything against Google guidelines.`;

  const user = ['Brand brief:', brandBrief(profile), '', 'Generate the SEO bundle now.'].join('\n');
  const out = await jsonCompletion<GeneratedSeo>(system, user);
  return out;
}
