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
  metaTitle?: string;
  metaDescription: string;
  slug: string;
  contentMarkdown: string;
  headings: string[];
  keywords: string[];
  /** Grouped clusters: [{ label, keywords: [] }] */
  keywordClusters?: { label: string; keywords: string[] }[];
  /** LSI / semantic keywords */
  semanticKeywords?: string[];
  /** FAQ schema-ready Q&A */
  faqs?: { q: string; a: string }[];
  internalLinks: string[];
  externalLinks?: string[];
  /** Flesch-style reading ease (0-100) */
  readabilityScore?: number;
  /** Composite SEO score (0-100) */
  seoScore?: number;
  improvementSuggestions?: string[];
  cta: string;
}

export interface CompetitorAiInsights {
  commonTopics: string[];
  postingFrequency: string;
  contentGaps: string[];
  contentIdeas: string[];
  recommendedTopics: string[];
  summary: string;
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

/** Generate an SEO-friendly blog draft (full AI SEO writer). */
export async function generateBlog(
  profile: BusinessProfile,
  opts: {
    topic?: string;
    targetKeyword?: string;
    targetAudience?: string;
    tone?: string;
    websiteUrl?: string;
  } = {},
): Promise<GeneratedBlog> {
  const system = `You are an SEO content writer and on-page SEO strategist. Respond ONLY with JSON matching:
{
  "seoTitle": string,                 // <=60 chars, the H1 / page title
  "metaTitle": string,                // <=60 chars, can match seoTitle
  "metaDescription": string,          // 140-160 chars
  "slug": string,                     // url-safe kebab-case
  "contentMarkdown": string,          // 1200-1800 word blog post in Markdown with H2/H3, intro, body, conclusion
  "headings": string[],               // ordered list of H2/H3 used
  "keywords": string[],               // 6-12 target keywords
  "keywordClusters": [                // 2-4 clusters
    { "label": string, "keywords": string[] }
  ],
  "semanticKeywords": string[],       // 10-20 LSI / semantic keywords
  "faqs": [                           // 4-6 FAQs (FAQ schema-ready)
    { "q": string, "a": string }
  ],
  "internalLinks": string[],          // 4-6 anchor text suggestions for internal linking on user's site
  "externalLinks": string[],          // 2-4 reputable external sources to cite (URL or anchor text)
  "readabilityScore": number,         // 0-100 estimate (Flesch ease style)
  "seoScore": number,                 // 0-100 composite of on-page best-practices
  "improvementSuggestions": string[], // 3-6 concrete improvements the user could make
  "cta": string                       // closing CTA tying back to the brand
}
Rules: Real, useful content. No fake statistics. No hype. No fabricated quotes. Recommend only legitimate, white-hat SEO practices.`;

  const user = [
    'Brand brief:',
    brandBrief(profile),
    '',
    opts.topic ? `Topic: ${opts.topic}` : 'Pick a high-intent topic for this brand.',
    opts.targetKeyword ? `Primary keyword to rank for: ${opts.targetKeyword}` : '',
    opts.targetAudience ? `Target audience override: ${opts.targetAudience}` : '',
    opts.tone ? `Tone override: ${opts.tone}` : '',
    opts.websiteUrl ? `Website to cross-link: ${opts.websiteUrl}` : '',
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
  // Defensive defaults
  out.keywordClusters = Array.isArray(out.keywordClusters) ? out.keywordClusters : [];
  out.semanticKeywords = Array.isArray(out.semanticKeywords) ? out.semanticKeywords : [];
  out.faqs = Array.isArray(out.faqs) ? out.faqs : [];
  out.externalLinks = Array.isArray(out.externalLinks) ? out.externalLinks : [];
  out.improvementSuggestions = Array.isArray(out.improvementSuggestions)
    ? out.improvementSuggestions
    : [];
  out.readabilityScore = typeof out.readabilityScore === 'number' ? Math.max(0, Math.min(100, Math.round(out.readabilityScore))) : undefined;
  out.seoScore = typeof out.seoScore === 'number' ? Math.max(0, Math.min(100, Math.round(out.seoScore))) : undefined;
  return out;
}

/** Generate AI insights about a competitor based on the URLs the user supplied. */
export async function generateCompetitorInsights(
  profile: BusinessProfile,
  competitor: {
    name: string;
    websiteUrl?: string | null;
    linkedinUrl?: string | null;
    twitterUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    notes?: string | null;
  },
): Promise<CompetitorAiInsights> {
  const system = `You are a competitive content strategist. Respond ONLY with JSON matching:
{
  "commonTopics": string[],         // 5-8 topics this competitor commonly posts about (best inference from their public profile descriptions)
  "postingFrequency": string,       // qualitative estimate, e.g. "3-4 posts/week on LinkedIn, daily on X"
  "contentGaps": string[],          // 4-6 topics they DON'T cover well (opportunities for the user)
  "contentIdeas": string[],         // 5-8 concrete content ideas the USER could create to differentiate
  "recommendedTopics": string[],    // 5-8 ranked recommended post topics for the user this month
  "summary": string                 // 2-3 sentence high-level take
}
Rules:
- You do NOT have live web access here; reason from the brand and competitor URL/social patterns to make educated, useful inferences.
- Never claim metrics you can't verify.
- Output is advice for the user's marketing team — actionable, specific, brand-relevant.`;

  const user = [
    'Our brand brief:',
    brandBrief(profile),
    '',
    'Competitor:',
    `Name: ${competitor.name}`,
    competitor.websiteUrl ? `Website: ${competitor.websiteUrl}` : '',
    competitor.linkedinUrl ? `LinkedIn: ${competitor.linkedinUrl}` : '',
    competitor.twitterUrl ? `X: ${competitor.twitterUrl}` : '',
    competitor.instagramUrl ? `Instagram: ${competitor.instagramUrl}` : '',
    competitor.facebookUrl ? `Facebook: ${competitor.facebookUrl}` : '',
    competitor.notes ? `Notes: ${competitor.notes}` : '',
    '',
    'Generate insights now.',
  ]
    .filter(Boolean)
    .join('\n');

  const out = await jsonCompletion<CompetitorAiInsights>(system, user);
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
