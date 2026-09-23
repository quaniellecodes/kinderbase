/**
 * Maryland COMAR 13A.16 staffing engine (docs/DECISIONS.md §3, docs/sessions/01-ENGINE.md).
 *
 * Pure functions — no database, no clock access. Everything is passed in. This
 * is the compliance brain behind the mobile app's ratio pills, break checks,
 * and age-mix suggestions.
 *
 * ⚠ Age bands (18/24/36/60 mo) and the §D(1) reading (4+ toddlers → 3 staff) are
 * per DECISIONS §3 and must be confirmed with an OCC licensing specialist before
 * partner demos — this engine actively tells staff whether a break is legal.
 */

export const COMAR_VERSION = '13A.16 — 2025';

export type Band = 'infant' | 'toddler' | 'two' | 'preschool' | 'school';

export const BAND_LABEL: Record<Band, string> = {
  infant: 'infant',
  toddler: 'toddler',
  two: '2-year-old',
  preschool: 'preschooler',
  school: 'school-ager',
};

// Center age-band cutoffs in months (COMAR 13A.16.01.02). Infant→toddler at 18,
// NOT the 12-month family-childcare cutoff.
const CUTOFFS: { months: number; band: Band }[] = [
  { months: 18, band: 'toddler' },
  { months: 24, band: 'two' },
  { months: 36, band: 'preschool' },
  { months: 60, band: 'school' },
];

/** Whole months from dob to `at` (calendar months, day-adjusted). */
export function ageInMonthsAt(dob: Date, at: Date): number {
  let m = (at.getFullYear() - dob.getFullYear()) * 12 + (at.getMonth() - dob.getMonth());
  if (at.getDate() < dob.getDate()) m--;
  return Math.max(0, m);
}

export function bandFor(dob: Date, at: Date): Band {
  const mo = ageInMonthsAt(dob, at);
  if (mo < 18) return 'infant';
  if (mo < 24) return 'toddler';
  if (mo < 36) return 'two';
  if (mo < 60) return 'preschool';
  return 'school';
}

export interface Child {
  id: string;
  dob: Date;
}
export interface Staff {
  id: string;
  leadQualified: boolean;
  infantToddlerTrained: boolean;
}
export interface RoomInput {
  children: Child[];
  staff: Staff[];
  napState: 'awake' | 'settling' | 'resting';
  at: Date;
}

export interface GoverningRule {
  name: string;
  citation: string;
  ratio: number | null; // null for §D(1) table rows (min-staff, not a ratio)
  maxGroup: number;
  minStaff: number;
  maxTwos?: number; // §D(2) groups of 13–20
  hasUnderTwo: boolean;
}

export interface Check {
  key: 'size' | 'staff' | 'lead' | 'nap';
  pass: boolean;
  message: string;
}

export interface Evaluation {
  ok: boolean;
  status: 'ok' | 'at_minimum' | 'out';
  mix: Record<Band, number>;
  rule: GoverningRule;
  requiredNow: number;
  leadsPresent: string[];
  checks: Check[];
}

export function emptyMix(): Record<Band, number> {
  return { infant: 0, toddler: 0, two: 0, preschool: 0, school: 0 };
}
function mixOf(children: Child[], at: Date): Record<Band, number> {
  const m = emptyMix();
  for (const c of children) m[bandFor(c.dob, at)]++;
  return m;
}
export function mixText(mix: Record<Band, number>): string {
  const parts = (Object.keys(mix) as Band[])
    .filter((b) => mix[b] > 0)
    .map((b) => `${mix[b]} ${BAND_LABEL[b]}${mix[b] > 1 ? 's' : ''}`);
  return parts.join(', ') || 'no children';
}

const C = 'COMAR 13A.16.08.03';

/** The rule that governs a given age mix. Mirrors DECISIONS §3 exactly. */
export function governingRule(mix: Record<Band, number>): GoverningRule {
  const { infant: inf, toddler: tod, two, preschool: pre, school: sch } = mix;
  const n = inf + tod + two + pre + sch;
  const hasUnderTwo = inf + tod > 0;
  if (n === 0) return { name: 'No children present', citation: '—', ratio: null, maxGroup: 99, minStaff: 0, hasUnderTwo: false };

  const u2 = inf + tod;

  // ── §C same-age (and infant+toddler) groups ──
  if (u2 === n) {
    // only infants / only toddlers / infants+toddlers
    if (!tod) return { name: 'Infants', citation: `${C}C(1)`, ratio: 3, maxGroup: 6, minStaff: Math.ceil(n / 3), hasUnderTwo: true };
    if (!inf) return { name: 'Toddlers', citation: `${C}C(1)`, ratio: 3, maxGroup: 9, minStaff: Math.ceil(n / 3), hasUnderTwo: true };
    const maxGroup = inf <= 2 ? 9 : 6;
    return { name: `Infants & toddlers (${inf <= 2 ? '1–2' : '3+'} infants)`, citation: `${C}C(1)`, ratio: 3, maxGroup, minStaff: Math.ceil(n / 3), hasUnderTwo: true };
  }

  // ── §D(1) mixed groups containing infants or toddlers ──
  if (u2 > 0) {
    const rows: { t: string; max: number; min: number }[] = [];
    if (inf >= 1 && inf <= 2) rows.push({ t: '1–2 infants', max: 9, min: 2 });
    if (inf >= 3) rows.push({ t: '3+ infants', max: 6, min: 2 });
    if (tod >= 1 && tod <= 2) rows.push({ t: '1–2 toddlers', max: 12, min: 2 });
    if (tod === 3) rows.push({ t: '3 toddlers', max: 9, min: 2 });
    if (tod >= 4) rows.push({ t: '4+ toddlers', max: 9, min: 3 });
    if (!inf && tod >= 1 && tod <= 2 && two >= 6) rows.push({ t: '1–2 toddlers + 6+ twos', max: 12, min: 3 });
    // Strictest row: highest min-staff and lowest max-group.
    const minStaff = Math.max(...rows.map((r) => r.min));
    const maxGroup = Math.min(...rows.map((r) => r.max));
    const binding = rows.find((r) => r.min === minStaff) ?? rows[0]!;
    return { name: `Mixed ages — ${binding.t}`, citation: `${C}D(1)`, ratio: null, maxGroup, minStaff, hasUnderTwo: true };
  }

  // ── all 2+ ──
  if (!pre && !sch) return { name: 'Two-year-olds', citation: `${C}C(2)`, ratio: 6, maxGroup: 12, minStaff: Math.ceil(n / 6), hasUnderTwo: false };
  if (!two && !sch) return { name: '3–4 year-olds', citation: `${C}C(2)`, ratio: 10, maxGroup: 20, minStaff: Math.ceil(n / 10), hasUnderTwo: false };
  if (!two && !pre) return { name: '5 and older', citation: `${C}C(2)`, ratio: 15, maxGroup: 30, minStaff: Math.ceil(n / 15), hasUnderTwo: false };
  if (two) return { name: 'Mixed ages with preschoolers', citation: `${C}D(2)`, ratio: 10, maxGroup: 20, minStaff: Math.ceil(n / 10), maxTwos: n >= 13 ? 6 : undefined, hasUnderTwo: false };
  return { name: 'Preschool & school-age mix', citation: `${C}D(3)`, ratio: 10, maxGroup: 20, minStaff: Math.ceil(n / 10), hasUnderTwo: false };
}

/** Is this staff member lead-qualified for a group with/without under-2s? */
export function isLeadFor(staff: Staff, hasUnderTwo: boolean): boolean {
  return staff.leadQualified && (!hasUnderTwo || staff.infantToddlerTrained);
}

export function evaluate(room: RoomInput): Evaluation {
  const mix = mixOf(room.children, room.at);
  const rule = governingRule(mix);
  const n = room.children.length;
  const hasUnderTwo = rule.hasUnderTwo;
  const leads = room.staff.filter((s) => isLeadFor(s, hasUnderTwo)).map((s) => s.id);

  // Nap reduction: to 1 only when every child is 2+ AND resting quietly.
  const napReduced = room.napState === 'resting' && !hasUnderTwo && n > 0;
  const requiredNow = napReduced ? Math.min(1, n) : rule.minStaff;

  const sizeOk = n <= rule.maxGroup && (rule.maxTwos == null || mix.two <= rule.maxTwos);
  const staffOk = room.staff.length >= requiredNow;
  // Lead waived only when resting quietly in an all-2+ group (teacher OR aide may hold).
  const leadWaived = napReduced;
  const leadOk = n === 0 ? true : leadWaived ? true : leads.length >= 1;

  const checks: Check[] = [
    {
      key: 'size',
      pass: sizeOk,
      message: sizeOk
        ? `${n} of max ${rule.maxGroup}${rule.maxTwos != null ? ` · ${mix.two} of max ${rule.maxTwos} two-year-olds` : ''}`
        : n > rule.maxGroup
          ? `${n} children exceeds the max group of ${rule.maxGroup}`
          : `${mix.two} two-year-olds — max ${rule.maxTwos} in a group of 13–20`,
    },
    {
      key: 'staff',
      pass: staffOk,
      message: `${room.staff.length} present · ${requiredNow} required${napReduced ? ' (reduced — all resting quietly)' : ''}`,
    },
    {
      key: 'lead',
      pass: leadOk,
      message: leadWaived
        ? 'Resting quietly — a teacher or aide may hold the room'
        : leads.length
          ? `${leads.length} lead-qualified present`
          : 'No lead-qualified teacher present — aides must work under a lead',
    },
    {
      key: 'nap',
      pass: true,
      message: hasUnderTwo
        ? 'Children under 2 — full ratio holds through nap, no reduction (13A.16.08.08A)'
        : napReduced
          ? 'All resting quietly — others may step out but stay on premises within hearing range (.08B)'
          : 'Full ratio until every child is resting quietly (.08B)',
    },
  ];

  const ok = sizeOk && staffOk && leadOk;
  const status: Evaluation['status'] = !ok ? 'out' : room.staff.length <= requiredNow ? 'at_minimum' : 'ok';
  return { ok, status, mix, rule, requiredNow, leadsPresent: leads, checks };
}

/** Remove one staff member and re-check. Reasons are plain English. */
export function canStepOut(room: RoomInput, staffId: string): { allowed: boolean; reasons: string[]; hint: string } {
  const remaining = room.staff.filter((s) => s.id !== staffId);
  const after = evaluate({ ...room, staff: remaining });
  const reasons: string[] = [];
  for (const c of after.checks) {
    if (c.pass) continue;
    if (c.key === 'staff') reasons.push(`Only ${remaining.length} would remain — ${after.requiredNow} required for ${mixText(after.mix)}`);
    else if (c.key === 'lead') {
      const who = remaining.map((s) => `${s.id} is an Aide`).join(', ');
      reasons.push(`No lead teacher would remain${who ? ` — ${who}` : ''}`);
    } else if (c.key === 'size') reasons.push(c.message);
  }
  const hasUnderTwo = after.rule.hasUnderTwo || evaluate(room).rule.hasUnderTwo;
  const hint = after.ok
    ? ''
    : hasUnderTwo
      ? 'This group has children under 2, so full ratio holds at all times — including nap. A replacement has to be in the room first.'
      : room.napState !== 'resting'
        ? 'Once every child is resting quietly, one teacher or aide can hold the room and others may step out.'
        : 'Bring a replacement into the room first.';
  return { allowed: after.ok, reasons, hint };
}

/** The soonest child to cross a band boundary within `withinDays`, and how the rule changes. */
export function nextAgeTransition(
  room: RoomInput,
  withinDays = 45,
): { childId: string; inDays: number; to: Band; before: GoverningRule; after: GoverningRule } | null {
  const before = governingRule(mixOf(room.children, room.at));
  let best: { childId: string; inDays: number; to: Band } | null = null;
  for (const c of room.children) {
    const mo = ageInMonthsAt(c.dob, room.at);
    const next = CUTOFFS.find((x) => x.months > mo);
    if (!next) continue;
    const boundary = new Date(c.dob);
    boundary.setMonth(boundary.getMonth() + next.months);
    const inDays = Math.ceil((boundary.getTime() - room.at.getTime()) / 86_400_000);
    if (inDays > 0 && inDays <= withinDays && (!best || inDays < best.inDays)) best = { childId: c.id, inDays, to: next.band };
  }
  if (!best) return null;
  const futureMix = mixOf(room.children, new Date(room.at.getTime() + best.inDays * 86_400_000));
  const after = governingRule(futureMix);
  return { ...best, before, after };
}

/** Suggest moving the 2+ children out of an under-2 mixed group to relax its min-staff. */
export function suggestAgeMixFix(
  source: RoomInput,
  others: Record<string, RoomInput>,
): { move: string[]; to: string; minStaffBefore: number; minStaffAfter: number } | null {
  const src = evaluate(source);
  if (!src.rule.hasUnderTwo) return null;
  const movers = source.children.filter((c) => {
    const b = bandFor(c.dob, source.at);
    return b === 'two' || b === 'preschool' || b === 'school';
  });
  if (!movers.length || movers.length === source.children.length) return null;
  const sourceAfter = evaluate({ ...source, children: source.children.filter((c) => !movers.includes(c)) });
  if (sourceAfter.rule.minStaff >= src.rule.minStaff) return null;

  for (const [key, target] of Object.entries(others)) {
    const merged = evaluate({ ...target, children: [...target.children, ...movers] });
    if (merged.ok && !merged.rule.hasUnderTwo) {
      return { move: movers.map((c) => c.id), to: key, minStaffBefore: src.rule.minStaff, minStaffAfter: sourceAfter.rule.minStaff };
    }
  }
  return null;
}
