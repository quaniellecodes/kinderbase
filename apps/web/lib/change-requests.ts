import 'server-only';
import type { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@kinderbase/types/database';

// The whitelist of profile fields a guardian may propose a change to, with each
// field's severity (major changes — birthday, removing an allergy — are flagged to
// admins) and the APPLY logic the approver runs. This is the single source of truth
// shared by the parent request action and the admin decide action. Every apply is
// constrained to the request's own child (tenant isolation; the service client
// bypasses RLS and the id came from a client).

type Service = ReturnType<typeof createServiceClient>;
export type ChangeFieldKey = 'guardian.mobile_phone' | 'guardian.email' | 'child.birthdate' | 'child.home_languages' | 'health.remove';

export type ChangeRow = { child_id: string; target_id: string | null; apply_value: Json | null };
type FieldDef = { severity: 'normal' | 'major'; apply: (svc: Service, row: ChangeRow) => Promise<void> };

async function must(p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(error.message);
}
function asText(v: Json | null): string | null {
  if (v == null) return null;
  return typeof v === 'string' ? v : String(v);
}
function asRequiredText(v: Json | null): string {
  const s = asText(v);
  if (s == null) throw new Error('A value is required');
  return s;
}
function asStringArray(v: Json | null): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export const CHANGE_FIELDS: Record<ChangeFieldKey, FieldDef> = {
  'guardian.mobile_phone': {
    severity: 'normal',
    apply: (svc, r) => must(svc.from('guardians').update({ mobile_phone: asText(r.apply_value) }).eq('id', r.target_id ?? '').eq('child_id', r.child_id)),
  },
  'guardian.email': {
    severity: 'normal',
    apply: (svc, r) => must(svc.from('guardians').update({ email: asText(r.apply_value) }).eq('id', r.target_id ?? '').eq('child_id', r.child_id)),
  },
  'child.birthdate': {
    severity: 'major',
    apply: (svc, r) => must(svc.from('children').update({ birthdate: asRequiredText(r.apply_value) }).eq('id', r.child_id)),
  },
  'child.home_languages': {
    severity: 'normal',
    apply: (svc, r) => must(svc.from('children').update({ home_languages: asStringArray(r.apply_value) }).eq('id', r.child_id)),
  },
  'health.remove': {
    severity: 'major',
    // student_health has no soft-delete column; the admin approval is the safeguard.
    apply: (svc, r) => must(svc.from('student_health').delete().eq('id', r.target_id ?? '').eq('child_id', r.child_id)),
  },
};

export function isChangeField(key: string): key is ChangeFieldKey {
  return key in CHANGE_FIELDS;
}
export function changeSeverity(key: ChangeFieldKey): 'normal' | 'major' {
  return CHANGE_FIELDS[key].severity;
}
