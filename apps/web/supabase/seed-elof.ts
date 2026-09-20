/**
 * KinderBase ELOF framework seeder — system reference data (not org-scoped).
 *
 * Loads the Head Start Early Learning Outcomes Framework content compiled
 * verbatim from official sources into `supabase/seed/elof/*.json` and inserts it
 * into the framework_* / goal_progressions / rating_levels tables (migration
 * 021). This is SYSTEM data: `is_system = true`, `center_id = null`, and it is
 * NOT touched by the org-scoped `--reset` in seed.ts.
 *
 * Idempotent: re-running deletes the existing system "Head Start ELOF" framework
 * (cascade removes its domains/subdomains/goals/progressions) plus the system
 * rating levels, then re-inserts. Safe to run repeatedly and against prod.
 *
 * Standalone:  pnpm dlx tsx apps/web/supabase/seed-elof.ts
 * Also invoked from seed.ts main() so a normal seed carries the framework.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or
 * apps/web/.env.local).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@kinderbase/types/database';

const FRAMEWORK_NAME = 'Head Start Early Learning Outcomes Framework';
const FRAMEWORK_PUBLISHER = 'Office of Head Start';

type Db = SupabaseClient<Database>;

type ProgressionJson = { band: string; descriptor: string | null; needs_review?: boolean };
type GoalJson = { code: string; text: string | null; progressions: ProgressionJson[] };
type SubdomainJson = { name: string; goals: GoalJson[] };
type DomainFileJson = {
  view: 'infant_toddler' | 'preschool';
  domain: { code: string; name: string };
  subdomains: SubdomainJson[];
  sources?: string[];
};

// ── System default rating scale (center_id null). Centers can override later. ──
const RATING_LEVELS: Array<{ level_number: number; label: string; color: string }> = [
  { level_number: 1, label: 'Not Yet', color: '#DC2626' },
  { level_number: 2, label: 'Emerging', color: '#D97706' },
  { level_number: 3, label: 'Meeting', color: '#16A34A' },
  { level_number: 4, label: 'Exceeding', color: '#2563EB' },
];

// ── "All About Me" default descriptors (center_id null system defaults). Keys
//    must match apps/web/lib/students/about.ts ABOUT_GROUPS. ─────────────────
const DEFAULT_DESCRIPTORS: Record<string, string[]> = {
  loves: ['Music & singing', 'Books & stories', 'Blocks', 'Animals', 'Outdoor play', 'Art & drawing', 'Dancing', 'Water play'],
  comfort: ['Pacifier', 'Favorite blanket', 'Stuffed animal', 'Rocking', 'Being held', 'Soft music', 'Dim lights'],
  sleep: ['Naps after lunch', 'Needs white noise', 'Sleeps with lovey', 'Back rubs to sleep', 'Short napper', 'Long napper'],
  eating: ['Good eater', 'Picky eater', 'Uses utensils', 'Still bottle-fed', 'Finger foods', 'Needs food cut small'],
  friends: ['Very social', 'Plays alongside others', 'Prefers one friend', 'Loves group play', 'Shy at first'],
  words: ['Potty = "potty"', 'Bottle = "ba-ba"', 'Grandma = "Nana"', 'Water = "wawa"'],
  dislikes: ['Loud noises', 'Sudden transitions', 'Getting hands messy', 'Bright lights', 'Large crowds'],
  routines: ['Hug goodbye at the door', 'Song before nap', 'Help with handwashing', 'Wave at the window'],
  family: ['Bilingual (Spanish)', 'Lives with grandparents', 'New sibling at home', 'Celebrates Kwanzaa'],
};

/** Map an ELOF infant/toddler age-band label to [min, max] months. Case-insensitive. */
function bandToMonths(band: string): { min: number; max: number; order: number } {
  const b = band.toLowerCase().replace(/\s+/g, ' ').trim();
  if (b.startsWith('birth to 9')) return { min: 0, max: 9, order: 0 };
  if (b.startsWith('8 to 18')) return { min: 8, max: 18, order: 1 };
  if (b.startsWith('16 to 36')) return { min: 16, max: 36, order: 2 };
  // Preschool bands (added later): "36 to 48 Months", "48 to 60 Months".
  if (b.startsWith('36 to 48')) return { min: 36, max: 48, order: 0 };
  if (b.startsWith('48 to 60')) return { min: 48, max: 60, order: 1 };
  throw new Error(`Unrecognized ELOF age band: "${band}"`);
}

function loadEnv(): { url: string; serviceKey: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const here = (() => {
      try {
        const d = (globalThis as unknown as { __dirname?: string }).__dirname;
        if (d) return d;
      } catch {
        /* ignore */
      }
      return resolve(process.cwd(), 'apps/web/supabase');
    })();
    const candidates = [
      resolve(process.cwd(), '.env.local'),
      resolve(process.cwd(), 'apps/web/.env.local'),
      resolve(here, '.env.local'),
      resolve(here, '../.env.local'),
    ];
    const envPath = candidates.find((p) => existsSync(p));
    if (envPath) {
      for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const val = m[2].replace(/^["']|["']$/g, '');
        if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL' && !url) url = val;
        if (m[1] === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceKey) serviceKey = val;
      }
    }
  }
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Set them in the environment or apps/web/.env.local.',
    );
  }
  return { url, serviceKey };
}

function elofDir(): string {
  const candidates = [
    resolve(process.cwd(), 'apps/web/supabase/seed/elof'),
    resolve(process.cwd(), 'supabase/seed/elof'),
    resolve(process.cwd(), 'seed/elof'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Could not locate seed/elof directory (looked in: ${candidates.join(', ')}).`);
  return found;
}

function loadDomainFiles(): DomainFileJson[] {
  const dir = elofDir();
  const files = readdirSync(dir)
    .filter((f) => /^(it|ps)-.*\.json$/.test(f))
    .sort();
  if (files.length === 0) throw new Error(`No ELOF domain files (it-*.json / ps-*.json) found in ${dir}.`);
  return files.map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as DomainFileJson);
}

/**
 * Seed (or re-seed) the Head Start ELOF framework and the system rating scale.
 * Idempotent: removes prior system rows first. Returns a small tally.
 */
export async function seedElof(db: Db): Promise<{
  domains: number;
  subdomains: number;
  goals: number;
  progressions: number;
  ratingLevels: number;
  descriptors: number;
}> {
  const domainFiles = loadDomainFiles();

  // ── Wipe prior system framework (cascade) + system rating levels ──
  const { data: existing } = await db
    .from('frameworks')
    .select('id')
    .eq('name', FRAMEWORK_NAME)
    .eq('is_system', true)
    .is('center_id', null);
  if (existing && existing.length > 0) {
    const { error } = await db
      .from('frameworks')
      .delete()
      .in('id', existing.map((r) => r.id));
    if (error) throw new Error(`Failed clearing existing ELOF framework: ${error.message}`);
  }
  {
    const { error } = await db.from('rating_levels').delete().is('center_id', null);
    if (error) throw new Error(`Failed clearing system rating levels: ${error.message}`);
  }
  {
    const { error } = await db.from('student_descriptors').delete().is('center_id', null);
    if (error) throw new Error(`Failed clearing system descriptors: ${error.message}`);
  }

  // ── Framework row ──
  const frameworkId = randomUUID();
  {
    const { error } = await db.from('frameworks').insert({
      id: frameworkId,
      name: FRAMEWORK_NAME,
      publisher: FRAMEWORK_PUBLISHER,
      version: '2015 (Ages Birth to Five)',
      is_licensed: false,
      is_system: true,
      center_id: null,
    });
    if (error) throw new Error(`Failed inserting framework: ${error.message}`);
  }

  // ── Build all child rows in memory, then bulk insert ──
  const domainRows: Database['public']['Tables']['framework_domains']['Insert'][] = [];
  const subdomainRows: Database['public']['Tables']['framework_subdomains']['Insert'][] = [];
  const goalRows: Database['public']['Tables']['framework_goals']['Insert'][] = [];
  const progressionRows: Database['public']['Tables']['goal_progressions']['Insert'][] = [];

  domainFiles.forEach((file, di) => {
    const domainId = randomUUID();
    domainRows.push({
      id: domainId,
      framework_id: frameworkId,
      view: file.view,
      code: file.domain.code,
      name: file.domain.name,
      sort_order: di,
    });
    file.subdomains.forEach((sd, si) => {
      const subdomainId = randomUUID();
      subdomainRows.push({ id: subdomainId, domain_id: domainId, name: sd.name, sort_order: si });
      sd.goals.forEach((goal, gi) => {
        const goalId = randomUUID();
        goalRows.push({
          id: goalId,
          subdomain_id: subdomainId,
          code: goal.code,
          goal_text: goal.text,
          sort_order: gi,
        });
        goal.progressions.forEach((pr) => {
          const { min, max, order } = bandToMonths(pr.band);
          const indicators = pr.descriptor ? pr.descriptor.split(' • ').map((s) => s.trim()).filter(Boolean) : null;
          progressionRows.push({
            goal_id: goalId,
            age_band_min_months: min,
            age_band_max_months: max,
            descriptor: pr.descriptor,
            indicators: indicators && indicators.length > 1 ? indicators : null,
            sort_order: order,
          });
        });
      });
    });
  });

  await insertChunked(db, 'framework_domains', domainRows);
  await insertChunked(db, 'framework_subdomains', subdomainRows);
  await insertChunked(db, 'framework_goals', goalRows);
  await insertChunked(db, 'goal_progressions', progressionRows);

  // ── System rating scale ──
  await insertChunked(
    db,
    'rating_levels',
    RATING_LEVELS.map((r) => ({
      center_id: null,
      level_number: r.level_number,
      label: r.label,
      color: r.color,
      sort_order: r.level_number,
    })),
  );

  // ── "All About Me" default descriptors (center_id null) ──
  const descriptorRows: Database['public']['Tables']['student_descriptors']['Insert'][] = [];
  for (const [group, labels] of Object.entries(DEFAULT_DESCRIPTORS)) {
    for (const label of labels) descriptorRows.push({ center_id: null, group_key: group, label });
  }
  await insertChunked(db, 'student_descriptors', descriptorRows);

  return {
    domains: domainRows.length,
    subdomains: subdomainRows.length,
    goals: goalRows.length,
    progressions: progressionRows.length,
    ratingLevels: RATING_LEVELS.length,
    descriptors: descriptorRows.length,
  };
}

async function insertChunked<T extends keyof Database['public']['Tables']>(
  db: Db,
  table: T,
  rows: Database['public']['Tables'][T]['Insert'][],
  chunk = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db.from(table).insert(slice as any);
    if (error) throw new Error(`insert into ${String(table)} failed: ${error.message}`);
  }
}

// ── CLI entry (only when run directly, not when imported by seed.ts) ──
async function main(): Promise<void> {
  const { url, serviceKey } = loadEnv();
  const db = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  console.log('Seeding Head Start ELOF framework (system reference data)…');
  const tally = await seedElof(db);
  console.log(
    `  ✓ ${tally.domains} domains, ${tally.subdomains} sub-domains, ${tally.goals} goals, ` +
      `${tally.progressions} progressions, ${tally.ratingLevels} rating levels, ${tally.descriptors} descriptors`,
  );
}

// Detect direct execution (tsx/node) vs import. import.meta.url is unavailable in
// the CJS transpile tsx uses here, so fall back to argv inspection.
const invokedDirectly = process.argv.some((a) => a.endsWith('seed-elof.ts'));
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
