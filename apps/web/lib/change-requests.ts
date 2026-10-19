import 'server-only';
import type { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@kinderbase/types/database';

// The whitelist of profile changes a guardian may propose, with each change's
// severity (major changes — birthday, removing an allergy, authorizing a new pickup
// — are flagged to admins), its SCOPE, and the APPLY logic the approver runs.
//   • scope 'child'  — applies to the one child (birthday, health, home language).
//   • scope 'family' — applies across ALL the family's children (guardian contact,
//     authorized pickups), because that data is shared between siblings.
// Single source of truth shared by the parent request action and the admin decide
// action. Every apply is constrained to the family's own children (tenant isolation:
// the service client bypasses RLS and ids came from a client).

type Service = ReturnType<typeof createServiceClient>;
export type ChangeFieldKey =
  | 'guardian.mobile_phone'
  | 'guardian.email'
  | 'child.birthdate'
  | 'child.home_languages'
  | 'health.remove'
  | 'pickup.add'
  | 'pickup.edit'
  | 'pickup.remove';

export type ChangeRow = { child_id: string; field_key: string; target_id: string | null; apply_value: Json | null; apply_to_all: boolean; requested_by: string | null };
type ApplyCtx = { svc: Service; row: ChangeRow; childIds: string[]; applyToAll: boolean };
// `familyCapable` = the parent MAY choose to apply this across all their children
// (a checkbox); when false the field is always child-only (birthday, health, …).
type FieldDef = { severity: 'normal' | 'major'; familyCapable: boolean; apply: (ctx: ApplyCtx) => Promise<void> };

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
    familyCapable: true,
    apply: async ({ svc, row, childIds }) => {
      // Update this guardian's contact on the chosen children (same person).
      const { data: g } = await svc.from('guardians').select('app_user_id, full_name').eq('id', row.target_id ?? '').maybeSingle();
      if (!g) return;
      let q = svc.from('guardians').update({ mobile_phone: asText(row.apply_value) }).in('child_id', childIds);
      q = g.app_user_id ? q.eq('app_user_id', g.app_user_id) : q.eq('full_name', g.full_name);
      await must(q);
    },
  },
  'guardian.email': {
    severity: 'normal',
    familyCapable: true,
    apply: async ({ svc, row, childIds }) => {
      const { data: g } = await svc.from('guardians').select('app_user_id, full_name').eq('id', row.target_id ?? '').maybeSingle();
      if (!g) return;
      let q = svc.from('guardians').update({ email: asText(row.apply_value) }).in('child_id', childIds);
      q = g.app_user_id ? q.eq('app_user_id', g.app_user_id) : q.eq('full_name', g.full_name);
      await must(q);
    },
  },
  'child.birthdate': {
    severity: 'major',
    familyCapable: false,
    apply: ({ svc, row }) => must(svc.from('children').update({ birthdate: asRequiredText(row.apply_value) }).eq('id', row.child_id)),
  },
  'child.home_languages': {
    severity: 'normal',
    familyCapable: false,
    apply: ({ svc, row }) => must(svc.from('children').update({ home_languages: asStringArray(row.apply_value) }).eq('id', row.child_id)),
  },
  'health.remove': {
    severity: 'major',
    familyCapable: false,
    // student_health has no soft-delete column; the admin approval is the safeguard.
    apply: ({ svc, row }) => must(svc.from('student_health').delete().eq('id', row.target_id ?? '').eq('child_id', row.child_id)),
  },
  'pickup.add': {
    severity: 'major', // authorizing a new person to collect a child is safety-critical
    familyCapable: true,
    apply: async ({ svc, row, childIds }) => {
      const v = (row.apply_value ?? null) as { full_name?: string; relationship?: string; phone?: string } | null;
      const name = v?.full_name?.trim();
      if (!name) throw new Error('A name is required');
      const rows = childIds.map((cid) => ({ child_id: cid, full_name: name, relationship: v?.relationship?.trim() || null, phone: v?.phone?.trim() || null }));
      await must(svc.from('authorized_pickups').insert(rows));
    },
  },
  'pickup.edit': {
    severity: 'normal',
    familyCapable: true,
    // Edits ONLY update existing authorizations — never adds this person to a child
    // they aren't already authorized on (matched by their existing name).
    apply: async ({ svc, row, childIds, applyToAll }) => {
      const v = (row.apply_value ?? null) as { relationship?: string; phone?: string } | null;
      const patch = { relationship: v?.relationship?.trim() || null, phone: v?.phone?.trim() || null };
      if (!applyToAll) {
        await must(svc.from('authorized_pickups').update(patch).eq('id', row.target_id ?? '').eq('child_id', row.child_id));
        return;
      }
      const { data: t } = await svc.from('authorized_pickups').select('full_name').eq('id', row.target_id ?? '').maybeSingle();
      if (!t) return;
      await must(svc.from('authorized_pickups').update(patch).in('child_id', childIds).eq('full_name', t.full_name));
    },
  },
  'pickup.remove': {
    severity: 'normal',
    familyCapable: true,
    apply: async ({ svc, row, childIds, applyToAll }) => {
      // "All children" removes this person everywhere (by name); otherwise just this row.
      if (!applyToAll) {
        await must(svc.from('authorized_pickups').delete().eq('id', row.target_id ?? '').eq('child_id', row.child_id));
        return;
      }
      const { data: pk } = await svc.from('authorized_pickups').select('full_name, phone').eq('id', row.target_id ?? '').maybeSingle();
      if (!pk) return;
      let q = svc.from('authorized_pickups').delete().in('child_id', childIds).eq('full_name', pk.full_name);
      q = pk.phone ? q.eq('phone', pk.phone) : q.is('phone', null);
      await must(q);
    },
  },
};

export function isChangeField(key: string): key is ChangeFieldKey {
  return key in CHANGE_FIELDS;
}
export function changeSeverity(key: ChangeFieldKey): 'normal' | 'major' {
  return CHANGE_FIELDS[key].severity;
}
export function isFamilyCapable(key: ChangeFieldKey): boolean {
  return CHANGE_FIELDS[key].familyCapable;
}

/**
 * The children a "to all my children" change may touch: the ones the REQUESTING
 * guardian actually guards — not the whole family. So a parent with a child in a
 * different household can never affect a sibling they don't manage. Falls back to
 * the single child.
 */
async function resolveRequesterChildIds(svc: Service, requestedBy: string | null, fallbackChildId: string): Promise<string[]> {
  if (!requestedBy) return [fallbackChildId];
  const { data } = await svc.from('guardians').select('child_id').eq('app_user_id', requestedBy);
  const ids = [...new Set((data ?? []).map((g) => g.child_id))];
  return ids.length ? ids : [fallbackChildId];
}

/** Apply an approved change — fans out to the requester's children only when chosen. */
export async function applyChangeRequest(svc: Service, row: ChangeRow): Promise<void> {
  if (!isChangeField(row.field_key)) throw new Error('Unknown field');
  const def = CHANGE_FIELDS[row.field_key];
  const applyToAll = def.familyCapable && row.apply_to_all;
  const childIds = applyToAll ? await resolveRequesterChildIds(svc, row.requested_by, row.child_id) : [row.child_id];
  await def.apply({ svc, row, childIds, applyToAll });
}
