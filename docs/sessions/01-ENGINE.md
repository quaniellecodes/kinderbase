# Session 1 — Staffing engine + clock

Read `docs/DECISIONS.md` first — sections 2, 3, and 4 are the spec for this session.
The reference implementation is the `ENGINE` section of `docs/prototypes/kb-full.html`
(functions `rule`, `evalRoom`, `breakCheck`, `projection`, `suggestMove`). Match its
behavior; rewrite it properly in TypeScript.

**This session is logic and schema only. No UI** beyond one debug page at the end.

---

## 1. Clock — `packages/core/clock.ts`

```ts
export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() }
export function fixedClock(iso: string): Clock   // for tests
export function getClock(): Clock                // server: honors a demo override
```

- `getClock()` returns `systemClock` unless `DEMO_MODE === 'true'` and a `kb_demo_now` cookie is set.
- Grep the repo and replace every business-logic `new Date()` / `Date.now()` with the clock.
  Timestamps written by Postgres defaults are fine to leave alone.

---

## 2. Migrations

```sql
-- Qualification is separate from job title
ALTER TABLE center_memberships
  ADD COLUMN lead_qualified boolean NOT NULL DEFAULT false,
  ADD COLUMN infant_toddler_trained boolean NOT NULL DEFAULT false;
-- Later these are derived from credentials; for now they're admin-set flags.

CREATE TYPE assignment_source AS ENUM ('schedule','float','substitute','cover');

CREATE TABLE staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  user_id uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source assignment_source NOT NULL DEFAULT 'schedule',
  assigned_by uuid REFERENCES users(id),
  note text,
  created_at timestamptz DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX ON staff_assignments (classroom_id, starts_at, ends_at);
CREATE INDEX ON staff_assignments (user_id, starts_at, ends_at);
-- A user may not overlap themselves across rooms: enforce with an exclusion constraint.

CREATE TYPE nap_state AS ENUM ('awake','settling','resting');
CREATE TABLE classroom_nap_events (      -- append-only; current state = latest row today
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  state nap_state NOT NULL,
  set_by uuid NOT NULL REFERENCES users(id),
  set_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  user_id uuid NOT NULL REFERENCES users(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  engine_snapshot jsonb NOT NULL        -- the evaluation that allowed it, for audit
);

CREATE TABLE child_attendance (          -- skip if an equivalent already exists (it does: reuse ours)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  signed_in_at timestamptz NOT NULL,
  signed_out_at timestamptz
);
```

RLS on all of these, scoped to center membership. Staff breaks and cover assignments write to the audit log.

---

## 3. Engine — `packages/core/staffing-engine.ts`

Pure functions. No database access, no clock access — everything is passed in.

```ts
export const COMAR_VERSION = '13A.16 — 2025'

export type Band = 'infant' | 'toddler' | 'two' | 'preschool' | 'school'
export function bandFor(dob: Date, at: Date): Band        // 18 / 24 / 36 / 60 month cutoffs

export interface Child { id: string; dob: Date }
export interface Staff { id: string; leadQualified: boolean; infantToddlerTrained: boolean }
export interface RoomInput {
  children: Child[]           // present right now
  staff: Staff[]              // on the floor right now (assigned, not on break)
  napState: 'awake' | 'settling' | 'resting'
  at: Date
}

export interface GoverningRule {
  name: string; citation: string
  ratio: number | null        // null for §D(1) table rows
  maxGroup: number; minStaff: number
  maxTwos?: number            // §D(2) groups of 13–20
  hasUnderTwo: boolean
}

export interface Check { key: 'size'|'staff'|'lead'|'nap'; pass: boolean; message: string }

export interface Evaluation {
  ok: boolean
  status: 'ok' | 'at_minimum' | 'out'
  mix: Record<Band, number>
  rule: GoverningRule
  requiredNow: number         // reduced to 1 only when napState is 'resting' and no child is under 2
  leadsPresent: string[]
  checks: Check[]
}

export function governingRule(mix: Record<Band, number>): GoverningRule
export function isLeadFor(staff: Staff, hasUnderTwo: boolean): boolean
export function evaluate(room: RoomInput): Evaluation
export function canStepOut(room: RoomInput, staffId: string): { allowed: boolean; reasons: string[]; hint: string }
export function nextAgeTransition(room: RoomInput, withinDays = 45):
  { childId: string; inDays: number; to: Band; before: GoverningRule; after: GoverningRule } | null
export function suggestAgeMixFix(source: RoomInput, others: Record<string, RoomInput>):
  { move: string[]; to: string; minStaffBefore: number; minStaffAfter: number } | null
```

Rules to encode exactly — see `DECISIONS.md` §3:
- Age bands at 18 / 24 / 36 / 60 months. **Not 12.**
- Lead-qualified for a group = `leadQualified && (!hasUnderTwo || infantToddlerTrained)`.
- §D(1): strictest matching row for both max group and min staff.
- Lead check is waived only when resting quietly in an all-2+ group.
- Any child under 2 → no nap reduction.
- `canStepOut` removes the person and re-runs `evaluate`. Reasons must be plain English
  ("Only 1 would remain — 2 required for 4 infants"; "No lead teacher would remain — Ms. Rivera is an Aide").

---

## 4. Tests — `packages/core/staffing-engine.test.ts` (Vitest)

Every case below must pass. Build fixtures with a helper `kids(months: number[], at)`.

**Bands**
1. 17 months → infant; 18 months → toddler; 24 → two; 36 → preschool; 60 → school.
2. 6 weeks old is an infant.

**Same-age tables**
3. 6 infants → 1:3, max 6, min 2.
4. 9 toddlers → max 9, min 3.
5. 2 infants + 7 toddlers → max 9.
6. 3 infants + 3 toddlers → max 6.
7. 12 twos → 1:6, min 2.
8. 20 preschoolers → 1:10, min 2.
9. 30 school-age → 1:15, min 2.

**Mixed (§D)**
10. 4 toddlers + 2 twos → §D(1), max 9, **min 3**.
11. 3 toddlers + 3 twos → min 2.
12. 1 toddler + 6 twos → max 12, min 3.
13. 13 preschoolers + 7 twos → max-twos 6, size check fails.

**Lead**
14. Aide alone with toddlers → lead check fails.
15. Three aides with 9 infants → lead check fails even though count passes.
16. One lead + two aides with 9 infants → passes.
17. Lead-qualified but not infant/toddler trained, in an infant room → counts as an Aide.

**Nap & breaks**
18. 4 infants, lead + aide, `resting` → requiredNow stays 2; lead cannot step out.
19. 4 toddlers + 2 twos, `resting` → no reduction (youngest governs).
20. 18 preschoolers, 2 leads, `settling` → neither can step out.
21. Same room, `resting` → one may step out; the second may not.
22. Same room, back to `awake` with one on break → status `out`.
23. Blocked-break reasons name the remaining staff and their roles.

**Projection & fix**
24. A toddler 11 days from 24 months in a 4-toddler + 2-two room → `nextAgeTransition` returns her, and `after.minStaff` is 2.
25. `suggestAgeMixFix` on 4 toddlers + 2 twos, with a 3–4 room of 18 and 2 leads → moves the twos there; source drops from 3 to 2; target stays compliant.
26. `suggestAgeMixFix` returns null when no room can take them.

---

## 5. Data access — `packages/core/queries/room-state.ts`

`loadRoomInput(classroomId, clock)` assembles a `RoomInput` from Supabase:
children with an open `child_attendance` row, staff with an assignment covering `clock.now()`
minus open `staff_breaks`, qualifications from `center_memberships`, latest nap event today.

`activeClassroomFor(userId, clock)` returns the classroom whose assignment covers now, or null.

---

## 6. Debug page — `/dev/staffing` (only when `DEMO_MODE=true`)

One table: every classroom at the active center with its mix, governing rule + citation,
required vs present, lead present, nap state, status, and the next age transition.
A time input that sets the `kb_demo_now` cookie. No styling beyond the design system.
This is how we verify against the real seed data before any UI is built.

---

## 7. Seed data

Add to the demo seed:
- An infant room with 4 present infants aged 7–12 months, 1 lead + 1 assistant.
- A toddler room with 4 toddlers (18–23 months) and 2 two-year-olds, 1 lead — should read **out**, needing 3.
- A preschool room of 18, 2 leads.
- One float with `lead_qualified = true`, `infant_toddler_trained = false`.
- One assistant scheduled in the infant room until 12:00 and the toddler room after.

---

## Done when

- All 26 tests pass.
- `/dev/staffing` shows the toddler room as out with the §D(1) rule, at 9:00 and at 12:30.
- No business logic reads the system time directly.
- `BUILD.md` is updated.
