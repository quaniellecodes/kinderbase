'use server';

import { revalidatePath } from 'next/cache';
import { setActiveContext, clearActiveContext } from '@/lib/session/active-context';
import { setNativeActiveContext } from '@/lib/mobile/capacitor';
import type { ActiveContext } from '@kinderbase/types';

export async function switchActiveContext(ctx: ActiveContext) {
  await setActiveContext(ctx);
  revalidatePath('/dashboard', 'layout');
}

export async function signOut() {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();
  await supabase.auth.signOut();
  await clearActiveContext();
}
