import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, bad, fail } from '@/lib/api-utils';

export async function GET() {
  const { userId, error } = await requireUser();
  if (error) return error;
  const accounts = await prisma.socialAccount.findMany({
    where: { userId },
    orderBy: { connectedAt: 'desc' },
  });
  // Never return raw access tokens to the client
  return ok({
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      externalId: a.externalId,
      name: a.name,
      pictureUrl: a.pictureUrl,
      tokenExpiresAt: a.tokenExpiresAt,
      scopes: a.scopes,
      connectedAt: a.connectedAt,
    })),
  });
}

const deleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  const { userId, error } = await requireUser();
  if (error) return error;
  try {
    const { id } = deleteSchema.parse(await req.json());
    const acc = await prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!acc) return bad('Not found', 404);
    await prisma.socialAccount.delete({ where: { id: acc.id } });
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
