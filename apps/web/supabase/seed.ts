/**
 * KinderBase sandbox seed — produces a realistic center at configurable scale.
 *
 * Targets the ACTUAL implemented schema (packages/types/database.ts + migrations
 * 001–011), which has diverged from the project brief in documented ways:
 *   - credential `status` is computed in TS (no generated column)
 *   - `activity_log` (center-scoped event stream), not `activity_posts`
 *   - branding lives on `organizations` (primary_color/icon_path); `kiosk_pin` on `users`
 *   - `staffing_patterns` is a (day_of_week, hour, staff_count) grid
 *   - no classroom_staff / leave_requests / ratio_logs / center_branding / kiosk_settings tables
 *
 * Everything it creates is namespaced under one organization slug and an email
 * domain (default `@sandbox.kb`), so `--reset` can wipe it without touching real
 * data. Uses the service-role key (bypasses RLS; creates auth.users via admin API).
 *
 * Run (no install needed):
 *   pnpm dlx tsx apps/web/supabase/seed.ts --scale medium
 *   pnpm dlx tsx apps/web/supabase/seed.ts --scale large --reset --yes
 *   pnpm dlx tsx apps/web/supabase/seed.ts --centers 2 --capacity 80 --days 21 --seed demo
 *
 * Or, after `pnpm install` (tsx is a devDependency): `pnpm --filter @kinderbase/web seed`.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment or in apps/web/.env.local.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@kinderbase/types/database';
import { seedElof } from './seed-elof';

// ── Local mirrors of shared unions (types are erased at runtime; kept here so the
//    script is self-contained and never resolves workspace code at runtime) ──────
type AgeGroup = 'infant' | 'toddler' | 'two_year' | 'preschool' | 'school_age';
type CenterRole =
  | 'director'
  | 'admin'
  | 'lead_teacher'
  | 'assistant_teacher'
  | 'aide'
  | 'substitute';
type CredentialType =
  | 'preschool_90hr'
  | 'infant_toddler_9hr'
  | 'communication_9hr'
  | 'ada_training'
  | 'first_aid_cpr'
  | 'child_abuse_prevention'
  | 'medication_administration'
  | 'cda'
  | 'directors_certification'
  | 'college_degree'
  | 'other';

// Maryland COMAR 13A.16 ratios — mirror of packages/core/staffing-engine.ts RATIO_RULES.
const RATIO_RULES: Record<AgeGroup, { childrenPerStaff: number; maxGroupSize: number }> = {
  infant: { childrenPerStaff: 3, maxGroupSize: 6 },
  toddler: { childrenPerStaff: 3, maxGroupSize: 6 },
  two_year: { childrenPerStaff: 6, maxGroupSize: 12 },
  preschool: { childrenPerStaff: 10, maxGroupSize: 20 },
  school_age: { childrenPerStaff: 15, maxGroupSize: 30 },
};

// A center is built by laying down rooms from this template in order until the
// licensed capacity is filled (the last room is trimmed to fit the remainder).
const ROOM_TEMPLATE: Array<{ label: string; ageGroup: AgeGroup; capacity: number }> = [
  { label: 'Infant Room', ageGroup: 'infant', capacity: 8 },
  { label: 'Toddler Room', ageGroup: 'toddler', capacity: 12 },
  { label: 'Twos Room', ageGroup: 'two_year', capacity: 12 },
  { label: 'Preschool Room', ageGroup: 'preschool', capacity: 20 },
  { label: 'Pre-K Room', ageGroup: 'preschool', capacity: 20 },
  { label: 'School Age Room', ageGroup: 'school_age', capacity: 26 },
];

type CenterSpec = { name: string; capacity: number; address: string; occRegion: string };

const REAL_CENTERS: CenterSpec[] = [
  {
    name: 'Old Mother Hubbard Child Care Center',
    capacity: 130,
    address: '2100 Liberty Heights Ave, Baltimore, MD 21217',
    occRegion: 'Baltimore City',
  },
  {
    name: 'Bounce Playhouse',
    capacity: 122,
    address: '815 W North Ave, Baltimore, MD 21217',
    occRegion: 'Baltimore City',
  },
  {
    name: 'Old Mother Hubbard Daycare',
    capacity: 27,
    address: '3600 Reisterstown Rd, Baltimore, MD 21215',
    occRegion: 'Baltimore City',
  },
];

type ScalePreset = { label: string; centers: CenterSpec[]; days: number };

const SCALE_PRESETS: Record<string, ScalePreset> = {
  small: {
    label: 'small',
    centers: [REAL_CENTERS[2]], // 27-capacity single center
    days: 14,
  },
  medium: {
    label: 'medium',
    centers: [REAL_CENTERS[1]], // 122-capacity single center
    days: 30,
  },
  large: {
    label: 'large',
    centers: REAL_CENTERS, // all three real centers
    days: 45,
  },
  xl: {
    label: 'xl',
    centers: REAL_CENTERS,
    days: 90,
  },
};

// ── CLI parsing ───────────────────────────────────────────────────────────────
type Args = {
  scale: string;
  centers?: number;
  capacity?: number;
  days?: number;
  orgSlug: string;
  orgName: string;
  emailDomain: string;
  seed: string;
  ownerEmail: string;
  ownerPassword: string;
  reset: boolean;
  yes: boolean;
  iKnow: boolean;
};

// Guard: seed.ts must never touch the production project unless explicitly forced.
const PROD_PROJECT_REF = 'jqbvojjgkkhbndsgbsuo';

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      bools.add(key);
    } else {
      flags.set(key, next);
      i++;
    }
  }
  const num = (k: string): number | undefined => {
    const v = flags.get(k);
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`--${k} must be a number, got "${v}"`);
    return n;
  };
  return {
    scale: flags.get('scale') ?? 'medium',
    centers: num('centers'),
    capacity: num('capacity'),
    days: num('days'),
    orgSlug: flags.get('org-slug') ?? 'sandbox-childcare',
    orgName: flags.get('org-name') ?? 'Sandbox Childcare Co.',
    emailDomain: flags.get('email-domain') ?? 'sandbox.kb',
    seed: flags.get('seed') ?? 'kinderbase',
    ownerEmail: flags.get('owner-email') ?? '',
    ownerPassword: flags.get('owner-password') ?? 'Sandbox!23456',
    reset: bools.has('reset'),
    yes: bools.has('yes'),
    iKnow: bools.has('i-know'),
  };
}

function resolveCenters(args: Args): { centers: CenterSpec[]; days: number; scaleLabel: string } {
  // Explicit --centers/--capacity overrides any preset.
  if (args.centers !== undefined || args.capacity !== undefined) {
    const count = Math.max(1, args.centers ?? 1);
    const cap = Math.max(6, args.capacity ?? 60);
    const centers: CenterSpec[] = Array.from({ length: count }, (_, i) => ({
      name: `Sandbox Center ${i + 1}`,
      capacity: cap,
      address: `${100 + i} Demo Street, Baltimore, MD 2120${i % 10}`,
      occRegion: 'Baltimore City',
    }));
    return { centers, days: args.days ?? 30, scaleLabel: 'custom' };
  }
  const preset = SCALE_PRESETS[args.scale];
  if (!preset) {
    throw new Error(
      `Unknown --scale "${args.scale}". Options: ${Object.keys(SCALE_PRESETS).join(', ')}, or use --centers/--capacity.`,
    );
  }
  return {
    centers: preset.centers,
    days: args.days ?? preset.days,
    scaleLabel: preset.label,
  };
}

// ── Seeded PRNG (mulberry32) so re-runs with the same --seed are reproducible ──
function makeRng(seedStr: string): {
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(arr: readonly T[]) => T;
} {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// ── Name pools ──────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Aaliyah', 'Brandon', 'Carla', 'Darius', 'Elena', 'Felix', 'Grace', 'Hector',
  'Imani', 'James', 'Kendra', 'Luis', 'Monique', 'Noah', 'Olivia', 'Patrick',
  'Quinn', 'Rosa', 'Samuel', 'Tanya', 'Uma', 'Victor', 'Wanda', 'Xavier',
  'Yvonne', 'Zachary', 'Amara', 'Benjamin', 'Camila', 'Devon', 'Esther',
  'Frances', 'Gloria', 'Hannah', 'Isaiah', 'Jasmine', 'Keisha', 'Leon',
  'Maria', 'Nathan', 'Priya', 'Renee', 'Simone', 'Theo', 'Vanessa',
];
const LAST_NAMES = [
  'Washington', 'Hayes', 'Mendez', 'Johnson', 'Brooks', 'Nguyen', 'Campbell',
  'Rivera', 'Scott', 'Kim', 'Thomas', 'Garcia', 'Davis', 'Wilson', 'Martin',
  'Robinson', 'Anderson', 'Clark', 'Lewis', 'Walker', 'Patel', 'Reed',
  'Foster', 'Bryant', 'Coleman', 'Simmons', 'Hughes', 'Ford', 'Bell', 'Ross',
];

// Staff (teacher/aide/admin) name pools — female first names and surnames common
// in Black communities. Children keep the mixed FIRST_NAMES/LAST_NAMES pools.
const STAFF_FIRST_NAMES = [
  'Aaliyah', 'Imani', 'Keisha', 'Monique', 'Simone', 'Amara', 'Jasmine', 'Nia',
  'Ayanna', 'Zuri', 'Kenya', 'Latoya', 'Tanisha', 'Ebony', 'Aisha', 'Destiny',
  'Shanice', 'Deja', 'Kiara', 'Tiana', 'Zora', 'Alani', 'Nyla', 'Sanaa',
  'Aniyah', 'Camille', 'Renee', 'Yolanda', 'Gabrielle', 'Serena', 'Denise',
  'Octavia', 'Maya', 'Cierra', 'Jada', 'Whitney', 'Chantel', 'Raven',
];
const STAFF_LAST_NAMES = [
  'Washington', 'Jefferson', 'Jackson', 'Johnson', 'Harris', 'Robinson', 'Coleman',
  'Brooks', 'Banks', 'Booker', 'Freeman', 'Mosley', 'Gaines', 'Charles', 'Joseph',
  'Dorsey', 'Rhodes', 'Hampton', 'Carter', 'Dawson', 'Bryant', 'Scott', 'Davis',
  'Simmons', 'Hughes', 'Ross', 'Bell', 'Ford',
];

const ISSUING_ORGS = [
  'Maryland State Department of Education',
  'American Red Cross',
  'MSDE Office of Child Care',
  'Community College of Baltimore County',
  'Maryland Family Network',
];

// ── Date helpers (all UTC-date ISO strings for date columns) ──────────────────
const DAY_MS = 86_400_000;
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * DAY_MS);
}

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnv(): { url: string; serviceKey: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Locate apps/web/.env.local from a few likely working directories.
    const here = dirname(fileHint());
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
        const key = m[1];
        const val = m[2].replace(/^["']|["']$/g, '');
        if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !url) url = val;
        if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceKey) serviceKey = val;
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

// __dirname isn't reliable across tsx CJS/ESM; fall back to cwd if unavailable.
function fileHint(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (globalThis as any).__dirname as string | undefined;
    if (d) return resolve(d, 'seed.ts');
  } catch {
    /* ignore */
  }
  return resolve(process.cwd(), 'apps/web/supabase/seed.ts');
}

// ── Concurrency pool for auth admin calls ─────────────────────────────────────
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── Bulk insert with chunking ─────────────────────────────────────────────────
type Db = SupabaseClient<Database>;
type TableName = keyof Database['public']['Tables'];

async function insertChunked<T extends TableName>(
  db: Db,
  table: T,
  rows: Database['public']['Tables'][T]['Insert'][],
  chunk = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await db.from(table).insert(slice as any);
    if (error) throw new Error(`insert into ${table} failed: ${error.message}`);
  }
}

// ── In-memory model built before any DB write ─────────────────────────────────
type SeedUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  platformRole: 'owner' | 'staff';
  centerRole: CenterRole;
  centerIndex: number;
  classroomKey: string | null; // template key of assigned room, null for admins/floats
  kioskPin: string;
  handle: string | null;
  profilePublic: boolean;
};

type SeedClassroom = {
  key: string;
  centerIndex: number;
  name: string;
  ageGroup: AgeGroup;
  capacity: number;
  enrollment: number;
  requiredStaff: number;
};

function buildClassrooms(centerIndex: number, capacity: number, rng: ReturnType<typeof makeRng>): SeedClassroom[] {
  const rooms: SeedClassroom[] = [];
  let remaining = capacity;
  let t = 0;
  let suffix = 1;
  while (remaining >= 6 && rooms.length < 30) {
    const tpl = ROOM_TEMPLATE[t % ROOM_TEMPLATE.length];
    const roomCap = Math.min(tpl.capacity, remaining);
    if (roomCap < 6) break;
    // Second lap through the template appends "B"/"C" to keep room names distinct.
    const lap = Math.floor(t / ROOM_TEMPLATE.length);
    const nameSuffix = lap === 0 ? '' : ` ${String.fromCharCode(65 + lap)}`;
    const rule = RATIO_RULES[tpl.ageGroup];
    const enrollment = Math.min(
      roomCap,
      rule.maxGroupSize,
      Math.max(rule.childrenPerStaff, Math.round(roomCap * (0.82 + rng.next() * 0.16))),
    );
    const requiredStaff = Math.max(1, Math.ceil(enrollment / rule.childrenPerStaff));
    rooms.push({
      key: `c${centerIndex}-r${suffix}`,
      centerIndex,
      name: `${tpl.label}${nameSuffix}`,
      ageGroup: tpl.ageGroup,
      capacity: roomCap,
      enrollment,
      requiredStaff,
    });
    remaining -= roomCap;
    t++;
    suffix++;
  }
  return rooms;
}

function credentialsForRole(role: CenterRole): CredentialType[] {
  const base: CredentialType[] = ['first_aid_cpr', 'child_abuse_prevention'];
  switch (role) {
    case 'director':
      return [...base, 'directors_certification', 'medication_administration', 'college_degree', 'ada_training'];
    case 'admin':
      return [...base, 'medication_administration', 'communication_9hr'];
    case 'lead_teacher':
      return [...base, 'preschool_90hr', 'infant_toddler_9hr', 'communication_9hr', 'medication_administration'];
    case 'assistant_teacher':
      return [...base, 'infant_toddler_9hr', 'communication_9hr'];
    case 'aide':
      return [...base, 'communication_9hr'];
    case 'substitute':
      return base;
    default:
      return base;
  }
}

// Which credential types carry an expiry, and their validity window in years.
const CREDENTIAL_EXPIRY_YEARS: Partial<Record<CredentialType, number>> = {
  first_aid_cpr: 2,
  medication_administration: 3,
  cda: 3,
  ada_training: 3,
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { centers, days, scaleLabel } = resolveCenters(args);
  const rng = makeRng(args.seed);
  const domain = args.emailDomain;
  const ownerEmail = args.ownerEmail || `owner@${domain}`;

  const { url, serviceKey } = loadEnv();

  // Refuse to run against production unless explicitly overridden with --i-know.
  if (url.includes(PROD_PROJECT_REF) && !args.iKnow) {
    throw new Error(
      `Target URL points at the PRODUCTION project (${PROD_PROJECT_REF}). ` +
        'seed.ts is for sandbox use only. Point NEXT_PUBLIC_SUPABASE_URL at your sandbox ' +
        'project, or pass --i-know to override (not recommended).',
    );
  }

  const db: Db = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\nKinderBase sandbox seed`);
  console.log(`  scale:        ${scaleLabel}`);
  console.log(`  centers:      ${centers.length} (${centers.map((c) => c.capacity).join(', ')} capacity)`);
  console.log(`  history:      ${days} days`);
  console.log(`  org slug:     ${args.orgSlug}`);
  console.log(`  email domain: @${domain}`);
  console.log(`  rng seed:     ${args.seed}\n`);

  if (args.reset) {
    if (!args.yes) {
      throw new Error(
        `--reset will DELETE all data under org "${args.orgSlug}" and @${domain} users. ` +
          'Re-run with --yes to confirm.',
      );
    }
    await resetSandbox(db, args.orgSlug, domain, ownerEmail);
  }

  // ── 0. ELOF framework (system reference data; idempotent, not org-scoped) ──
  const elof = await seedElof(db);
  console.log(
    `Seeded ELOF framework: ${elof.domains} domains, ${elof.subdomains} sub-domains, ` +
      `${elof.goals} goals, ${elof.progressions} progressions, ${elof.ratingLevels} rating levels.`,
  );

  // ── 1. Organization ──────────────────────────────────────────────────────
  const orgId = randomUUID();
  const { error: orgErr } = await db.from('organizations').insert({
    id: orgId,
    name: args.orgName,
    slug: args.orgSlug,
    primary_color: '#D35400',
  });
  if (orgErr) {
    throw new Error(
      `Could not create organization "${args.orgSlug}": ${orgErr.message}. ` +
        'If it already exists, re-run with --reset --yes.',
    );
  }

  // ── 2. Centers ───────────────────────────────────────────────────────────
  const centerIds: string[] = centers.map(() => randomUUID());
  await insertChunked(
    db,
    'centers',
    centers.map((c, i) => ({
      id: centerIds[i],
      org_id: orgId,
      name: c.name,
      address: c.address,
      licensed_capacity: c.capacity,
      occ_license_number: `MD-CCC-${String(155000 + rng.int(0, 8999)).padStart(6, '0')}`,
      license_type: 'child_care_center' as const,
      occ_region: c.occRegion,
      state: 'MD',
    })),
  );

  // ── 3. Classrooms ──────────────────────────────────────────────────────────
  const classrooms: SeedClassroom[] = centers.flatMap((c, i) => buildClassrooms(i, c.capacity, rng));
  const classroomIds = new Map<string, string>();
  classrooms.forEach((room) => classroomIds.set(room.key, randomUUID()));
  await insertChunked(
    db,
    'classrooms',
    classrooms.map((room) => ({
      id: classroomIds.get(room.key)!,
      center_id: centerIds[room.centerIndex],
      name: room.name,
      age_group: room.ageGroup,
      licensed_capacity: room.capacity,
      typical_enrollment: room.enrollment,
    })),
  );

  // ── 4. Build the user model in memory ──────────────────────────────────────
  const users: SeedUser[] = [];
  const usedEmails = new Set<string>();
  const usedHandles = new Set<string>();
  let pinCounter = 1000;

  const makeEmail = (first: string, last: string): string => {
    const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    let email = `${base}@${domain}`;
    let n = 2;
    while (usedEmails.has(email)) email = `${base}${n++}@${domain}`;
    usedEmails.add(email);
    return email;
  };
  const makeHandle = (first: string, last: string): string => {
    const base = `${first}-${last}`.toLowerCase().replace(/[^a-z-]/g, '');
    let handle = base;
    let n = 2;
    while (usedHandles.has(handle)) handle = `${base}-${n++}`;
    usedHandles.add(handle);
    return handle;
  };
  const addUser = (
    centerIndex: number,
    centerRole: CenterRole,
    classroomKey: string | null,
  ): SeedUser => {
    const first = rng.pick(STAFF_FIRST_NAMES);
    const last = rng.pick(STAFF_LAST_NAMES);
    const isTeacher = centerRole !== 'admin';
    const profilePublic = isTeacher && rng.chance(0.6);
    const u: SeedUser = {
      id: '', // filled after auth user creation
      email: makeEmail(first, last),
      password: 'Sandbox!23456',
      fullName: `${first} ${last}`,
      platformRole: 'staff',
      centerRole,
      centerIndex,
      classroomKey,
      kioskPin: String(++pinCounter),
      handle: profilePublic ? makeHandle(first, last) : null,
      profilePublic,
    };
    users.push(u);
    return u;
  };

  // The operator/owner — a single account that is admin at every center.
  const owner: SeedUser = {
    id: '',
    email: ownerEmail,
    password: args.ownerPassword,
    fullName: 'Yolanda Carter',
    platformRole: 'owner',
    centerRole: 'director',
    centerIndex: 0,
    classroomKey: null,
    kioskPin: '9999',
    handle: null,
    profilePublic: false,
  };
  users.push(owner);

  centers.forEach((_, ci) => {
    // One director + one office admin per center.
    addUser(ci, 'director', null);
    addUser(ci, 'admin', null);
    // Teaching staff per classroom: a lead + enough assistants/aides to meet ratio.
    for (const room of classrooms.filter((r) => r.centerIndex === ci)) {
      addUser(ci, 'lead_teacher', room.key);
      for (let s = 1; s < room.requiredStaff; s++) {
        addUser(ci, rng.chance(0.6) ? 'assistant_teacher' : 'aide', room.key);
      }
    }
    // Floats/substitutes ~ 15% of room count, at least one.
    const roomCount = classrooms.filter((r) => r.centerIndex === ci).length;
    const subs = Math.max(1, Math.round(roomCount * 0.15));
    for (let s = 0; s < subs; s++) addUser(ci, 'substitute', null);
  });

  // ── 5. Create auth.users, then public.users ────────────────────────────────
  console.log(`Creating ${users.length} auth users…`);
  await mapPool(users, 8, async (u) => {
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    });
    if (error || !data.user) throw new Error(`createUser(${u.email}) failed: ${error?.message}`);
    u.id = data.user.id;
  });

  await insertChunked(
    db,
    'users',
    users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.fullName,
      role: u.platformRole,
      handle: u.handle,
      profile_public: u.profilePublic,
      kiosk_pin: u.kioskPin,
      bio: u.profilePublic ? `${u.centerRole.replace(/_/g, ' ')} at ${args.orgName}.` : null,
    })),
  );

  // ── 6. Center memberships ───────────────────────────────────────────────────
  type Membership = Database['public']['Tables']['center_memberships']['Insert'];
  const memberships: Membership[] = [];
  for (const u of users) {
    if (u === owner) continue;
    memberships.push({
      user_id: u.id,
      center_id: centerIds[u.centerIndex],
      role: u.centerRole,
      is_primary_center: true,
    });
  }
  // Owner is admin at every center.
  centerIds.forEach((cid, i) => {
    memberships.push({
      user_id: owner.id,
      center_id: cid,
      role: i === 0 ? 'director' : 'admin',
      is_primary_center: i === 0,
    });
  });
  await insertChunked(db, 'center_memberships', memberships);

  // ── 7. Credentials (mixed active / expiring_soon / expired) ─────────────────
  type Credential = Database['public']['Tables']['credentials']['Insert'];
  const credentials: Credential[] = [];
  const teachers = users.filter((u) => u.centerRole !== 'admin');
  for (const u of teachers) {
    for (const type of credentialsForRole(u.centerRole)) {
      const expiryYears = CREDENTIAL_EXPIRY_YEARS[type];
      let issued: Date;
      let expires: Date | null;
      if (expiryYears === undefined) {
        issued = daysAgo(rng.int(180, 1400));
        expires = null; // no_expiration
      } else {
        // Bias the issue date so ~15% are expired and ~15% expiring within 30 days.
        const roll = rng.next();
        if (roll < 0.15) {
          expires = daysAgo(rng.int(1, 120)); // expired
        } else if (roll < 0.3) {
          expires = daysFromNow(rng.int(1, 29)); // expiring_soon
        } else {
          expires = daysFromNow(rng.int(60, expiryYears * 365)); // active
        }
        issued = new Date(expires.getTime() - expiryYears * 365 * DAY_MS);
      }
      credentials.push({
        user_id: u.id,
        credential_type: type,
        issuing_org: rng.pick(ISSUING_ORGS),
        issued_at: isoDate(issued),
        expires_at: expires ? isoDate(expires) : null,
        storage_path: `${u.id}/${type}.pdf`, // placeholder — no file uploaded
        show_on_profile: u.profilePublic,
      });
    }
  }
  await insertChunked(db, 'credentials', credentials);

  // ── 8. Employment history (current role + occasional prior employer) ────────
  type Employment = Database['public']['Tables']['employment_history']['Insert'];
  const employment: Employment[] = [];
  for (const u of teachers) {
    const tenureDays = rng.int(120, 1600);
    employment.push({
      user_id: u.id,
      employer_name: centers[u.centerIndex].name,
      center_id: centerIds[u.centerIndex],
      role_title: u.centerRole.replace(/_/g, ' '),
      start_date: isoDate(daysAgo(tenureDays)),
      end_date: null,
      show_on_profile: u.profilePublic,
    });
    if (rng.chance(0.4)) {
      const priorEnd = daysAgo(tenureDays + rng.int(20, 90));
      const priorStart = new Date(priorEnd.getTime() - rng.int(300, 1200) * DAY_MS);
      employment.push({
        user_id: u.id,
        employer_name: rng.pick(['Little Scholars Academy', 'Bright Beginnings CDC', 'Harbor Kids Learning Center']),
        center_id: null,
        role_title: rng.pick(['assistant teacher', 'aide', 'lead teacher']),
        start_date: isoDate(priorStart),
        end_date: isoDate(priorEnd),
        show_on_profile: u.profilePublic,
      });
    }
  }
  await insertChunked(db, 'employment_history', employment);

  // ── 9. Classroom roster (classroom_staff) + shift slots ─────────────────────
  // (The old hourly staffing_patterns table is deprecated and no longer seeded.)
  type RosterInsert = Database['public']['Tables']['classroom_staff']['Insert'];
  type ShiftInsert = Database['public']['Tables']['staff_shift_slots']['Insert'];
  const rosterRows: RosterInsert[] = [];
  const shiftRows: ShiftInsert[] = [];
  const rosterByRoom = new Map<string, { id: string; userId: string }[]>();
  const localTodayISO = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dowToday = (() => { const j = new Date().getDay(); return j === 0 ? 7 : j; })();
  const shiftDays = Array.from(new Set([1, 2, 3, 4, 5, dowToday]));
  for (const room of classrooms) {
    const cid = classroomIds.get(room.key)!;
    const roomUsers = users.filter((u) => u.classroomKey === room.key);
    const list: { id: string; userId: string }[] = [];
    roomUsers.forEach((u, idx) => {
      const id = randomUUID();
      rosterRows.push({ id, classroom_id: cid, user_id: u.id, staff_name: null, position_code: null, sort_order: idx });
      list.push({ id, userId: u.id });
      for (const day of shiftDays) {
        for (let slot = 12; slot < 38; slot++) {
          if (slot === 24 || slot === 25) continue; // 30-min lunch gap → a break in the bar
          shiftRows.push({ classroom_staff_id: id, day_of_week: day, slot });
        }
      }
    });
    rosterByRoom.set(room.key, list);
  }
  await insertChunked(db, 'classroom_staff', rosterRows);
  await insertChunked(db, 'staff_shift_slots', shiftRows);

  // ── 9c. Children, today's attendance, and a per-room presence plan ──────────
  type ChildInsert = Database['public']['Tables']['children']['Insert'];
  type AttInsert = Database['public']['Tables']['child_attendance']['Insert'];
  const childrenRows: ChildInsert[] = [];
  const attendanceRows: AttInsert[] = [];
  const childrenByRoom = new Map<string, { id: string; present: boolean }[]>();
  const presentRosterUserIds = new Set<string>();
  const today = localTodayISO();
  let boundaryPlaced = false;

  const ageDaysForBand = (g: AgeGroup): number => {
    switch (g) {
      case 'infant': return rng.int(60, 330);
      case 'toddler': return rng.int(370, 700);
      case 'two_year': return rng.int(740, 1060);
      case 'preschool': return rng.int(1100, 1760);
      default: return rng.int(1830, 3400);
    }
  };

  classrooms.forEach((room, roomIdx) => {
    const cid = classroomIds.get(room.key)!;
    const roster = rosterByRoom.get(room.key) ?? [];
    const isFocus = roomIdx === 0; // first room → deliberately understaffed (out of ratio)
    const nKids = Math.min(room.enrollment, 6);
    const cpr = RATIO_RULES[room.ageGroup].childrenPerStaff;
    const kids: { id: string; present: boolean }[] = [];

    for (let i = 0; i < nKids; i++) {
      const id = randomUUID();
      let bd = daysAgo(ageDaysForBand(room.ageGroup));
      // Put one infant/toddler child ~8 days from a COMAR boundary (birthday alert).
      if (i === 0 && !boundaryPlaced && (room.ageGroup === 'infant' || room.ageGroup === 'toddler')) {
        const boundaryMonths = room.ageGroup === 'infant' ? 12 : 24;
        const d = new Date();
        d.setMonth(d.getMonth() - boundaryMonths);
        d.setDate(d.getDate() + 8);
        bd = d;
        boundaryPlaced = true;
      }
      childrenRows.push({
        id,
        center_id: centerIds[room.centerIndex],
        classroom_id: cid,
        first_name: rng.pick(FIRST_NAMES),
        last_name: rng.pick(LAST_NAMES),
        birthdate: isoDate(bd),
        enrolled_at: isoDate(daysAgo(rng.int(30, 400))),
        status: 'enrolled',
        // Student-module columns are NOT NULL; set on every row so the batch
        // insert is homogeneous (PostgREST fills omitted keys with NULL, not the
        // column default, once any row in the batch sets them). Enriched below.
        enrollment_status: 'active',
        tags: [],
      });
      kids.push({ id, present: false });
    }

    // Presence: focus room fully present; others ~78%.
    for (const k of kids) k.present = isFocus ? true : rng.chance(0.78);
    for (const k of kids.filter((x) => x.present)) {
      const inAt = new Date();
      inAt.setHours(7, rng.int(0, 59), 0, 0);
      attendanceRows.push({ child_id: k.id, classroom_id: cid, attendance_date: today, signed_in_at: inAt.toISOString(), signed_out_at: null });
    }
    childrenByRoom.set(room.key, kids);

    // Staff present: focus room one short of required (violation); others meet/exceed.
    const presentKids = kids.filter((k) => k.present).length;
    const required = Math.max(1, Math.ceil(presentKids / cpr));
    let staffPresent = isFocus ? Math.max(0, required - 1) : required + (rng.chance(0.5) ? 1 : 0);
    staffPresent = Math.min(staffPresent, roster.length);
    for (let i = 0; i < staffPresent; i++) presentRosterUserIds.add(roster[i]!.userId);
  });
  // ── 9c-bis. Student-module detail: tags, enrollment status, health, docs ────
  type HealthInsert = Database['public']['Tables']['student_health']['Insert'];
  type DocInsert = Database['public']['Tables']['student_documents']['Insert'];
  const STUDENT_TAGS = ['Scholarship', 'IEP', 'Bilingual', 'New this year'];
  const REQUIRED_DOCS = [
    { doc_type: 'immunization', label: 'Immunization record (DHMH 896)' },
    { doc_type: 'emergency', label: 'Emergency contact & authorization' },
    { doc_type: 'health_inventory', label: 'Health inventory / physical' },
  ];
  const healthRows: HealthInsert[] = [];
  const docRows: DocInsert[] = [];

  const kidsByCenter = new Map<string, ChildInsert[]>();
  for (const c of childrenRows) {
    const arr = kidsByCenter.get(c.center_id as string) ?? [];
    arr.push(c);
    kidsByCenter.set(c.center_id as string, arr);
  }

  for (const [, kids] of kidsByCenter) {
    kids.forEach((c, i) => {
      // Tags on ~1/3 of students so the tag filter has something to show.
      if (i % 3 === 0) c.tags = [rng.pick(STUDENT_TAGS)];
      // A couple of non-active statuses per center to exercise the status filter.
      if (i === kids.length - 1 && kids.length > 3) c.enrollment_status = 'waitlist';
      else if (i === kids.length - 2 && kids.length > 4) c.enrollment_status = 'inactive';

      // Required documents: mostly current; leave one required doc missing on ~1 in 4.
      const missingIdx = i % 4 === 2 ? rng.int(0, REQUIRED_DOCS.length - 1) : -1;
      REQUIRED_DOCS.forEach((d, di) => {
        const missing = di === missingIdx;
        docRows.push({
          child_id: c.id as string,
          doc_type: d.doc_type,
          label: d.label,
          status: missing ? 'missing' : 'current',
          is_required: true,
          is_confidential: false,
          uploaded_at: missing ? null : new Date(`${isoDate(daysAgo(rng.int(20, 300)))}T12:00:00`).toISOString(),
        });
      });
    });

    // One severe allergy per center, on the first (present, active) child.
    const first = kids[0];
    if (first) {
      healthRows.push({
        child_id: first.id as string,
        kind: 'allergy',
        name: 'Peanuts',
        detail: 'Anaphylaxis risk. Avoid all tree nuts and peanut products.',
        severity: 'severe',
        rescue_med: 'EpiPen Jr.',
        rescue_med_location: 'Front office medication cabinet',
        rescue_med_expires: isoDate(daysFromNow(rng.int(120, 320))),
      });
    }
  }

  // ── 9c-ter. Guardians, authorized pickups, siblings ─────────────────────────
  type GuardianInsert = Database['public']['Tables']['guardians']['Insert'];
  type PickupInsert = Database['public']['Tables']['authorized_pickups']['Insert'];
  type SiblingInsert = Database['public']['Tables']['student_siblings']['Insert'];
  const MOM_NAMES = ['Denise', 'Latoya', 'Yolanda', 'Fatima', 'Renee', 'Crystal', 'Angela', 'Tanya', 'Nia', 'Simone'];
  const DAD_NAMES = ['Marcus', 'Andre', 'Terrence', 'Malik', 'Jerome', 'Darnell', 'Kevin', 'Reginald', 'Curtis', 'Elijah'];
  const EMPLOYERS = ['Johns Hopkins', 'MedStar Health', 'Baltimore City Schools', 'Under Armour', 'City of Baltimore', 'T. Rowe Price'];
  const guardianRows: GuardianInsert[] = [];
  const pickupRows: PickupInsert[] = [];
  const phone = () => `410-555-${String(rng.int(1000, 9999))}`;

  for (const c of childrenRows) {
    const last = c.last_name as string;
    const mom = rng.pick(MOM_NAMES);
    guardianRows.push({
      child_id: c.id as string,
      full_name: `${mom} ${last}`,
      relationship: 'mother',
      email: `${mom.toLowerCase()}.${last.toLowerCase()}@example.com`,
      mobile_phone: phone(),
      employer: rng.chance(0.7) ? rng.pick(EMPLOYERS) : null,
      is_primary: true,
      is_emergency: true,
      is_pickup_restricted: false,
      sort_order: 0,
    });
    if (rng.chance(0.6)) {
      const dad = rng.pick(DAD_NAMES);
      guardianRows.push({
        child_id: c.id as string,
        full_name: `${dad} ${last}`,
        relationship: 'father',
        email: `${dad.toLowerCase()}.${last.toLowerCase()}@example.com`,
        mobile_phone: phone(),
        employer: rng.chance(0.7) ? rng.pick(EMPLOYERS) : null,
        is_primary: false,
        is_emergency: true,
        is_pickup_restricted: false,
        sort_order: 1,
      });
    }
    if (rng.chance(0.2)) {
      pickupRows.push({ child_id: c.id as string, full_name: `${rng.pick(MOM_NAMES)} ${last}`, relationship: 'Grandmother', phone: phone() });
    }
  }

  // Siblings: children sharing a last name within a center are linked (both ways).
  const siblingRows: SiblingInsert[] = [];
  const byLast = new Map<string, string[]>();
  for (const c of childrenRows) {
    const k = `${c.center_id}|${c.last_name}`;
    const arr = byLast.get(k) ?? [];
    arr.push(c.id as string);
    byLast.set(k, arr);
  }
  for (const ids of byLast.values()) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++)
      for (let j = 0; j < ids.length; j++) if (i !== j) siblingRows.push({ child_id: ids[i]!, sibling_id: ids[j]! });
  }

  await insertChunked(db, 'children', childrenRows);
  await insertChunked(db, 'child_attendance', attendanceRows);
  await insertChunked(db, 'student_health', healthRows);
  await insertChunked(db, 'student_documents', docRows);
  await insertChunked(db, 'guardians', guardianRows);
  await insertChunked(db, 'authorized_pickups', pickupRows);
  await insertChunked(db, 'student_siblings', siblingRows);

  // ── 10. Time entries (weekday clock in/out history) ─────────────────────────
  type TimeEntry = Database['public']['Tables']['time_entries']['Insert'];
  const timeEntries: TimeEntry[] = [];
  const clockableRoles: CenterRole[] = ['lead_teacher', 'assistant_teacher', 'aide', 'director', 'substitute'];
  const clockable = users.filter((u) => clockableRoles.includes(u.centerRole));
  for (let d = days; d >= 1; d--) {
    const day = daysAgo(d);
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue; // weekdays only
    for (const u of clockable) {
      // Substitutes work sporadically; regulars ~88% attendance.
      const attend = u.centerRole === 'substitute' ? 0.25 : 0.88;
      if (!rng.chance(attend)) continue;
      const inH = 7 + rng.next() * 1.5; // 07:00–08:30
      const shift = 6.5 + rng.next() * 2.5; // 6.5–9h
      const clockIn = new Date(day);
      clockIn.setUTCHours(Math.floor(inH), Math.floor((inH % 1) * 60), 0, 0);
      const clockOut = new Date(clockIn.getTime() + shift * 3_600_000);
      timeEntries.push({
        user_id: u.id,
        center_id: centerIds[u.centerIndex],
        clocked_in_at: clockIn.toISOString(),
        clocked_out_at: clockOut.toISOString(),
      });
    }
  }
  // Currently clocked in today (no clock-out) = the per-room presence plan, so
  // real-time ratios line up with the seeded attendance (one room stays short).
  const usersById = new Map(users.map((u) => [u.id, u]));
  for (const uid of presentRosterUserIds) {
    const u = usersById.get(uid);
    if (!u) continue;
    const clockIn = new Date();
    clockIn.setHours(6 + Math.floor(rng.next() * 2), rng.int(0, 59), 0, 0); // 6–8am local
    timeEntries.push({
      user_id: u.id,
      center_id: centerIds[u.centerIndex],
      clocked_in_at: clockIn.toISOString(),
      clocked_out_at: null,
    });
  }
  await insertChunked(db, 'time_entries', timeEntries);

  // ── 10b. Child care updates (meals/naps/milestones/incidents) ───────────────
  type UpdateInsert = Database['public']['Tables']['child_updates']['Insert'];
  type TagInsert = Database['public']['Tables']['child_update_children']['Insert'];
  const updateRows: UpdateInsert[] = [];
  const tagRows: TagInsert[] = [];
  const BODY: Record<'meal' | 'nap' | 'milestone' | 'incident', string[]> = {
    meal: ['Finished the full bottle — great appetite!', 'Ate most of lunch, loved the peas.', 'Took 4oz, a little fussy — may be teething.', 'Tried avocado for the first time and liked it.'],
    nap: ['Napped 12:30–2:00, woke happy.', 'Slept 10:15–11:20 this morning.', 'Short nap today, ~40 minutes.', 'Down for nap at 1:00, still resting.'],
    milestone: ['Pulled up to standing for the first time!', 'Said a new word today — "more".', 'Took three wobbly steps unassisted!', 'Stacked four blocks all by themselves.'],
    incident: ['Minor bump on the forehead during play. Parent notified.', 'Small scratch on the arm, cleaned and bandaged. Parent notified.', 'Bumped knee on the mat, comforted and fine. Parent notified.'],
  };
  const todayAt = (h: number, m: number): Date => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

  classrooms.forEach((room, roomIdx) => {
    const cid = classroomIds.get(room.key)!;
    const roster = rosterByRoom.get(room.key) ?? [];
    if (roster.length === 0) return;
    const kids = childrenByRoom.get(room.key) ?? [];
    const lead = roster[0]!;
    const silent = roomIdx === 0 && roster[1] ? roster[1]! : null; // assistant in focus room = behind on posts

    const posts: { authorId: string; type: 'meal' | 'nap' | 'milestone' | 'incident'; at: Date }[] = [];
    // Lead: a few today + a steady history (drives green accountability).
    for (const t of ['meal', 'nap', 'milestone'] as const) posts.push({ authorId: lead.userId, type: t, at: todayAt(8 + rng.int(0, 3), rng.int(0, 59)) });
    for (let k = 0; k < 6; k++) posts.push({ authorId: lead.userId, type: rng.pick(['meal', 'nap', 'milestone'] as const), at: daysAgo(rng.int(2, 9)) });
    if (silent) {
      posts.push({ authorId: silent.userId, type: 'incident', at: daysAgo(11) }); // only an old post → red row + nudge
    } else {
      for (const m of roster.slice(1)) if (rng.chance(0.6)) posts.push({ authorId: m.userId, type: rng.pick(['meal', 'nap'] as const), at: daysAgo(rng.int(1, 5)) });
    }

    for (const p of posts) {
      const id = randomUUID();
      updateRows.push({ id, classroom_id: cid, author_id: p.authorId, update_type: p.type, body: rng.pick(BODY[p.type]), created_at: p.at.toISOString() });
      if (kids.length) {
        const tagged = new Set<string>([kids[rng.int(0, kids.length - 1)]!.id]);
        if (p.type === 'nap' && kids.length > 1) tagged.add(kids[rng.int(0, kids.length - 1)]!.id);
        for (const childId of tagged) tagRows.push({ update_id: id, child_id: childId });
      }
    }
  });
  await insertChunked(db, 'child_updates', updateRows);
  await insertChunked(db, 'child_update_children', tagRows);

  // ── 11. Activity log (center-scoped event stream) ───────────────────────────
  type Activity = Database['public']['Tables']['activity_log']['Insert'];
  const activity: Activity[] = [];
  const addActivity = (centerIndex: number, actorId: string | null, type: string, payload: Record<string, unknown>, at: Date): void => {
    activity.push({
      center_id: centerIds[centerIndex],
      actor_id: actorId,
      event_type: type,
      payload,
      created_at: at.toISOString(),
    });
  };
  centers.forEach((_, ci) => {
    addActivity(ci, owner.id, 'center.created', { name: centers[ci].name }, daysAgo(days));
  });
  for (const room of classrooms) {
    addActivity(room.centerIndex, owner.id, 'classroom.created', { name: room.name, age_group: room.ageGroup }, daysAgo(days - 1));
  }
  for (const u of teachers) {
    addActivity(u.centerIndex, owner.id, 'staff.added', { staff_name: u.fullName, role: u.centerRole }, daysAgo(rng.int(1, days)));
    if (rng.chance(0.5)) {
      addActivity(u.centerIndex, u.id, 'credential.added', { staff_name: u.fullName }, daysAgo(rng.int(1, days)));
    }
  }
  await insertChunked(db, 'activity_log', activity);

  // ── 12. Staff profile data (scores, profiles, leave days, notes, requests) ──
  type ScoreInsert = Database['public']['Tables']['teacher_scores']['Insert'];
  type ProfileInsert = Database['public']['Tables']['staff_profiles']['Insert'];
  type LeaveInsert = Database['public']['Tables']['staff_leave_days']['Insert'];
  type NoteInsert = Database['public']['Tables']['staff_notes']['Insert'];
  type ReqInsert = Database['public']['Tables']['staff_requests']['Insert'];
  const scores: ScoreInsert[] = [];
  const profiles: ProfileInsert[] = [];
  const leaveDays: LeaveInsert[] = [];
  const notes: NoteInsert[] = [];
  const requests: ReqInsert[] = [];

  const SCORE_WEIGHTS = { attendance: 0.3, posting: 0.25, lesson: 0.2, schedule: 0.15, observation: 0.1 };
  const RELATIONS = ['sister', 'spouse', 'mother', 'brother', 'partner', 'father'];
  const AVAIL_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  // Score + profile for every non-admin staff member (teachers, aides, subs, director).
  const scored = users.filter((u) => u.centerRole !== 'admin');
  scored.forEach((u, idx) => {
    const s = {
      attendance: 3.5 + rng.next() * 1.5,
      posting: 2.8 + rng.next() * 2.0,
      lesson: 3.5 + rng.next() * 1.5,
      schedule: 3.8 + rng.next() * 1.2,
      observation: 3.5 + rng.next() * 1.5,
    };
    const center = Math.round(
      (s.attendance * SCORE_WEIGHTS.attendance + s.posting * SCORE_WEIGHTS.posting + s.lesson * SCORE_WEIGHTS.lesson +
        s.schedule * SCORE_WEIGHTS.schedule + s.observation * SCORE_WEIGHTS.observation) * 100
    ) / 100;
    // Every 5th teacher is "recently hired" → visible score not yet available.
    const recentlyHired = idx % 5 === 0;
    scores.push({
      user_id: u.id, center_id: centerIds[u.centerIndex],
      attendance_score: round2(s.attendance), posting_score: round2(s.posting), lesson_plan_score: round2(s.lesson),
      schedule_score: round2(s.schedule), observation_score: round2(s.observation), center_score: center,
      teacher_visible_score: recentlyHired ? null : Math.round((center - 0.1) * 100) / 100,
      teacher_visible_as_of: recentlyHired ? null : isoDate(daysAgo(30)),
    });

    const [first, last] = u.fullName.split(' ');
    const availability: Record<string, string> = {};
    for (const k of AVAIL_KEYS) availability[k] = k === 'sat' || k === 'sun' ? 'none' : 'full';
    availability['fri'] = 'pm'; // one partial day, matching the mock
    profiles.push({
      user_id: u.id, center_id: centerIds[u.centerIndex],
      personal_email: `${(first ?? 'staff').toLowerCase()}.${(last ?? 'kb').toLowerCase()}@gmail.com`,
      emergency_contact_name: `${rng.pick(FIRST_NAMES)} ${last ?? rng.pick(LAST_NAMES)}`,
      emergency_contact_relation: rng.pick(RELATIONS),
      emergency_contact_phone: `(410) 555-0${rng.int(100, 999)}`,
      availability,
      sick_hours: rng.int(4, 24), vacation_hours: rng.int(16, 80), personal_hours: rng.int(0, 16),
    });
  });

  // Leave days + notes + requests for the first few leads (rich profiles to explore).
  const leads = scored.filter((u) => u.centerRole === 'lead_teacher').slice(0, 3);
  leads.forEach((u, i) => {
    const cid = centerIds[u.centerIndex];
    // A couple of unexcused + several PTO/sick days across the last 90 days.
    const used = new Set<string>();
    const pushLeave = (kind: 'pto' | 'sick' | 'personal' | 'unexcused', n: number) => {
      let added = 0;
      while (added < n) {
        const day = daysAgo(rng.int(3, 88));
        const dow = day.getDay();
        const key = isoDate(day);
        if (dow === 0 || dow === 6 || used.has(key)) continue;
        used.add(key);
        leaveDays.push({ user_id: u.id, center_id: cid, day: key, kind });
        added++;
      }
    };
    pushLeave('unexcused', 2);
    pushLeave('pto', 3);
    pushLeave('sick', 2);

    notes.push({ user_id: u.id, center_id: cid, written_by: owner.id, category: 'commendation',
      content: `Observed ${u.fullName.split(' ')[0]} during morning routine. Excellent engagement and strong documentation habits.`,
      created_at: daysAgo(rng.int(20, 40)).toISOString() });
    notes.push({ user_id: u.id, center_id: cid, written_by: owner.id, category: 'performance_review',
      content: '90-day performance review completed. Meets all expectations.', created_at: daysAgo(rng.int(60, 80)).toISOString() });
    if (i === 0) {
      notes.push({ user_id: u.id, center_id: cid, written_by: owner.id, category: 'hr',
        content: 'Flagged interest in pursuing CDA. Discussed tuition support options.', created_at: daysAgo(rng.int(5, 15)).toISOString() });
    }

    // Requests: a pending schedule change + one pending / one approved time correction.
    requests.push({ user_id: u.id, center_id: cid, type: 'schedule', status: 'pending', created_by: u.id,
      details: 'Requesting Friday mornings only for the next two weeks.', created_at: daysAgo(rng.int(1, 4)).toISOString() });
    requests.push({ user_id: u.id, center_id: cid, type: 'time_correction', status: 'pending', created_by: owner.id,
      for_date: isoDate(daysAgo(2)), details: 'Clock-in was late due to a system issue.', created_at: daysAgo(2).toISOString() });
    requests.push({ user_id: u.id, center_id: cid, type: 'time_correction', status: 'approved', created_by: owner.id,
      for_date: isoDate(daysAgo(6)), details: 'Missed clock-out corrected.', created_at: daysAgo(6).toISOString(), resolved_at: daysAgo(5).toISOString() });
  });

  await insertChunked(db, 'teacher_scores', scores);
  await insertChunked(db, 'staff_profiles', profiles);
  await insertChunked(db, 'staff_leave_days', leaveDays);
  await insertChunked(db, 'staff_notes', notes);
  await insertChunked(db, 'staff_requests', requests);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete');
  console.log(`   organization:      1 (${args.orgSlug})`);
  console.log(`   centers:           ${centers.length}`);
  console.log(`   classrooms:        ${classrooms.length}`);
  console.log(`   users:             ${users.length}`);
  console.log(`   memberships:       ${memberships.length}`);
  console.log(`   credentials:       ${credentials.length}`);
  console.log(`   employment rows:   ${employment.length}`);
  console.log(`   roster rows:       ${rosterRows.length}`);
  console.log(`   shift slots:       ${shiftRows.length}`);
  console.log(`   children:          ${childrenRows.length}`);
  console.log(`   student health:    ${healthRows.length}`);
  console.log(`   student docs:      ${docRows.length}`);
  console.log(`   guardians:         ${guardianRows.length}`);
  console.log(`   authorized pickups:${pickupRows.length}`);
  console.log(`   siblings (links):  ${siblingRows.length}`);
  console.log(`   attendance (today):${attendanceRows.length}`);
  console.log(`   child updates:     ${updateRows.length}`);
  console.log(`   time entries:      ${timeEntries.length}`);
  console.log(`   activity events:   ${activity.length}`);
  console.log(`   teacher scores:    ${scores.length}`);
  console.log(`   staff profiles:    ${profiles.length}`);
  console.log(`   leave days:        ${leaveDays.length}`);
  console.log(`   staff notes:       ${notes.length}`);
  console.log(`   staff requests:    ${requests.length}`);
  console.log(`\n   Owner login →  ${owner.email}  /  ${owner.password}`);
  console.log(`   Staff logins →  <name>@${domain}  /  Sandbox!23456`);
  console.log(`   Reset later  →  pnpm dlx tsx apps/web/supabase/seed.ts --org-slug ${args.orgSlug} --reset --yes\n`);
}

// ── Reset: hard-delete everything under the sandbox org + email domain ─────────
async function resetSandbox(db: Db, orgSlug: string, domain: string, ownerEmail: string): Promise<void> {
  console.log(`Resetting sandbox org "${orgSlug}"…`);
  const { data: org } = await db.from('organizations').select('id').eq('slug', orgSlug).maybeSingle();
  if (!org) {
    console.log('  (no existing org — nothing to reset)');
    return;
  }
  const orgId = org.id;

  const { data: centerRows } = await db.from('centers').select('id').eq('org_id', orgId);
  const centerIds = (centerRows ?? []).map((c) => c.id);

  const { data: classRows } = centerIds.length
    ? await db.from('classrooms').select('id').in('center_id', centerIds)
    : { data: [] as { id: string }[] };
  const classIds = (classRows ?? []).map((c) => c.id);

  const { data: memberRows } = centerIds.length
    ? await db.from('center_memberships').select('user_id').in('center_id', centerIds)
    : { data: [] as { user_id: string }[] };
  const userIds = Array.from(new Set((memberRows ?? []).map((m) => m.user_id)));

  // Children first, respecting FK order (children.center_id has no cascade;
  // classroom-scoped tables cascade when classrooms are deleted below).
  if (centerIds.length) await db.from('children').delete().in('center_id', centerIds);
  if (classIds.length) await db.from('staffing_patterns').delete().in('classroom_id', classIds);
  if (centerIds.length) {
    await db.from('staff_requests').delete().in('center_id', centerIds);
    await db.from('staff_leave_days').delete().in('center_id', centerIds);
    await db.from('staff_notes').delete().in('center_id', centerIds);
    await db.from('teacher_scores').delete().in('center_id', centerIds);
    await db.from('staff_profiles').delete().in('center_id', centerIds);
    await db.from('time_entries').delete().in('center_id', centerIds);
    await db.from('activity_log').delete().in('center_id', centerIds);
  }
  if (userIds.length) {
    const { data: credRows } = await db.from('credentials').select('id').in('user_id', userIds);
    const credIds = (credRows ?? []).map((c) => c.id);
    if (credIds.length) await db.from('credential_audit_logs').delete().in('credential_id', credIds);
    await db.from('credentials').delete().in('user_id', userIds);
    await db.from('employment_history').delete().in('user_id', userIds);
    await db.from('push_tokens').delete().in('user_id', userIds);
  }
  if (centerIds.length) {
    await db.from('center_memberships').delete().in('center_id', centerIds);
    await db.from('classrooms').delete().in('center_id', centerIds);
    await db.from('centers').delete().in('org_id', orgId ? [orgId] : []);
  }
  await db.from('organizations').delete().eq('id', orgId);

  // Delete auth users (cascades public.users). Include any stray domain users + the owner.
  const authIds = new Set<string>(userIds);
  let page = 1;
  // Paginate auth users to catch the owner + any domain accounts not in memberships.
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data || data.users.length === 0) break;
    for (const au of data.users) {
      if (au.email && (au.email.endsWith(`@${domain}`) || au.email === ownerEmail)) authIds.add(au.id);
    }
    if (data.users.length < 200) break;
    page++;
  }
  await mapPool(Array.from(authIds), 8, async (id) => {
    await db.auth.admin.deleteUser(id);
  });
  console.log(`  removed ${centerIds.length} centers, ${classIds.length} classrooms, ${authIds.size} users`);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
