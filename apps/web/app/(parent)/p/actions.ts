'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parentContext, assertReachable, ACTIVE_CHILD_COOKIE } from '@/lib/parent/principal';

// Multi-child switcher (PARENT-DECISIONS §1). Setting the active child is a cookie
// write, so it must happen in a Server Action, not a layout. We verify the child is
// actually reachable by this guardian before trusting the id from the client.
export async function switchChild(childId: string): Promise<void> {
  const p = await parentContext();
  if (!p) throw new Error('Not found');
  if (p.emulated) throw new Error('Emulation is single-child'); // never override the emulated child
  assertReachable(p, childId); // throws "Not found" for a child this guardian can't reach

  cookies().set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/p', 'layout');
}
