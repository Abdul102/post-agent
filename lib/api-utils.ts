import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return { userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { userId, error: null };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  return NextResponse.json({ error: message }, { status: 500 });
}

export function cn(...parts: (string | undefined | false | null)[]) {
  return parts.filter(Boolean).join(' ');
}
