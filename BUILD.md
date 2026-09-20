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

## Phase B — Directory `/students`  (pending)
## Phase C — Profile Info + Family (PencilField + DirtyProvider + batched save)  (pending)
## Phase D — Modals (About / Schedule / MultiSelect)  (pending)
## Phase E — Health / Documents / Activity tabs  (pending)
## Phase F — SAEO (Assessment → Screening → Evaluation → Observations)  (pending; needs ELOF verified)
## Phase G — Add-student wizard  (pending)

## Notes / reconciliations (see plan)
- Students module is backed by the existing `children` table (not a new `students` table). Satellites use `child_id → children`.
- Activity tab reuses `child_updates`; SAEO `observations` is a separate table.
- Routes live under `app/(dashboard)/students` → URLs `/students/...` (route group invisible).
