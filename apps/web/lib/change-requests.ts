import 'server-only';
import type { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@kinderbase/types/database';

// The whitelist of profile changes a guardian may propose, with each change's
// severity (major changes — birthday, removing an allergy, authorizing a new pickup
// — are flagged to admins), whether it is family-capable, and the APPLY logic the
// approver runs.
//   • familyCapable false — applies to the one child (birthday, health, language).
//   • familyCapable true  — the parent MAY apply across the children they guard
//     (guardian contact, pickups), via the "apply to all my children" checkbox.
// Single source of truth shared by the parent request action and the admin decide
// action. Every apply is constrained to the requester's own children in the request's
// center (tenant isolation: the service client bypasses RLS and ids came from a
// client). A missing target throws rather than no-ops, so the approval never reports
// success when nothing was written.

type Service = ReturnType<typeof createServiceClient>;
export type Severity = 'normal' | 'major';
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
type FieldDef = { severity: Severity; familyCapable: boolean; apply: (ctx: ApplyCtx) => Promise<void> };

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
const GONE = 'That record no longer exists — ask the family to resubmit.';

export const CHANGE_FIELDS: Record<ChangeFieldKey, FieldDef> = {
  'guardian.mobile_phone': {
    severity: 'normal',
    familyCapable: true,
    apply: async ({ svc, row, childIds }) => {
      // Update this guardian's contact on the chosen children (same person).
      const { data: g, error } = await svc.from('guardians').select('app_user_id, full_name').eq('id', row.target_id ?? '').maybeSingle();
      if (error) throw new Error(error.message);
      if (!g) throw new Error(GONE);
      let q = svc.from('guardians').update({ mobile_phone: asText(row.apply_value) }).in('child_id', childIds);
      q = g.app_user_id ? q.eq('app_user_id', g.app_user_id) : q.eq('full_name', g.full_name);
      await must(q);
    },
  },
  'guardian.email': {
    severity: 'normal',
    familyCapable: true,
    apply: async ({ svc, row, childIds }) => {
      const { data: g, error } = await svc.from('guardians').select('app_user_id, full_name').eq('id', row.target_id ?? '').maybeSingle();
      if (error) throw new Error(error.message);
      if (!g) throw new Error(GONE);
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
      // Idempotent: only add the person to children who don't already have them, so a
      // re-approval (e.g. after a transient failure) can't duplicate a pickup record.
      const { data: existing, error: exErr } = await svc.from('authorized_pickups').select('child_id').in('child_id', childIds).eq('full_name', name);
      if (exErr) throw new Error(exErr.message);
      const have = new Set((existing ?? []).map((r) => r.child_id));
      const rows = childIds.filter((cid) => !have.has(cid)).map((cid) => ({ child_id: cid, full_name: name, relationship: v?.relationship?.trim() || null, phone: v?.phone?.trim() || null }));
      if (rows.length) await must(svc.from('authorized_pickups').insert(rows));
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
      const { data: t, error } = await svc.from('authorized_pickups').select('full_name').eq('id', row.target_id ?? '').maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error(GONE);
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
      const { data: pk, error } = await svc.from('authorized_pickups').select('full_name, phone').eq('id', row.target_id ?? '').maybeSingle();
      if (error) throw new Error(error.message);
      if (!pk) throw new Error(GONE);
      let q = svc.from('authorized_pickups').delete().in('child_id', childIds).eq('full_name', pk.full_name);
      q = pk.phone ? q.eq('phone', pk.phone) : q.is('phone', null);
      await must(q);
    },
  },
};

export function isChangeField(key: string): key is ChangeFieldKey {
  return key in CHANGE_FIELDS;
}
export function changeSeverity(key: ChangeFieldKey): Severity {
  return CHANGE_FIELDS[key].severity;
}

/**
 * The children a "to all my children" change may touch: the ones the REQUESTING
 * guardian guards IN THIS CENTER — never the whole family. So a parent with a child
 * in a different household (or a different center) can't affect a sibling a Center-A
 * admin never approved. Falls back to the single child.
 */
async function resolveRequesterChildIds(svc: Service, requestedBy: string | null, fallbackChildId: string, centerId: string): Promise<string[]> {
  if (!requestedBy) return [fallbackChildId];
  const { data, error } = await svc.from('guardians').select('child_id, children!inner(center_id)').eq('app_user_id', requestedBy).eq('children.center_id', centerId);
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((g) => g.child_id))];
  return ids.length ? ids : [fallbackChildId];
}

/** Apply an approved change — fans out to the requester's children (this center) only when chosen. */
export async function applyChangeRequest(svc: Service, row: ChangeRow, centerId: string): Promise<void> {
  if (!isChangeField(row.field_key)) throw new Error('Unknown field');
  const def = CHANGE_FIELDS[row.field_key];
  const applyToAll = def.familyCapable && row.apply_to_all;
  const childIds = applyToAll ? await resolveRequesterChildIds(svc, row.requested_by, row.child_id, centerId) : [row.child_id];
  await def.apply({ svc, row, childIds, applyToAll });
}
