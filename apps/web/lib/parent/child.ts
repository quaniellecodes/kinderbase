import 'server-only';
import { parentContext, hasPermission } from './principal';

// The Child & guardians tab (docs/PARENT-DECISIONS.md §17 Phase 1: child/guardian
// info + authorized pickups). A guardian with `edit_record` may PROPOSE changes
// (phone, email, birthday, home language, removing a health item) — each files a
// pending request an admin approves before it applies (see lib/change-requests.ts).
// Everything here is the viewer's OWN family, so no name-scrub is needed.
// Admin-only fields (custody notes, pickup restrictions) are deliberately omitted.

export type ChildGuardian = { id: string; name: string; relationship: string; email: string | null; phone: string | null; isPrimary: boolean; canPickup: boolean; canAccount: boolean; isYou: boolean };
export type ChildPickup = { id: string; name: string; relationship: string | null; phone: string | null };
export type ChildHealth = { id: string; kind: string; name: string; detail: string | null; severity: string | null };
/** Open change requests, keyed `${field_key}:${target_id ?? ''}` → the pending badge. */
export type PendingMap = Record<string, { id: string; label: string; severity: string }>;
/** Pending "add a pickup person" requests (no existing row to attach a badge to). */
export type PendingAdd = { id: string; display: string };
export type ParentChild = {
  childName: string;
  firstName: string;
  room: string;
  ageLabel: string | null;
  birthdayLabel: string | null;
  birthdateIso: string | null;
  enrollmentStatus: string;
  languages: string[];
  scheduleDays: string[];
  dropoff: string | null;
  pickup: string | null;
  guardians: ChildGuardian[];
  pickups: ChildPickup[];
  health: ChildHealth[];
  canEdit: boolean;
  hasSiblings: boolean;
  pending: PendingMap;
  pendingPickupAdds: PendingAdd[];
};

const DOW = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // ISO: 1=Mon … 7=Sun

function ageLabel(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const b = new Date(`${birthdate}T12:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yr ${m} mo` : `${y} yr`;
}

export async function getParentChild(): Promise<ParentChild | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.activeChildId;
  const svc = p.service;

  const { data: child } = await svc
    .from('children')
    .select('first_name, preferred_name, last_name, birthdate, enrollment_status, home_languages, classroom_id, classrooms(name)')
    .eq('id', childId)
    .maybeSingle();
  if (!child) return null;
  const firstName = child.preferred_name ?? child.first_name;
  const room = (Array.isArray(child.classrooms) ? child.classrooms[0] : child.classrooms)?.name ?? '';
  const birthdayLabel = child.birthdate ? new Date(`${child.birthdate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;

  const { data: gs } = await svc
    .from('guardians')
    .select('id, full_name, relationship, email, mobile_phone, work_phone, is_primary, permissions, app_user_id, sort_order')
    .eq('child_id', childId)
    .order('is_primary', { ascending: false })
    .order('sort_order');
  const guardians: ChildGuardian[] = (gs ?? []).map((g) => ({
    id: g.id,
    name: g.full_name,
    relationship: g.relationship,
    email: g.email,
    phone: g.mobile_phone ?? g.work_phone,
    isPrimary: g.is_primary,
    canPickup: (g.permissions ?? []).includes('pickup'),
    canAccount: (g.permissions ?? []).includes('account'),
    isYou: g.app_user_id === p.userId,
  }));

  const { data: ap } = await svc.from('authorized_pickups').select('id, full_name, relationship, phone').eq('child_id', childId).order('created_at');
  const pickups: ChildPickup[] = (ap ?? []).map((a) => ({ id: a.id, name: a.full_name, relationship: a.relationship, phone: a.phone }));

  const { data: sh } = await svc.from('student_health').select('id, kind, name, detail, severity').eq('child_id', childId).order('created_at');
  const health: ChildHealth[] = (sh ?? []).map((h) => ({ id: h.id, kind: h.kind, name: h.name, detail: h.detail, severity: h.severity }));

  const { data: sched } = await svc.from('student_schedule').select('days, dropoff_window, pickup_window').eq('child_id', childId).maybeSingle();
  const dayNums = (sched?.days as { days?: number[] } | null)?.days ?? [];
  const scheduleDays = dayNums.filter((n) => n >= 1 && n <= 7).map((n) => DOW[n]!);

  // Open change requests → the "pending review" badges. Pickup ADDs have no existing
  // row to badge, so they surface as their own list.
  const { data: reqs } = await svc.from('change_requests').select('id, field_key, target_id, label, severity, new_value').eq('child_id', childId).eq('status', 'pending');
  const pending: PendingMap = {};
  const pendingPickupAdds: PendingAdd[] = [];
  for (const r of reqs ?? []) {
    if (r.field_key === 'pickup.add') pendingPickupAdds.push({ id: r.id, display: r.new_value ?? r.label });
    else pending[`${r.field_key}:${r.target_id ?? ''}`] = { id: r.id, label: r.label, severity: r.severity };
  }

  return {
    childName: `${firstName} ${child.last_name}`.trim(),
    firstName,
    room,
    ageLabel: ageLabel(child.birthdate),
    birthdayLabel,
    birthdateIso: child.birthdate ?? null,
    enrollmentStatus: child.enrollment_status,
    languages: child.home_languages ?? [],
    scheduleDays,
    dropoff: sched?.dropoff_window ?? null,
    pickup: sched?.pickup_window ?? null,
    guardians,
    pickups,
    health,
    canEdit: hasPermission(p, childId, 'edit_record'),
    hasSiblings: p.childIds.length > 1,
    pending,
    pendingPickupAdds,
  };
}
