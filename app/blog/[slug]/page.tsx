import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createHash } from 'crypto';

export const revalidate = 0; // always fresh — we count views server-side
export const runtime = 'nodejs';

/**
 * Public read-only blog page. Tracks unique-per-day views in BlogView.
 * URL pattern: /blog/{slug} — slug is unique per user; we resolve by slug
 * across all users (first match wins). This is a tradeoff for the MVP — the
 * blog model has @@unique([userId, slug]). If multiple users picked the same
 * slug, we show the most recent.
 */
export default async function BlogPage({ params }: { params: { slug: string } }) {
  const blog = await prisma.blog.findFirst({
    where: { slug: params.slug },
    orderBy: { createdAt: 'desc' },
  });
  if (!blog) notFound();

  // Track view (best-effort)
  try {
    const h = headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const ipHash = createHash('sha256').update(`${ip}|${day}`).digest('hex').slice(0, 32);
    const ua = h.get('user-agent') ?? null;
    const ref = h.get('referer') ?? null;

    // Dedup: skip if same ipHash already viewed this blog today
    const existing = await prisma.blogView.findFirst({
      where: {
        blogId: blog.id,
        ipHash,
        createdAt: { gte: new Date(`${day}T00:00:00.000Z`) },
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.blogView.create({
        data: { blogId: blog.id, ipHash, userAgent: ua, referrer: ref },
      });
      await prisma.blog.update({
        where: { id: blog.id },
        data: { viewCount: { increment: 1 } },
      });
    }
  } catch {
    // never block render
  }

  return (
    <main className="min-h-screen bg-white">
      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-lg">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">{blog.seoTitle}</h1>
        <p className="text-gray-500 text-sm mb-8">
          {new Date(blog.createdAt).toLocaleDateString()} · {blog.viewCount + 1} views
        </p>
        {/* Render markdown as a simple <pre> — keeps deps minimal. */}
        <div
          className="whitespace-pre-wrap text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(blog.contentMarkdown) }}
        />
        {Array.isArray(blog.faqs) && (blog.faqs as any[]).length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold">FAQs</h2>
            {(blog.faqs as { q: string; a: string }[]).map((f, i) => (
              <details key={i} className="my-3 border border-gray-200 rounded-lg p-3">
                <summary className="font-medium cursor-pointer">{f.q}</summary>
                <p className="mt-2 text-gray-700">{f.a}</p>
              </details>
            ))}
          </section>
        )}
      </article>
    </main>
  );
}

function simpleMarkdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md)
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-700">$1</a>')
    .replace(/\n{2,}/g, '</p><p>');
  return `<p>${html}</p>`;
}
