'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin, computeCredentialStatus, childDisplayName, CREDENTIAL_TYPE_LABELS, type CredentialType } from '@kinderbase/types';

type Service = ReturnType<typeof createServiceClient>;

async function adminCtx(): Promise<{ service: Service; centerId: string } | null> {
  const active = getActiveContextFromCookies();
  if (!active || !isAdmin(active.role)) return null;
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return null;
  return { service: createServiceClient(), centerId: active.centerId };
}

// ── Drill-down: the credentials behind the "N expire this month" heads-up ─────
export type ExpiringCredential = { id: string; name: string; credential: string; issuer: string; expiresAt: string | null; expired: boolean };

export async function getExpiringCredentials(): Promise<ExpiringCredential[]> {
  const ctx = await adminCtx();
  if (!ctx) return [];
  const { service, centerId } = ctx;

  const { data: members } = await service.from('center_memberships').select('user_id').eq('center_id', centerId).is('left_at', null);
  const ids = [...new Set((members ?? []).map((m) => m.user_id))];
  if (!ids.length) return [];

  const { data: creds } = await service
    .from('credentials')
    .select('id, credential_type, custom_type_name, issuing_org, expires_at, users(full_name)')
    .in('user_id', ids)
    .is('deleted_at', null);

  const out: ExpiringCredential[] = [];
  for (const c of creds ?? []) {
    const status = computeCredentialStatus(c.expires_at);
    if (status !== 'expiring_soon' && status !== 'expired') continue;
    const u = Array.isArray(c.users) ? c.users[0] : c.users;
    const label = c.credential_type === 'other' && c.custom_type_name ? c.custom_type_name : CREDENTIAL_TYPE_LABELS[c.credential_type as CredentialType] ?? c.credential_type;
    out.push({ id: c.id, name: u?.full_name ?? 'Staff', credential: label, issuer: c.issuing_org, expiresAt: c.expires_at, expired: status === 'expired' });
  }
  // Already-expired / soonest first.
  out.sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
  return out;
}

// ── Drill-down: the students behind the "N documents missing" heads-up ────────
export type MissingDocument = { id: string; childId: string; name: string; room: string; doc: string };

type ChildEmbed = { first_name: string; last_name: string; center_id: string; classrooms: { name: string } | { name: string }[] | null } | null;

export async function getMissingDocuments(): Promise<MissingDocument[]> {
  const ctx = await adminCtx();
  if (!ctx) return [];
  const { service, centerId } = ctx;

  const { data: docs } = await service
    .from('student_documents')
    .select('id, doc_type, label, child_id, children(first_name, last_name, center_id, classrooms(name))')
    .eq('is_required', true)
    .eq('status', 'missing')
    .is('superseded_by', null);

  const out: MissingDocument[] = [];
  for (const d of docs ?? []) {
    const c = (Array.isArray(d.children) ? d.children[0] : d.children) as ChildEmbed;
    if (!c || c.center_id !== centerId) continue; // student_documents has no center_id → scope via the child
    const room = Array.isArray(c.classrooms) ? c.classrooms[0] : c.classrooms;
    out.push({ id: d.id, childId: d.child_id, name: childDisplayName({ first_name: c.first_name, last_name: c.last_name }), room: room?.name ?? '—', doc: d.label || d.doc_type });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
