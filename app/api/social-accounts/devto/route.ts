import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';
import { fetchDevtoUser } from '@/lib/publishers/devto';

const schema = z.object({ apiKey: z.string().min(20).max(120) });

export async function POST(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const { apiKey } = schema.parse(await req.json());
    const me = await fetchDevtoUser(apiKey);
    const account = await prisma.socialAccount.upsert({
      where: {
        userId_platform_externalId: { userId, platform: 'devto', externalId: String(me.id) },
      },
      create: {
        userId,
        platform: 'devto',
        externalId: String(me.id),
        name: `@${me.username}`,
        pictureUrl: me.profileImage ?? null,
        accessToken: apiKey,
        tokenExpiresAt: null,
        scopes: ['articles:write'],
      },
      update: {
        name: `@${me.username}`,
        pictureUrl: me.profileImage ?? null,
        accessToken: apiKey,
      },
    });
    return ok({ account: { id: account.id, name: account.name, platform: 'devto' } });
  } catch (e) {
    return fail(e);
  }
}
