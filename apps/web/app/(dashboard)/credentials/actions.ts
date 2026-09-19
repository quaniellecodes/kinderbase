'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { uploadCredentialFile, deleteCredentialFile } from '@/lib/storage/credentials';
import { computeCredentialStatus, type CredentialType, CREDENTIAL_TYPE_LABELS } from '@kinderbase/types';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { logActivity } from '@/lib/activity';

export async function createCredential(formData: FormData): Promise<{ error: string } | void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Document is required' };
  if (file.size > 10 * 1024 * 1024) return { error: 'File must be under 10MB' };

  let storagePath: string;
  try {
    storagePath = await uploadCredentialFile(user.id, file);
  } catch {
    return { error: 'Upload failed. Please try again.' };
  }

  const expiresAt = formData.get('expires_at') as string;

  const { error } = await supabase.from('credentials').insert({
    user_id: user.id,
    credential_type: formData.get('credential_type') as CredentialType,
    custom_type_name: (formData.get('custom_type_name') as string) || null,
    issuing_org: formData.get('issuing_org') as string,
    issued_at: formData.get('issued_at') as string,
    expires_at: expiresAt || null,
    storage_path: storagePath,
    show_on_profile: formData.get('show_on_profile') === 'true',
  });

  if (error) {
    await deleteCredentialFile(storagePath).catch(() => null);
    return { error: error.message };
  }

  const active = getActiveContextFromCookies();
  if (active) {
    const credType = formData.get('credential_type') as CredentialType;
    const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single();
    await logActivity(active.centerId, 'credential.uploaded', {
      name: profile?.full_name ?? 'Staff',
      credential_type: CREDENTIAL_TYPE_LABELS[credType] ?? credType,
    });
  }

  revalidatePath('/credentials');
}

export async function deleteCredential(id: string, storagePath: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('credentials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  await supabase.from('credential_audit_logs').insert({
    credential_id: id,
    action: 'deleted',
    changed_by: user.id,
  });

  await deleteCredentialFile(storagePath).catch(() => null);
  revalidatePath("/credentials");
}

export async function toggleCredentialVisibility(id: string, showOnProfile: boolean): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('credentials')
    .update({ show_on_profile: showOnProfile })
    .eq('id', id)
    .eq('user_id', user.id);

  revalidatePath("/credentials");
}

export async function getCredentialSignedUrl(id: string): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('credentials')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return { error: 'Credential not found' };

  const { getCredentialSignedUrl: getUrl } = await import('@/lib/storage/credentials');
  try {
    const url = await getUrl(data.storage_path);
    return { url };
  } catch {
    return { error: 'Could not generate document link' };
  }
}

export async function getCredentials() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('credentials')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  return (data ?? []).map(c => ({
    ...c,
    status: computeCredentialStatus(c.expires_at),
  }));
}
