import * as cheerio from 'cheerio';
import { getOpenAI, TEXT_MODEL } from '@/lib/openai';

export interface WebsiteSnapshot {
  url: string;
  title: string;
  description: string;
  headings: string[];
  bodySnippet: string;
}

export async function fetchWebsiteSnapshot(url: string): Promise<WebsiteSnapshot> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NextGenGrowthAgent/1.0 (+https://example.com)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Failed to fetch website: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || '').trim();
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().trim();
    if (t && headings.length < 25) headings.push(t);
  });
  // Take first ~1500 chars of visible body text
  $('script, style, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const bodySnippet = bodyText.slice(0, 1500);
  return { url, title, description, headings, bodySnippet };
}

/** Use the LLM to summarize the site into a tight brief used by the post generator. */
export async function summarizeWebsite(snap: WebsiteSnapshot): Promise<string> {
  const client = getOpenAI();
  const prompt = `You are an expert brand strategist. Summarize the following website into a concise brief (under 180 words) covering: (1) what the business offers, (2) who it's for, (3) tone and personality, (4) 5-8 likely content pillars.

URL: ${snap.url}
Title: ${snap.title}
Meta description: ${snap.description}
Headings: ${snap.headings.join(' | ')}
Body excerpt: ${snap.bodySnippet}`;
  const r = await client.chat.completions.create({
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
  });
  return r.choices[0]?.message?.content?.trim() ?? '';
}
