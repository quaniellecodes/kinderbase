# KinderBase — Claude Code Context

Living document. Update after every session.

---

## What this is

Childcare management platform for OCC-licensed centers in Maryland. Owner operates three Baltimore child care centers. Ships on web (Next.js 14 App Router) + iOS/Android (Capacitor 5 wrapping the same web app).

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

## Supabase project

- Project ref: `jqbvojjgkkhbndsgbsuo`
- MCP server: `https://mcp.supabase.com/mcp?project_ref=jqbvojjgkkhbndsgbsuo`
  Add with: `claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=jqbvojjgkkhbndsgbsuo"`

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
| `002b_rls_centers_memberships.sql` | RLS policies for centers + memberships |
| `003_credentials.sql` | credentials, credential_audit_logs |
| `003b_employment_history.sql` | employment_history table + RLS policy |
| `004_centers_state.sql` | adds `state char(2) DEFAULT 'MD'` to centers |
| `005_users_bio.sql` | adds `bio text` to users |
| `006_classrooms.sql` | classrooms + staffing_patterns tables + RLS |
| `007_time_entries.sql` | time_entries + push_tokens tables + RLS |
| `008_activity_log.sql` | activity_log table + RLS + center_created index |

Run all migrations in Supabase SQL editor in order. Always verify with `SELECT * FROM information_schema.tables WHERE table_schema = 'public'` after.

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
