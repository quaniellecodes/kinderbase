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
## Phase E — Health / Documents / Activity tabs  (done)
- [x] `access.ts` — shared `studentContext`/`isEditor`/`orNull` guard for the new action files
- [x] Health: `health-actions.ts` + `HealthEditor`/`HealthPanel` — allergies/medications/diet/conditions (`student_health`, severe → red emphasis + rescue-med fields) and physicians (`student_physicians`); add/edit/remove via modals; admin/director-gated
- [x] Documents: `documents-actions.ts` + `DocumentsEditor`/`DocumentsPanel` — register with status (current/review_due/missing/na), required + confidential flags; **confidential rows hidden from non-admins in the query**; add/edit/delete + file upload (re-upload creates a superseding row, `superseded_by`)
  - Storage: private `student-documents` bucket (migration `022`; created in sandbox); `lib/storage/student-documents.ts`; download via `GET /api/students/[id]/documents/[docId]` → 15-min signed URL, member-gated (confidential → admin), never public
- [x] Activity: `activity-actions.ts` + `ActivityPanel` — read-only merged timeline of `child_updates` (care log) + `child_attendance` sign-in/out, newest first
- [x] Wired health/documents/activity tabs into the profile; only SAEO remains a placeholder
- [x] seed.ts: 35 health items (severe allergy + meds/diet/conditions), 38 physicians, 152 docs (incl. review_due + confidential); reset unaffected (all cascade via children)
- Verified in sandbox: 9 review_due, 8 confidential, meds/diet/conditions present, 38 physicians; migration 022 bucket present; tsc + build + 34 core tests green
- Deferred: none functionally — upload path is live; (no file bytes in seed, so downloads appear once a file is uploaded)
## Phase F — SAEO  (done)
SAEO tab with sub-nav (`?tab=saeo&saeo=`): Assessment · Observations · Screening · Evaluation.
- [x] `saeo-actions.ts` — context (child's ELOF view from age, framework availability, photo consent), goal options, observations (create with goal tags + consent-gated photo, soft delete), checkpoints (list + create; 90-day period; view from age)
- [x] Observations: `ObservationsSection` + `ObservationsClient` — list (goal-code chips, signed photo), composer modal (goal multiselect by code, photo gated on `photo_consent`)
- [x] Assessment: `AssessmentSection` + `NewCheckpointButton`; checkpoint list → rating screen `/students/[id]/checkpoint/[cpId]`
- [x] Rating screen: `checkpoint-actions.ts` (`getCheckpointDetail` = domains→subdomains→goals + current age-band progression + ratings + observation evidence per goal; `rateGoal` autosave [locked unless draft]; `setCheckpointStatus` submit/reopen) + `CheckpointRating` (domain rail, progress, submit/lock) + reusable `GoalRatingRow` (segmented control, note, evidence chips, per-row autosave)
- [x] `SaeoPanel` wired in; preschool view shows a "content not loaded" notice (IT-only per plan)
- [x] seed.ts: 6 observations (goal-tagged) + 3 draft checkpoints (12 ratings each) on IT children; cascade via children on reset
- Verified: 3 checkpoints × 12 ratings, 6 observations w/ goal links (demo: Elena Hayes); tsc + build + 34 core tests green
- [x] Screening: `screening-actions.ts` + `ScreeningClient`/`ScreeningSection` — read-only current results + corrected-history expander; admin "Record result" (insert); corrections insert a new row and set `superseded_by` on the old (service role, since screenings have no UPDATE policy)
- [x] Evaluation: `evaluation-actions.ts` (+ `evaluation-constants.ts` for stage flow/labels — can't export non-fns from a "use server" file) + `EvaluationClient`/`EvaluationSection` — referral stage tracker, Part C/B by age with suggested agency, **Part C→B turning-3-within-90-days amber banner**, advance-stage control (stamps dates), contribute-input composer (attaches observations), plan goals (IFSP/IEP) when eligible/services_active
- [x] seed.ts: 3 screenings (incl. one "refer"), 1 fully worked referral (services_active, IFSP, 1 input w/ 2 observations attached, 2 plan goals); all cascade via children on reset
- Verified in sandbox; tsc + build + 34 core tests green. **Phase F complete.**
- Gotcha logged: `"use server"` files may export only async functions — stage constants/`compactAge`-style values must live in a plain module.
## Phase G — Add-student wizard  (done)
- [x] `new-actions.ts` — `getNewStudentOptions` (classrooms + language/tag suggestions) + `createStudent` (admin/director gated via active context); generates `student_code`, inserts a primary guardian, seeds `student_about`/`student_schedule` shells, and creates a current-period ELOF checkpoint when a framework exists for the age
- [x] `WizardClient` — 4 steps (Identity · Enrollment · Family · Review) with a stepper + progress bar, per-step validation, and a localStorage draft (survives refresh, cleared on create); on success redirects to the new profile
- [x] `/students/new` page now renders the wizard (admin-gated), replacing the stub
- Verified: tsc + production build (all student routes) + 34 core tests green

---

## ELOF — all age groups seeded
- Infant/Toddler view: 5 domains / 21 sub-domains / 59 goals / 177 progressions (`it-*.json`)
- Preschool view: 7 domains / 24 sub-domains / 59 goals / 134 progressions (`ps-*.json`) — Literacy, Mathematics, and Scientific Reasoning split out from Cognition per the official framework; sourced verbatim from the OHS ELOF PDF
- Seeder `bandToMonths` is generic (parses any "A to B Months" / "By N Months" label); progression `sort_order` = array index. Demo seed now creates preschool checkpoints/observations too (3 IT + 2 preschool checkpoints).
- Note: `seed:elof` standalone requires a clean framework (no dependent checkpoints/observations, which are RESTRICT); use `seed:reset` to refresh framework content — the seeder now says so on failure.

## Status: all phases A–G complete + ELOF all ages. `feat/students` ready for review/PR.
Deferred/notes: document file bytes aren't seeded (upload path is live); no notifications on screening/referral events.

## Notes / reconciliations (see plan)
- Students module is backed by the existing `children` table (not a new `students` table). Satellites use `child_id → children`.
- Activity tab reuses `child_updates`; SAEO `observations` is a separate table.
- Routes live under `app/(dashboard)/students` → URLs `/students/...` (route group invisible).

---

# Mobile track (branch `feat/mobile-engine`, stacked on `feat/students`)

Spec: `docs/DECISIONS.md` + `docs/sessions/*` + `docs/prototypes/kb-full.html`. Six sessions: engine → classroom → today/me → admin → messaging → demo sandbox.

## Phase 0 — artifacts + source of truth (done)
- `docs/DECISIONS.md`, `docs/sessions/00–06`, `docs/prototypes/README.md`; CLAUDE.md "Source of truth" pointer. Locked mappings: students→children, activity_posts→child_updates(+observations), 18/24/36/60-mo bands, demo DB = sandbox, mobile `app/(mobile)/m`, `/demo` under DEMO_MODE.

## Phase 1 — Staffing engine + clock (done; session 01)
- [x] **Age band corrected to 18-month center cutoff** (`COMAR_AGE_BANDS` in packages/types; toddler max-group 6→9 in `computeRatio`). ⚠ Confirm 18-mo band + §D(1)=3-staff reading with an OCC licensing specialist before partner demos.
- [x] `packages/core/clock.ts` (Clock/systemClock/fixedClock) + `apps/web/lib/clock.ts` `getClock()` (honors `kb_demo_now` cookie under DEMO_MODE). Note: getClock lives app-side (cookie needs next/headers); core stays framework-agnostic.
- [x] `packages/core/comar-engine.ts` — `bandFor`, `governingRule` (§C same-age + §D(1)/§D(2) tables), `isLeadFor`, `evaluate` (size/staff/lead/nap checks), `canStepOut`, `nextAgeTransition`, `suggestAgeMixFix`, `COMAR_VERSION`. Legacy `computeRatio` shim kept for the desktop.
- [x] `packages/core/comar-engine.test.ts` — **all 26 cases from 01-ENGINE.md green** (60 core tests total incl. existing).
- [x] Migration `023_staffing_engine.sql` — `staff_assignments`, `classroom_nap_events`, `staff_breaks`, `cover_sessions`, `center_memberships.lead_qualified/infant_toddler_trained`; center-membership RLS. Applied to sandbox.
- [x] `apps/web/lib/staffing/room-state.ts` — `loadRoomInput` (present children + assigned-minus-break staff + quals + latest nap event) and `activeClassroomFor`. (Lives app-side, not packages/core/queries, so core stays pure.)
- [x] `/dev/staffing` debug page (DEMO_MODE-gated) + `DevClock` (sets `kb_demo_now`). Reads live data through the engine per room.
- [x] Seed: qualification flags by role (assistants lead-qualified; substitutes = lead-qualified floats w/o IT course; aides neither), and `staff_assignments` for present staff (understaffed focus room reads OUT). `DEMO_MODE=true` added to `.env.local`.
- Verified: 60 core tests + tsc + production build green; migration applied; sandbox reseeded; Infant Room shows 6 infants / 1 staff → engine OUT.
- **Deferred to later phases:** explicit §D(1) "toddler+twos out" demo room → Phase 6 scenario system (06-DEMO §5); full-repo `new Date()` sweep beyond the engine path (remaining ones are display/seed, not compliance logic); the DEMO_MODE↔prod-URL safety assertion → Phase 6 §1.

## Phase 2 — Mobile shell + Classroom (session 02)

### Phase 2a — shell + Classroom Overview wired to the live engine (done)
- [x] `app/(mobile)/m/layout.tsx` (auth + active-context gate, phone shell), `MobileNav` (Today · Classroom · ＋ · Messages · Me, raised center ＋ with quick-add sheet), reusable `components/mobile/BottomSheet` (drag handle, backdrop close, safe-area).
- [x] Active-room resolution: `/m` → `/m/today`; `/m/classroom` resolves assignment-now → `kb_active_room` override → admin default → `/m/classroom/[id]` (via `activeClassroomFor`).
- [x] Migration `024_child_updates_mobile.sql` — `child_updates.covering` + `goal_codes` (our activity_posts). Applied to sandbox; database.ts updated.
- [x] `/m/classroom/[id]` — header (room, staff-on-floor, live compliance pill → why sheet) + tabs (Overview · Lesson plan · Schedule · Feed). **Overview is fully wired to the COMAR engine**: Here/Staff/Required/Need-update numbers, compliance strip + why sheet (per-check pass/fail, rule + citation, mix), In-the-room staff with Lead/Aide pills + **Break/Back enforced by `canStepOut`** (blocked break opens the why sheet with plain-English reasons + hint), nap control (Settling/Resting/Nap-over), children grid (tap → log sheet, Select-multiple → batch), Quick-log (Batch nap/meal open a preset log). **Feed** tab live (child_updates). Lesson-plan/Schedule tabs are "coming next" placeholders.
- [x] `classroom/actions.ts` — `getMobileRoom` (loadRoomInput + evaluate + roster/staff/allergy), `getRoomFeed`, `logChildUpdate` (covering flag for admins), `setNapState`, `startBreak` (engine-enforced, snapshots the evaluation), `endBreak`.
- [x] Navigable stubs: `/m/today` (greeting + open-classroom), `/m/me` (profile link), `/m/messages` (Session-5 placeholder).
- Verified: tsc + production build (all /m routes) + 60 core tests green; migration applied. `DEMO_MODE` served on :3000 (desktop) and :3001 (mobile/demo).

### Phase 2b — Lesson plan + Schedule tabs + picker (done)
- [x] Migration `025_lesson_plans_routines.sql` — `lesson_plans`, `lesson_plan_days` (OMH template: question / circle parts+notes / outdoor / 4 stations), `classroom_routines`; center-member RLS. Applied; database.ts updated.
- [x] Lesson plan tab: week + status pill, theme/letter/number/shape, 20-block progress, MonâFri day chips (n/4), four section cards; **lead-only editing** via section sheets (Circle Time part toggles), **Copy last week** (fills incomplete days), **Submit** (blocked until 20/20; returned→Resubmit with reviewer comment), read-only banner for non-leads. Actions: `getLessonPlan`/`savePlanDay`/`copyLastWeek`/`submitPlan` (`isRoomLead` gate).
- [x] Schedule tab: `classroom_routines` timeline with the current block marked **NOW**, past dimmed, staff avatars on the current + next two blocks. Action: `getRoutine`.
- [x] Classroom **picker** sheet (header room name → switch rooms) via `getRoomOptions`.
- [x] Seed: 11-block daily routine per room + a current-week lesson plan per room (first room draft/partial, second returned-with-comment, rest submitted).
- Verified: tsc + build + 60 core tests green; migration applied; sandbox reseeded (88 routines, 8 plans).

### Phase 2c — pending
Voice observation (record → transcript sheet → tag children + ELOF goal chips → post one `child_updates` per child with `goal_codes`), room-briefing sheet on active-room change, extra log types (diaper/mood/photo).

## Phase 3–6 — pending (today/me, admin, messaging, /demo sandbox)
