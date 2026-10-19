import 'server-only';
import { redactNames } from '@kinderbase/core';
import { getClock } from '@/lib/clock';
import { parentContext } from './principal';
import { domainMeta, friendlyGoal } from './elof-labels';

// The Progress tab (docs/PARENT-DECISIONS.md §2 + §3c), two views:
//   • Areas   — which ELOF domains got attention + what she's doing now. The bar is
//               the released-checkpoint level (ratings are hidden until release);
//               moments-this-month is honest about quiet areas. No scores/percentiles.
//   • Journey — the child's timeline: observations (each tagged to a goal), released
//               checkpoints, and where they started. Observations are live.
// All free text is scrubbed of other children's names before it leaves the server.

export type AreaDomain = {
  code: string;
  name: string;
  subtitle: string;
  icon: string;
  colour: string;
  level: number | null; // filled bands from the released checkpoint (1..levelMax), or null
  levelMax: number;
  now: string | null; // plain-language label of the most-recent observed goal
  momentsThisMonth: number;
  lastOn: string | null;
};
export type JourneyEntry =
  | { kind: 'observation'; id: string; on: string; author: string; body: string; goalLabel: string | null; icon: string; colour: string }
  | { kind: 'checkpoint'; id: string; on: string; label: string; author: string }
  | { kind: 'origin'; on: string; centerName: string; roomName: string; ageLabel: string };
export type ReleasedBanner = { id: string; label: string; author: string; releasedOn: string };
export type ParentProgress = {
  childFirst: string;
  monthsWithUs: number;
  momentCount: number;
  banner: ReleasedBanner | null;
  areas: AreaDomain[];
  journey: JourneyEntry[];
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthsBetween(fromIso: string | null | undefined, toIso: string): number | null {
  if (!fromIso) return null;
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}
function periodWord(label: string): string {
  return label.split(' ')[0] ?? label;
}
function ageAtLabel(birthdate: string | null, atIso: string): string {
  const m = monthsBetween(birthdate, atIso);
  if (m == null) return '';
  if (m < 24) return `${m} months old`;
  const y = Math.floor(m / 12);
  const mm = m % 12;
  return mm ? `${y} yr ${mm} mo` : `${y} years old`;
}

export async function getParentProgress(): Promise<ParentProgress | null> {
  const p = await parentContext();
  if (!p || p.childIds.length === 0) return null;
  const childId = p.activeChildId;
  const svc = p.service;

  const { data: child } = await svc
    .from('children')
    .select('first_name, preferred_name, birthdate, classroom_id, classrooms(name), centers(name)')
    .eq('id', childId)
    .maybeSingle();
  if (!child) return null;
  const childFirst = child.preferred_name ?? child.first_name;
  const roomName = (Array.isArray(child.classrooms) ? child.classrooms[0] : child.classrooms)?.name ?? '';
  const centerName = (Array.isArray(child.centers) ? child.centers[0] : child.centers)?.name ?? '';

  // Names to scrub from observation bodies (the room's other children).
  const { data: roommates } = child.classroom_id
    ? await svc.from('children').select('first_name, preferred_name').eq('classroom_id', child.classroom_id).neq('id', childId)
    : { data: [] as { first_name: string; preferred_name: string | null }[] };
  const otherNames = (roommates ?? []).flatMap((r) => [r.first_name, r.preferred_name]).filter((n): n is string => !!n);

  const now = getClock().now();
  const ageMonths = monthsBetween(child.birthdate, iso(now));
  const view = ageMonths != null && ageMonths < 36 ? 'infant_toddler' : 'preschool';

  // ELOF framework → domains for this view + a goal→domain lookup.
  const { data: fw } = await svc.from('frameworks').select('id').eq('is_system', true).is('center_id', null).eq('name', 'Head Start Early Learning Outcomes Framework').maybeSingle();
  const { data: domainRows } = fw ? await svc.from('framework_domains').select('code, sort_order').eq('framework_id', fw.id).eq('view', view).order('sort_order') : { data: [] as { code: string; sort_order: number }[] };
  const { data: goalRows } = fw ? await svc.from('framework_goals').select('id, code, framework_subdomains(framework_domains(code, view))').limit(2000) : { data: [] };
  const goalById = new Map<string, { code: string; domainCode: string }>();
  for (const g of goalRows ?? []) {
    const sd = Array.isArray(g.framework_subdomains) ? g.framework_subdomains[0] : g.framework_subdomains;
    const dm = sd ? (Array.isArray(sd.framework_domains) ? sd.framework_domains[0] : sd.framework_domains) : null;
    if (dm && dm.view === view) goalById.set(g.id as string, { code: g.code as string, domainCode: dm.code as string });
  }

  // Observations (live), newest first, scrubbed.
  const { data: obsRows } = await svc
    .from('observations')
    .select('id, body, observed_on, users(full_name)')
    .eq('child_id', childId)
    .is('deleted_at', null)
    .order('observed_on', { ascending: false })
    .limit(60);
  const obsIds = (obsRows ?? []).map((o) => o.id);
  const { data: ogRows } = obsIds.length ? await svc.from('observation_goals').select('observation_id, goal_id').in('observation_id', obsIds) : { data: [] as { observation_id: string; goal_id: string }[] };
  const goalByObs = new Map<string, string>();
  for (const og of ogRows ?? []) if (!goalByObs.has(og.observation_id)) goalByObs.set(og.observation_id, og.goal_id);

  const monthKey = iso(now).slice(0, 7);
  type DomStat = { momentsThisMonth: number; lastOn: string | null; nowGoalCode: string | null };
  const domStat = new Map<string, DomStat>();
  const journey: JourneyEntry[] = [];
  let momentCount = 0;
  for (const o of obsRows ?? []) {
    const g = goalByObs.has(o.id) ? goalById.get(goalByObs.get(o.id)!) : undefined;
    const meta = g ? domainMeta(g.domainCode) : null;
    const author = (Array.isArray(o.users) ? o.users[0] : o.users)?.full_name ?? 'Staff';
    journey.push({ kind: 'observation', id: o.id, on: o.observed_on, author, body: redactNames(o.body, otherNames), goalLabel: friendlyGoal(g?.code ?? null), icon: meta?.icon ?? '🌱', colour: meta?.colour ?? '#6b7280' });
    momentCount++;
    if (g) {
      const s = domStat.get(g.domainCode) ?? { momentsThisMonth: 0, lastOn: null, nowGoalCode: null };
      if (o.observed_on.slice(0, 7) === monthKey) s.momentsThisMonth++;
      if (!s.lastOn || o.observed_on > s.lastOn) {
        s.lastOn = o.observed_on;
        s.nowGoalCode = g.code;
      }
      domStat.set(g.domainCode, s);
    }
  }

  // Released checkpoints (ratings hidden until release) → journey markers + banner.
  const { data: cps } = await svc
    .from('checkpoints')
    .select('id, period_label, released_at, rated_by')
    .eq('child_id', childId)
    .not('released_at', 'is', null)
    .order('released_at', { ascending: false });
  const raterIds = [...new Set((cps ?? []).map((c) => c.rated_by).filter((x): x is string => !!x))];
  const { data: raters } = raterIds.length ? await svc.from('users').select('id, full_name').in('id', raterIds) : { data: [] as { id: string; full_name: string }[] };
  const raterName = new Map((raters ?? []).map((u) => [u.id, u.full_name]));
  const authorOf = (ratedBy: string | null) => (ratedBy && raterName.get(ratedBy)) || 'Your teacher';
  for (const c of cps ?? []) {
    if (!c.released_at) continue;
    journey.push({ kind: 'checkpoint', id: c.id, on: c.released_at.slice(0, 10), label: `${periodWord(c.period_label)} checkpoint`, author: authorOf(c.rated_by) });
  }
  const latest = (cps ?? [])[0];
  const banner: ReleasedBanner | null = latest?.released_at ? { id: latest.id, label: `${periodWord(latest.period_label)} checkpoint`, author: authorOf(latest.rated_by), releasedOn: latest.released_at.slice(0, 10) } : null;

  // Areas bars: per-domain average band from the latest released checkpoint.
  const levelByDomain = new Map<string, number>();
  if (latest) {
    const { data: ratings } = await svc.from('checkpoint_ratings').select('goal_id, rating_levels(level_number)').eq('checkpoint_id', latest.id);
    const acc = new Map<string, { sum: number; n: number }>();
    for (const r of ratings ?? []) {
      const g = goalById.get(r.goal_id);
      const lvl = (Array.isArray(r.rating_levels) ? r.rating_levels[0] : r.rating_levels)?.level_number;
      if (!g || lvl == null) continue;
      const a = acc.get(g.domainCode) ?? { sum: 0, n: 0 };
      a.sum += lvl;
      a.n++;
      acc.set(g.domainCode, a);
    }
    for (const [dc, a] of acc) levelByDomain.set(dc, Math.round(a.sum / a.n));
  }

  const areas: AreaDomain[] = (domainRows ?? []).map((d) => {
    const meta = domainMeta(d.code);
    const s = domStat.get(d.code);
    return {
      code: d.code,
      name: meta.name,
      subtitle: meta.subtitle,
      icon: meta.icon,
      colour: meta.colour,
      level: levelByDomain.get(d.code) ?? null,
      levelMax: 4,
      now: s?.nowGoalCode ? friendlyGoal(s.nowGoalCode) : null,
      momentsThisMonth: s?.momentsThisMonth ?? 0,
      lastOn: s?.lastOn ?? null,
    };
  });

  // Origin: the earliest enrollment ("Started at …").
  const { data: enr } = await svc.from('enrollments').select('starts_on, classrooms(name), centers(name)').eq('child_id', childId).order('starts_on', { ascending: true }).limit(1).maybeSingle();
  if (enr?.starts_on) {
    const r = (Array.isArray(enr.classrooms) ? enr.classrooms[0] : enr.classrooms)?.name ?? roomName;
    const cn = (Array.isArray(enr.centers) ? enr.centers[0] : enr.centers)?.name ?? centerName;
    journey.push({ kind: 'origin', on: enr.starts_on, centerName: cn, roomName: r, ageLabel: ageAtLabel(child.birthdate, enr.starts_on) });
  }
  journey.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));

  const monthsWithUs = enr?.starts_on ? monthsBetween(enr.starts_on, iso(now)) ?? 0 : 0;

  return { childFirst, monthsWithUs, momentCount, banner, areas, journey };
}
