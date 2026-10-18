import 'server-only';
import { parentContext } from './principal';
import { getOrgIconPublicUrl } from '@/lib/storage/org-icons';

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export type ParentChildOption = { id: string; name: string };
export type ParentShell = {
  childId: string;
  firstName: string;
  childName: string;
  centerId: string;
  centerName: string;
  brandRgb: string;
  iconUrl: string | null;
  childCount: number;
  /** All children this guardian may reach, for the switcher (empty while emulating). */
  children: ParentChildOption[];
  /** This person is also staff somewhere — offer "Switch to staff app". */
  hasStaff: boolean;
  /** Set when a director is emulating this family (Phase 6): read-only, bar shown. */
  emulated: boolean;
  emulatedLabel: string | null;
};

/**
 * The parent shell: the active child + the center's branding (name/logo/colour),
 * same source as kiosk branding (PARENT-DECISIONS §7). The active child comes from
 * the switcher cookie (principal.activeChildId); `children` lists all reachable
 * children for the switcher. Returns null for a non-guardian.
 */
export async function getParentShell(): Promise<ParentShell | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.activeChildId;
  const { data: child } = await p.service
    .from('children')
    .select('first_name, preferred_name, last_name, center_id, centers(name, organizations(primary_color, icon_path))')
    .eq('id', childId)
    .maybeSingle();
  if (!child) return null;

  const center = Array.isArray(child.centers) ? child.centers[0] : child.centers;
  const org = center?.organizations ? (Array.isArray(center.organizations) ? center.organizations[0] : center.organizations) : null;
  const color = (org as { primary_color: string } | null)?.primary_color ?? '#D35400';
  const iconPath = (org as { icon_path: string | null } | null)?.icon_path ?? null;
  const first = child.preferred_name ?? child.first_name;

  // Is this person also staff? (A teacher-parent gets a "Switch to staff" link; a
  // director emulating a family is NOT the person's own staff membership.)
  let hasStaff = false;
  if (!p.emulated) {
    const { data: m } = await p.service.from('center_memberships').select('id').eq('user_id', p.userId).is('left_at', null).limit(1);
    hasStaff = !!(m && m.length);
  }

  // The switcher's options — every reachable child. Emulation is single-child, so
  // no switcher there. Ordered by first name for a stable menu.
  let children: ParentChildOption[] = [];
  if (!p.emulated && p.childIds.length > 1) {
    const { data: kids } = await p.service.from('children').select('id, first_name, preferred_name').in('id', p.childIds);
    children = (kids ?? [])
      .map((k) => ({ id: k.id, name: k.preferred_name ?? k.first_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    childId,
    firstName: first,
    childName: `${first} ${child.last_name}`,
    centerId: child.center_id,
    centerName: (center as { name: string } | null)?.name ?? 'KinderBase',
    brandRgb: hexToRgb(color),
    iconUrl: iconPath ? getOrgIconPublicUrl(iconPath) : null,
    childCount: p.childIds.length,
    children,
    hasStaff,
    emulated: p.emulated,
    emulatedLabel: p.emulated ? p.emulatedLabel : null,
  };
}
