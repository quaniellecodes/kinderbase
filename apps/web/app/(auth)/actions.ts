'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });

  if (error) {
    return { error: error.message };
  }

  // Don't redirect() here: it triggers a soft RSC navigation whose prefetched
  // request doesn't carry the auth cookie this action just set, so the server
  // sees no session and bounces to /login (fixed only by a manual reload). The
  // client does a hard navigation instead so the fresh request carries the cookie.
  return { success: true as const };
}

export async function signup(formData: FormData) {
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: 'Check your email to confirm your account.' };
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
