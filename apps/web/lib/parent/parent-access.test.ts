/**
 * Adversarial parent-access suite (docs/PARENT-DECISIONS.md §1). The deliverable
 * of the parent principal: a guardian of a child in one room must FAIL every
 * attempt to reach another family's data — by guessed id, by listing, by feed —
 * and must only see checkpoint ratings once released. These run against the live
 * sandbox with a REAL guardian session, so RLS (the actual enforcement) is what
 * is tested, not app code that could be bypassed by a new endpoint.
 *
 * Run: pnpm --filter @kinderbase/web test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@kinderbase/types/database';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = 'Sandbox!23456'; // seed password for every sandbox account
const ready = !!(URL && ANON && SERVICE);

type DB = SupabaseClient<Database>;

// Resolved in beforeAll.
let service: DB;
let parent: DB; // a guardian signed in via the anon key
let myChild: string;
let myCenter: string;
let otherChild: string;
let myChildIds: Set<string>;
const createdCheckpoints: string[] = [];
const createdUpdates: string[] = [];

describe.skipIf(!ready)('parent principal — adversarial access', () => {
  beforeAll(async () => {
    service = createClient<Database>(URL!, SERVICE!, { auth: { persistSession: false } });

    // Two linked guardians in different rooms (seeded as family.N@...).
    const { data: linked } = await service
      .from('guardians')
      .select('app_user_id, child_id, users!guardians_app_user_id_fkey(email), children(center_id, classroom_id)')
      .not('app_user_id', 'is', null)
      .limit(10);
    const rows = (linked ?? []).map((g) => {
      const u = Array.isArray(g.users) ? g.users[0] : g.users;
      const c = Array.isArray(g.children) ? g.children[0] : g.children;
      return { userId: g.app_user_id as string, childId: g.child_id, email: (u as { email: string } | null)?.email ?? '', room: (c as { classroom_id: string | null } | null)?.classroom_id ?? null, center: (c as { center_id: string } | null)?.center_id ?? '' };
    });
    rows.sort((a, b) => a.email.localeCompare(b.email));
    const me = rows[0]!;
    const other = rows.find((r) => r.childId !== me.childId && r.room !== me.room)!;
    myChild = me.childId;
    myCenter = me.center;
    otherChild = other.childId;

    // Every child this guardian may reach (for the "list returns only mine" check).
    const { data: mine } = await service.from('guardians').select('child_id').eq('app_user_id', me.userId);
    myChildIds = new Set((mine ?? []).map((r) => r.child_id));

    // Sign in as the guardian through the anon key → an RLS-enforced session.
    parent = createClient<Database>(URL!, ANON!, { auth: { persistSession: false } });
    const { error } = await parent.auth.signInWithPassword({ email: me.email, password: PASSWORD });
    if (error) throw new Error(`guardian sign-in failed (${me.email}): ${error.message}`);
  });

  afterAll(async () => {
    if (createdCheckpoints.length) await service.from('checkpoints').delete().in('id', createdCheckpoints);
    if (createdUpdates.length) await service.from('child_updates').delete().in('id', createdUpdates);
    await parent?.auth.signOut();
  });

  it('reads its own child', async () => {
    const { data } = await parent.from('children').select('id').eq('id', myChild);
    expect(data?.map((r) => r.id)).toEqual([myChild]);
  });

  it('CANNOT read another family’s child by guessed id', async () => {
    const { data } = await parent.from('children').select('id').eq('id', otherChild);
    expect(data ?? []).toEqual([]);
  });

  it('listing children returns ONLY the guardian’s own', async () => {
    const { data } = await parent.from('children').select('id');
    const got = new Set((data ?? []).map((r) => r.id));
    expect(got).toEqual(myChildIds);
    expect(got.has(otherChild)).toBe(false);
  });

  it('CANNOT read another child’s attendance', async () => {
    const { data } = await parent.from('child_attendance').select('id').eq('child_id', otherChild);
    expect(data ?? []).toEqual([]);
  });

  it('CANNOT read room updates/observations directly (free-text goes via the scrubbed reader)', async () => {
    const roomOfMine = (await service.from('children').select('classroom_id').eq('id', myChild).single()).data?.classroom_id;
    // A real update tagged to the guardian's OWN child (plus a classmate) exists —
    // so the empty results below mean "denied", not "nothing there".
    const { data: upd } = await service.from('child_updates').insert({ classroom_id: roomOfMine!, update_type: 'milestone', body: 'Napped alongside a classmate' }).select('id').single();
    createdUpdates.push(upd!.id);
    await service.from('child_update_children').insert([
      { update_id: upd!.id, child_id: myChild },
      { update_id: upd!.id, child_id: otherChild },
    ]);
    // A raw body can name a classmate and RLS can't rewrite text, so the guardian
    // gets NO direct read on these free-text tables — the parent feed reaches them
    // only through the server-side scrubbed reader (redactNames).
    expect((await parent.from('child_updates').select('id').eq('id', upd!.id)).data ?? []).toEqual([]);
    expect((await parent.from('child_update_children').select('child_id').eq('update_id', upd!.id)).data ?? []).toEqual([]);
    expect((await parent.from('observations').select('id').limit(1)).data ?? []).toEqual([]);
  });

  it('checkpoint ratings are hidden until released, and never across families', async () => {
    const fw = (await service.from('frameworks').select('id').limit(1).single()).data!.id;
    const mk = async (child: string, label: string) => {
      const res = await service.from('checkpoints').insert({ child_id: child, center_id: myCenter, framework_id: fw, view: 'infant_toddler', period_label: label, period_start: '2026-09-01', period_end: '2026-12-01', status: 'locked' }).select('id').single();
      if (res.error) throw new Error(`checkpoint insert failed: ${res.error.message}`);
      return res.data!.id;
    };

    const mineUnreleased = await mk(myChild, 'Test-unreleased');
    const mineReleased = await mk(myChild, 'Test-released');
    const othersReleased = await mk(otherChild, 'Test-other');
    createdCheckpoints.push(mineUnreleased, mineReleased, othersReleased);
    await service.from('checkpoints').update({ released_at: new Date().toISOString() }).in('id', [mineReleased, othersReleased]);

    const visible = new Set(((await parent.from('checkpoints').select('id')).data ?? []).map((r) => r.id));
    expect(visible.has(mineReleased)).toBe(true); // own + released → visible
    expect(visible.has(mineUnreleased)).toBe(false); // own but unreleased → hidden
    expect(visible.has(othersReleased)).toBe(false); // another family, even released → hidden
  });

  it('CANNOT self-publish a checkpoint (set released_at) on its own child', async () => {
    const fw = (await service.from('frameworks').select('id').limit(1).single()).data!.id;
    const cp = (await service.from('checkpoints').insert({ child_id: myChild, center_id: myCenter, framework_id: fw, view: 'infant_toddler', period_label: 'Test-selfpub', period_start: '2026-09-01', period_end: '2026-12-01', status: 'locked' }).select('id').single()).data!;
    createdCheckpoints.push(cp.id);
    // released_at is the family-visibility switch — a guardian must not flip it.
    const { data } = await parent.from('checkpoints').update({ released_at: new Date().toISOString() }).eq('id', cp.id).select('id');
    expect(data ?? []).toEqual([]); // no write policy → RLS refuses
    const after = (await service.from('checkpoints').select('released_at').eq('id', cp.id).single()).data!;
    expect(after.released_at).toBeNull();
  });

  it('deny-by-default: no access to staffing/time/score tables', async () => {
    for (const t of ['staff_assignments', 'time_entries', 'teacher_scores'] as const) {
      // The table HAS rows (seeded), so an empty parent result means denied, not empty.
      const total = await service.from(t).select('id', { count: 'exact', head: true });
      expect(total.count ?? 0).toBeGreaterThan(0);
      const { data } = await parent.from(t).select('id').limit(5);
      expect(data ?? []).toEqual([]);
    }
  });
});

describe.skipIf(!ready)('emulation — permission gate (owner/director only)', () => {
  let svc: DB;
  let centerId: string;
  let childId: string;
  let ownerEmail = 'owner@sandbox.kb';
  let teacherEmail = '';
  const created: string[] = [];

  beforeAll(async () => {
    svc = createClient<Database>(URL!, SERVICE!, { auth: { persistSession: false } });
    const dir = await svc.from('center_memberships').select('center_id, users!center_memberships_user_id_fkey(email)').eq('role', 'director').is('left_at', null).limit(1).single();
    centerId = dir.data!.center_id;
    const u = Array.isArray(dir.data!.users) ? dir.data!.users[0] : dir.data!.users;
    ownerEmail = (u as { email: string }).email;
    childId = (await svc.from('children').select('id').eq('center_id', centerId).eq('is_sample', false).limit(1).single()).data!.id;
    const teacher = await svc.from('center_memberships').select('users!center_memberships_user_id_fkey(email)').eq('center_id', centerId).in('role', ['lead_teacher', 'assistant_teacher', 'aide']).is('left_at', null).limit(1).single();
    const tu = Array.isArray(teacher.data!.users) ? teacher.data!.users[0] : teacher.data!.users;
    teacherEmail = (tu as { email: string }).email;
  });

  afterAll(async () => {
    if (created.length) await svc.from('emulation_sessions').delete().in('id', created);
  });

  it('a director can open an emulation session', async () => {
    const dir = createClient<Database>(URL!, ANON!, { auth: { persistSession: false } });
    await dir.auth.signInWithPassword({ email: ownerEmail, password: PASSWORD });
    const { data, error } = await dir.from('emulation_sessions').insert({ viewer_id: (await dir.auth.getUser()).data.user!.id, center_id: centerId, child_id: childId, is_sample: false }).select('id').single();
    expect(error).toBeNull();
    if (data) created.push(data.id);
    await dir.auth.signOut();
  });

  it('a non-director (teacher) CANNOT open an emulation session', async () => {
    const t = createClient<Database>(URL!, ANON!, { auth: { persistSession: false } });
    await t.auth.signInWithPassword({ email: teacherEmail, password: PASSWORD });
    const { data, error } = await t.from('emulation_sessions').insert({ viewer_id: (await t.auth.getUser()).data.user!.id, center_id: centerId, child_id: childId, is_sample: false }).select('id');
    expect(error).not.toBeNull(); // RLS refuses
    expect(data ?? []).toEqual([]);
    await t.auth.signOut();
  });
});
