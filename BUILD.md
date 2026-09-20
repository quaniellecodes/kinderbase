# Students module — build log

Branch `feat/students` (off reconciled `main`). Phased per the approved plan.

## Phase A — primitives + migrations + types + ELOF
- [x] Reconcile `main` (merge staff profile #2 + UI kit #3 that had merged into intermediate stacked branches, not main)
- [x] Migration `020_students_profile.sql` — extend `children`; add `guardians`, `authorized_pickups`, `student_health`, `student_physicians`, `student_documents`, `student_descriptors`, `student_about`, `student_schedule`, `student_siblings`; `child_attendance` sign-in-by/method cols; RLS (confidential docs admin-only)
- [x] Migration `021_saeo.sql` — frameworks + domains/subdomains/goals/progressions/crosswalks, rating_levels, checkpoints/ratings, observations(+goals), screenings (insert-admin, no update/delete), referrals/inputs/plan_goals; RLS
- [x] New primitives: `StatusDot`, `ProgressBar`, `EmptyState`, `Toast`/`Toaster`, `DayToggleRow`, `MultiSelectField` (+ `Toaster` mounted in dashboard layout)
- [x] `packages/types/database.ts` — all new tables/columns
- [ ] `PencilField` + `DirtyProvider` — deferred to Phase C (built with its consuming Info/Family screens)
- [x] ELOF content (Infant/Toddler view): sourced verbatim from official Office of Head Start 2015 ELOF PDF/pages → `supabase/seed/elof/it-{atl,c,lc,pmp,se}.json`; idempotent `seed-elof.ts` (+ `seed:elof` script, called from `seed.ts`); seeded + **verified in sandbox**: 5 domains / 21 sub-domains / 59 goals / 177 age-band progressions (0 empty), 4 system rating levels
  - Preschool view (36–60mo) deferred per user ("IT view first, verify, then preschool") — add `ps-*.json` + reseed; `bandToMonths` already handles 36–48 / 48–60 bands
  - Age bands: Birth to 9mo → (0,9); 8–18mo → (8,18); 16–36mo → (16,36). "Emerging" is the framework's verbatim descriptor for some early bands (not a gap)

## Phase B — Directory `/students`  (done)
- [x] Sidebar + BottomNav: "Students" nav (admin between Dashboard/Staff; teacher after Dashboard; mobile bottom tab)
- [x] `students/actions.ts` — `getStudentDirectory` (cards: age, room, present StatusDot, tags, alert flags) + `getStudentHeader`; center-member-scoped; `compactAge` helper
- [x] `students/page.tsx` + `StudentsClient.tsx` — search, room/status/tag filters, grid⇄list toggle, alert icons (severe allergy / missing required docs / COMAR reclass ≤14d), EmptyState
- [x] `students/[id]/page.tsx` — navigable profile shell: hero (avatar, name, age, room, status, tags), severe-allergy Alert banner, `?tab=` TabBar (6 tabs) with placeholder panels (fill in Phases C–F)
- [x] `students/new/page.tsx` — admin-gated stub (wizard is Phase G) so "Add student" isn't a dead link
- [x] seed.ts: student-module detail — tags (~1/3), 1 waitlist + 1 inactive per center, 1 severe allergy per center, required docs (some missing); reset cascades via `children`
- Verified in sandbox (48 kids): 16 tagged, 12 missing-docs, 1 severe allergy, 35 present; tsc + build + 34 core tests green
## Phase C — Profile Info + Family (PencilField + batched save)  (done)
- [x] `PencilField` (ui) — controlled inline click-to-edit; text/textarea/date/select/boolean(toggle)/multiselect; dirty dot + pencil affordance
- [x] `useDirtyForm` hook (components/students) — baseline diff, changed-only patch, `beforeunload` guard, `router.refresh()` + baseline advance on save; `DirtySaveBar` (sticky "N unsaved · Discard · Save")
  - Note: implemented as a per-tab hook rather than a page-wide DirtyProvider context — tabs are separate RSC (`?tab=`), so page-wide sharing isn't needed; same UX (dirty count / discard / save / unload guard)
- [x] `student-detail-actions.ts` — `getStudentInfo`/`updateStudentInfo` (children columns, whitelisted, empty→null, first/last never nulled); `getStudentFamily`/`saveFamily` (guardians + pickups, ownership-checked, namespaced `g:/p:` keys); `addGuardian`/`deleteGuardian`/`addPickup`/`deletePickup`; all admin/director-gated
- [x] Info tab: Identity / Enrollment / Address / Consent+notes sections; classroom + status selects; home-languages & tags multiselect; admin_notes admin-only
- [x] Family tab: guardian cards (inline edit + Primary/Emergency/Restricted badges + add/remove), authorized pickups (add/remove), siblings (display-only links); `FamilyPanel` remounts (key on row-id signature) so add/remove resets the dirty baseline
- [x] seed.ts: 1–2 guardians per child (mother primary+emergency, ~60% father), ~20% a grandparent pickup, siblings linked by shared last name within a center
- Verified in sandbox: 77 guardians / 9 pickups / 76 sibling links; sibling embed FK (`student_siblings_sibling_id_fkey`) confirmed; tsc + build + 34 core tests green
## Phase D — About / Schedule cards + modals  (done)
- [x] Two-column profile layout: hero on top, left rail (About + Schedule cards) + right (allergy banner + tabs)
- [x] `AboutCard` — amber "About <name>" card; grouped descriptor chips + note; edit Modal with a `MultiSelectField` per group (9 ABOUT_GROUPS) + note; inline "+ Add" creates reusable center-scoped descriptors on save
- [x] `ScheduleCard` — days (`DayToggleRow`) + drop-off/pickup windows + transition room/date; edit Modal
- [x] `about-schedule-actions.ts` — get/save About (`student_about` upsert + persists new labels to `student_descriptors`) and Schedule (`student_schedule` upsert, `days` jsonb `{days:number[]}`); admin/director-gated
- [x] `lib/students/about.ts` — 9 stable ABOUT_GROUPS (keys shared with seeder)
- [x] seed-elof.ts: seed 49 default descriptors (center_id null) across 9 groups, idempotent
- [x] seed.ts: ~half of children get an About profile; all get a Mon–Fri schedule; reset now clears center-scoped descriptors before deleting the center (RESTRICT FK)
- Verified in sandbox: 49 default descriptors / 9 groups, 24 About rows, 48 schedules, 0 orphaned center descriptors; tsc + build + 34 core tests green
- MultiSelect surface (home languages / tags) is already handled inline on the Info tab (Phase C), so no separate modal needed
## Phase E — Health / Documents / Activity tabs  (pending)
## Phase F — SAEO (Assessment → Screening → Evaluation → Observations)  (pending; needs ELOF verified)
## Phase G — Add-student wizard  (pending)

## Notes / reconciliations (see plan)
- Students module is backed by the existing `children` table (not a new `students` table). Satellites use `child_id → children`.
- Activity tab reuses `child_updates`; SAEO `observations` is a separate table.
- Routes live under `app/(dashboard)/students` → URLs `/students/...` (route group invisible).
