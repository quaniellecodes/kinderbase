import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { ActiveContext } from '@kinderbase/types';

const COOKIE_NAME = 'kb_active_context';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getActiveContext(request: NextRequest): ActiveContext | null {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveContext;
  } catch {
    return null;
  }
}

export function getActiveContextFromCookies(): ActiveContext | null {
  const cookieStore = cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveContext;
  } catch {
    return null;
  }
}

export async function setActiveContext(ctx: ActiveContext): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(ctx), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function clearActiveContext(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
