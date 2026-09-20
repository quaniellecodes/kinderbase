# KinderBase — Claude Code Context

Living document. Update after every session.

---

## Session end state (2026-09-20)

**Current branch: `feat/students`** (off reconciled `main`) — the **Students module**, all phases A–G complete and pushed. See [BUILD.md](BUILD.md) for the phase-by-phase log. Latest commit is the Phase G wizard.

**Students module (this session):** directory `/students` (search/filters/grid-list, alert icons) → profile `/students/[id]` with hero + About/Schedule rail + tabs: **Info & Family** (inline `PencilField` + batched save + beforeunload), **Health** (allergies/meds/diet/conditions + physicians), **Documents** (status/required/confidential, signed-URL download route `/api/students/[id]/documents/[docId]`, upload with supersede), **Activity** (child_updates + attendance timeline), **SAEO** (Assessment checkpoints → rating screen `/students/[id]/checkpoint/[cpId]` with domain rail + age-band progressions + autosave + submit-lock; Observations; Screening; Evaluation with Part C/B + turning-3 banner). Add-student wizard `/students/new`. Backed by the existing `children` table; migrations 020–022; ELOF Infant/Toddler seeded verbatim (5 domains/21 sub/59 goals/177 progressions). New UI primitives: `StatusDot`, `ProgressBar`, `EmptyState`, `Toast`, `DayToggleRow`, `MultiSelectField`, `PencilField`.

**Prior branches / PRs (pre-this-session):**
- `feat/sandbox-seed-cli-workflow` → **PR #1**: sandbox + Supabase CLI two-project workflow, OCC 1206 staffing pattern (Save/Reset + per-room hours), Auto/Manual ratio override, children domain, admin dashboard, tabbed classroom detail.
- `feat/staff-profile` → **PR #2** (stacked on PR #1): staff profile screen `/staff/[userId]` (admin + employee self-view), migration 019, requests area; plus dead-end cleanup and a small-screen responsive pass.
- UI-kit extraction + login-fix were reconciled into `main` before branching `feat/students`.

**Students-module deferred:** preschool ELOF view not seeded (IT-only per plan; seeder already handles preschool age bands once `ps-*.json` added); document file bytes not seeded (upload path live); Screening/Evaluation are functional but no notifications.

**Built & working:** classroom detail (Overview/Activity/Staffing/Children tabs) with real-time ratios; staffing-pattern grid (drag shifts, child counts, Save/Reset, per-room hours + Auto/Manual COMAR ratio); children domain (enrollment/attendance/care updates); admin dashboard (out-of-ratio banner, stat cards, ratio list); staff profile (hero/score modal/contact/availability/quick actions + Schedule/Credentials/Attendance/Time-history/Notes tabs); requests list + new-request form. Sandbox seeded (medium scale) with staff = **female names of Black descent**; owner login `owner@sandbox.kb` / `Sandbox!23456`.

**Known deferred / cosmetic (not bugs):** Nudge/Message/Send-notification record an `activity_log` row + toast only (no real delivery/inbox); edge functions (`shift-reminder`, `credential-expiry-alerts`) exist but aren't scheduled; teacher-score computation is display-only (nightly job = Session 9, `packages/core/teacher-score.ts`); "Assign float" links to the staffing tab (no float workflow); OCC 1206 PDF export + ADP integration (CSV only) unbuilt; Settings→Parent kiosk intentionally disabled.

**Next candidates:** apply the same responsive tab-bar fix to the classroom detail; reseed sandbox to clear unused legacy `staffing_patterns` rows; then original roadmap Session 8 (OCC exports + PDF).

---

## What this is

Childcare management platform for OCC-licensed centers in Maryland. Owner operates three Baltimore child care centers. Ships on web (Next.js 14 App Router) + iOS/Android (Capacitor 5 wrapping the same web app).

---

## UI kit (`apps/web/components/ui/`)

Shared, variant-driven primitives — **use these for new work instead of hand-rolled Tailwind**, so a redesign is a one-file change. Built on `cn()` ([lib/utils.ts](apps/web/lib/utils.ts)) + `class-variance-authority`; design tokens stay in `tailwind.config.ts` (`brand`, `status.*`, `rounded-card/chip/shell`).

| Primitive | Notes |
|---|---|
| `Button` / `buttonVariants` | variants `primary\|secondary\|danger\|ghost\|chip`, sizes `sm\|md\|lg`. Use `buttonVariants({variant})` on a `<Link>`/`<a>` |
| `Card` | padding `compact\|default\|spacious` |
| `Badge` | tones `neutral\|green\|amber\|red\|blue\|purple\|indigo\|sky` (domain badges — RatioBadge, CredentialStatusBadge, UpdateTypeChip — wrap this) |
| `TabBar` | button-mode (`onSelect`) or link-mode (`hrefFor`); scrollable, optional count badge |
| `Input` / `Textarea` / `Select` / `Label` | standard field styling |
| `Modal` | Radix Dialog wrapper — Escape/focus-trap/ARIA/backdrop-close for free |
| `Alert` | inline notice, tones `amber\|red\|green\|indigo` |
| `Avatar` / `StatCard` | initials avatar; stat tile |

Migrated so far (reference implementations): staff profile + requests screens. Other screens still use inline Tailwind on the same tokens — migrate opportunistically. shadcn is intentionally not initialized.

---

## Monorepo layout

```
apps/web/          Next.js 14 app (web + mobile via Capacitor)
packages/core/     Staffing engine, shared business logic (server-only)
packages/types/    Database types (database.ts) + shared types/helpers (index.ts)
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Mobile | Capacitor 5 (wraps the Next.js app) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (`@supabase/ssr ^0.10.2`) |
| Storage | Supabase Storage (private bucket `credentials`) |
| Edge Functions | Supabase Edge Functions (Deno) |
| UI | shadcn/ui + Tailwind CSS |
| Package manager | pnpm workspaces |
| TypeScript | strict mode — no `any` |
| Email | Resend |
| PDF | react-pdf (deferred to Session 8) |
| Tests | Vitest |

---

## Supabase projects

Two projects share one schema (see **Two Supabase projects** below). `.mcp.json` defines an MCP server for each:

| Env | Project ref | MCP server name |
|---|---|---|
| prod | `jqbvojjgkkhbndsgbsuo` | `supabase-prod` |
| sandbox (dev) | `kbdfbxavmgvonscezjux` | `supabase-sandbox` (default for queries) |

MCP servers load at startup — reload Claude Code and approve them after editing `.mcp.json`.

---

## Supabase client helpers (`apps/web/lib/supabase/`)

| File | Use |
|---|---|
| `server.ts` | `createClient()` — server components, Server Actions; reads auth cookies |
| `middleware.ts` | `createMiddlewareClient()` — Next.js middleware only |
| `server.ts` | `createServiceClient()` — bypasses RLS; server-only; used for public profile reads and storage ops |

**Critical:** `setAll` cookie callback must be typed `options: CookieOptions` (imported from `@supabase/ssr`), not `Record<string, unknown>`. Wrong type silently breaks all DB generics.

---

## Database types (`packages/types/database.ts`)

Hand-written from migrations. Regenerate with:
```
pnpm dlx supabase gen types typescript --project-id jqbvojjgkkhbndsgbsuo > packages/types/database.ts
```

Required shape for supabase-js 2.103.3:
- Top level: `__InternalSupabase: { PostgrestVersion: '11' }`
- Every table needs `Relationships: []` (not omitted)
- `Views: {}` and `Functions: {}` (empty objects, not `Record<string, never>`)

---

## Non-negotiable rules

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client** — service client is server-only
2. **All credential file access via signed URLs only** — 15-min expiry, never public URLs
3. **Staffing engine server-only** — only called from Route Handlers or Server Actions
4. **Every migration is additive** — no `DROP` or `RENAME` columns
5. **RLS always on** — fix policies, never `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
6. **Soft delete only** — `deleted_at` timestamp; never hard `DELETE` on users/credentials/memberships
7. **All Capacitor plugin calls through `lib/mobile/capacitor.ts`** — no direct plugin imports elsewhere
8. **TypeScript strict mode** — no `any`
9. **No Postgres generated columns using `CURRENT_DATE`** — not immutable; compute status in TypeScript via `computeCredentialStatus()`

---

## Migrations

| File | Description |
|---|---|
| `001_organizations_centers.sql` | organizations, centers |
| `002_users_memberships.sql` | users, center_memberships |
| `003_credentials.sql` | credentials, credential_audit_logs |
| `004_centers_state.sql` | adds `state char(2) DEFAULT 'MD'` to centers |
| `005_users_bio.sql` | adds `bio text` to users |
| `006_classrooms.sql` | classrooms + staffing_patterns tables + RLS |
| `007_time_entries.sql` | time_entries + push_tokens tables + RLS |
| `008_activity_log.sql` | activity_log table + RLS + center_created index |
| `009_white_label_kiosk.sql` | white-label / kiosk columns |
| `010_kiosk_pin.sql` | adds `kiosk_pin` to users |
| `011_org_icon.sql` | adds `icon_path` to organizations |
| `012_rls_centers_memberships.sql` | RLS policies for centers + memberships (was `002b`; renumbered for CLI ordering) |
| `013_employment_history.sql` | employment_history table + RLS policy (was `003b`; renumbered for CLI ordering) |
| `014_fix_centers_rls.sql` | replaces circular `centers_org_members` policy with non-recursive `centers_member` (idempotent; prod already had the hand-applied equivalent) |
| `015_staffing_pattern_occ1206.sql` | OCC 1206 grid: `classroom_staff` roster + `staff_shift_slots` (30-min cells) + `classroom_child_counts`; adds `open_slot`/`close_slot`/`operating_days` to centers, `pattern_effective_date` to classrooms; RLS with USING+WITH CHECK. Deprecates the old hourly `staffing_patterns` table |
| `016_classroom_hours_override.sql` | per-classroom hours/days override (nullable, all-or-none) inheriting center defaults |
| `017_children_domain.sql` | `children`, `child_attendance` (daily sign-in), `child_updates` + `child_update_children` (care log with multi-child tags); RLS |
| `018_classroom_ratio_override.sql` | per-classroom Auto/Manual ratio override columns (`ratio_children_per_staff`, `ratio_max_group`) |
| `019_staff_profile.sql` | `staff_notes` (admin-only RLS), `teacher_scores` (display-only), `staff_profiles` (emergency contact/availability/leave balances), `staff_leave_days`, `staff_requests` (schedule/time_correction/leave) |
| `020_students_profile.sql` | Students module: extends `children` (preferred/middle name, `student_code`, `enrollment_status`, sex, languages, tags, address, photo consent, admin notes); `child_attendance` sign-in-by/method; satellites `student_siblings`, `guardians`, `authorized_pickups`, `student_health`, `student_physicians`, `student_documents` (confidential admin-only RLS), `student_descriptors` (center/null defaults), `student_about`, `student_schedule` |
| `021_saeo.sql` | SAEO: `frameworks`/`framework_domains`/`framework_subdomains`/`framework_goals`/`goal_progressions`/`goal_crosswalks`, `rating_levels`, `checkpoints`/`checkpoint_ratings`, `observations`/`observation_goals`, `screenings` (insert-only, no UPDATE/DELETE), `referrals`/`referral_inputs`/`plan_goals`. Framework reference tables readable by any authed user (seeded via service role) |
| `022_student_documents_bucket.sql` | private `student-documents` storage bucket (idempotent); access only via service role + signed-URL route. **Applied to sandbox via MCP; run `db:push` on prod** |

**Newer migrations use both `USING` and `WITH CHECK` in every RLS policy** (older ones omitted `WITH CHECK` — a gap fixed going forward).

Applied via the Supabase CLI (`pnpm --filter @kinderbase/web db:push`), not the SQL editor — see **Two Supabase projects** below. Files are ordered by numeric prefix; `012`/`013` (formerly `002b`/`003b`) only depend on tables from `001`/`002`, so running them last is dependency-safe. Verify with `SELECT * FROM information_schema.tables WHERE table_schema = 'public'` after.

---

## Two Supabase projects (prod + sandbox)

Schema (the `migrations/` files) is the single source of truth applied to **both** projects; only data differs. The **sandbox is the day-to-day dev DB** (`.env.local` points at it); prod stays pristine and only gets verified schema.

| Project | Ref | Role |
|---|---|---|
| prod | `jqbvojjgkkhbndsgbsuo` | real data; MCP server points here; never seeded |
| sandbox | `$KB_SANDBOX_REF` | dev DB; `.env.local` → this; gets `seed.ts` fake data |

CLI is initialized (`apps/web/supabase/config.toml`). Scripts (run from repo root, `--filter @kinderbase/web`): `db:link:prod`, `db:link:sandbox` (needs `KB_SANDBOX_REF` env), `db:push`, `db:diff`, `db:migrate` (new migration), `seed`, `seed:reset`.

**Schema-change loop:** write `NNN_*.sql` (additive) → `db:link:sandbox` + `db:push` + `seed:reset` → verify → `db:link:prod` + `db:push` → regenerate `packages/types/database.ts`.

**Prod is already migrated by hand** — baseline it once so the CLI won't re-run: `db:link:prod` then `supabase migration repair --status applied 001 002 003 004 005 006 007 008 009 010 011 012 013`.

`seed.ts` refuses to run against the prod ref unless `--i-know` is passed.

---

## Public profile page (`/t/[handle]`)

- SSR, no auth required
- Uses `createServiceClient()` to read past RLS
- `notFound()` if handle missing or `profile_public = false`
- Components: `PublicProfileHero`, `CredentialTable`, `EmploymentHistory`, `ConversionBar`
- Open Graph + Twitter card metadata via `generateMetadata`
- Sticky `ConversionBar` has "Are you [name]?" → modal with Create account / Sign in

---

## Session roadmap

| Session | Status | Scope |
|---|---|---|
| 1 | ✅ Done | Monorepo scaffold, auth, RoleSwitcher, Sidebar/BottomNav, active context, migrations 001–002 |
| 2 | ✅ Done | Credential portfolio — CredentialForm (camera scan), CredentialCard, My Credentials page, Storage helpers, expiry alert Edge Function |
| 3 | ✅ Done | Public profile `/t/[handle]` — hero, credential table, employment history, sticky conversion bar, Open Graph |
| 4 | ✅ Done | Classrooms + staffing engine — migration 006, `packages/core/staffing-engine.ts` (9 Vitest tests), ClassroomForm, PatternBuilder grid, RatioBadge, classroom detail page |
| 5 | ✅ Done | Time tracking + push notifications — migration 007, ClockButton (running timer + haptic), TimeSheet (staff/admin views), /api/push/register, shift-reminder Edge Function |
| 6 | ✅ Done | Activity feed — migration 008, activity_log table, logActivity helper, ActivityFeed component, dashboard wired with real stats + live feed |
| 7 | Next | White-labeling + kiosk mode |
| 8 | Planned | OCC exports + PDF (react-pdf) |

---

## Multi-state expansion

KinderBase is built for Maryland first but designed to expand to other states.

- `centers.state` (char 2, default `'MD'`) is the source of truth for which state's rules apply
- `occ_license_number`, `occ_region`, and `license_type` are MD/OCC-specific — future states will add their own license fields via additive migrations
- Credential type enums are MD training requirements — extend the enum as new states are added; don't generalize prematurely
- **Staffing engine (Session 4+) must be `computeRatios(classrooms, state)`** — never hardcode MD ratios directly; put them in a `MD` key of a state-keyed rules map

---

## Known gotchas

- **Cookie writes in layouts**: `cookies().set()` throws in Server Components. Use the `/api/init-context` Route Handler to set `kb_active_context` on first login. Only `switchActiveContext` (Server Action) and that route handler should write this cookie.
- **Nav hrefs**: The `(dashboard)` route group is invisible in URLs — all routes inside it are at `/`, not `/dashboard/`. Sidebar and BottomNav use `/classrooms`, `/credentials`, etc.
- **`centers_org_members` RLS policy is circular** — was replaced with `centers_member` which directly checks `center_memberships` without self-referencing `centers`.
- **`public.users` is not auto-populated** — signing up via Supabase Auth creates `auth.users` but NOT `public.users`. Seed users manually or add a trigger.

- **`@supabase/ssr` version**: must be `^0.10.2`. Earlier versions import from a dist path that no longer exists in supabase-js 2.103.3, causing all typed queries to silently return `never`.
- **pnpm store**: if you see `ERR_PNPM_UNEXPECTED_STORE`, run `pnpm config set store-dir /Users/quanielleturner-moore/.local/share/pnpm/store/v10 --global`
- **Supabase Edge Functions** live in `apps/web/supabase/functions/` and use Deno globals — excluded from `apps/web/tsconfig.json`.
- **`credential_type` in form actions**: cast `formData.get('credential_type') as CredentialType`, not `as string` — TypeScript enforces the enum union.
