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
