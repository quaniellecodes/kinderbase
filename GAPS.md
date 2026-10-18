# KinderBase — Gap register

> Forward-looking gap list. `BUILD.md` stays the narrative build log; `docs/DECISIONS.md` is the source of truth for rules.
> **Status:** `[x]` built · `[~]` partial / stubbed · `[ ]` not started.
> **Priority:** `P0` blocks the core daily workflow · `P1` before another operator uses it · `P2` deferrable.
> **Spec:** `S1`–`S10` = a session prompt in `docs/sessions/`. `SP` = the student-profile prompt. No tag = needs a prompt written.
> `⚠️ LEGAL` carries real liability.
>
> **Verified against `feat/timelog-demo-polish` @ `d5cfaab` (main @ `b394ec3`), 2026-10-05.**
> Items tagged **(branch)** are built on `feat/timelog-demo-polish` and not yet merged to `main`; everything else marked `[x]` is on `main`.
>
> **Tally: 101 items — 45 built `[x]` · 6 partial `[~]` · 49 not started `[ ]` · 1 owner-declined · 12 P0 remaining · 8 legal-risk remaining.**
> (Section counts — built/partial/not-started: Platform 3/4/10 · Mobile 12/1/3 · Desktop 5/0/5 · Calendar 7/0/3 · Student 7/0/4 · Compliance 4/0/10 (+1 declined) · Legal 1/0/6 · Foundations 6/1/8.)

## Corrections applied vs the imported web draft

The imported draft was reconciled against an older `main` and understated progress. Flips made here:

- **Desktop → built:** Director dashboard, dashboard widget model, custom widget layout UI (S7 §2, migration 030); classrooms + room detail; Staff/Students/Reports pages.
- **Calendar → built:** schema (031), month/agenda/day views, visibility matrix, custom types, time-off on calendar, engine-generated events, per-child birthday consent. Only recurring events, reminders, and ICS remain.
- **Compliance → built:** staffing pattern builder (`StaffingPatternGrid`, migration 015 — OCC **1206**, not 1203); credential portfolio + public profile (S2/S3); Time log (S9, branch); empty-room/empty-center states (S10, branch).
- **Reclassified:** "Unused-kiosk signal" was built then **removed at the owner's request** — it is a declined item, not a pending gap.
- **New since the draft:** Heads-up drill-downs + swipe-to-dismiss (migration 032, branch).
- **Still true:** kiosk + kiosk punches, ratio compliance logging, generic audit trail, PDF, email, background-job scheduling, and most legal items remain open.

---

## 🏗️ Platform infrastructure

- [x] **Clock abstraction** `P0` `S1` — single `clock.now()` for all business logic; demo override (`kb_demo_now`).
- [x] **Staffing engine package** `P0` `S1` — COMAR checks, tables, breaks, projections, age-mix fix. 29 engine tests (92 core total).
- [x] **File upload pipeline** `P0` `SP` — private buckets, 15-min signed URLs, MIME/size validation.
- [ ] **Image handling for avatars** `P1` — client crop/resize/WebP. Initials avatars only today.
- [ ] **PDF generation** `P0` — credential bundles, OCC personnel list, staffing patterns, payroll. (react-pdf deferred since S8.)
- [ ] **Transactional email** `P0` — Resend templates: invites, expiry alerts, decisions, nudges, reset.
- [~] **Push notifications** `P1` — `/api/push/register` + `push_tokens` exist; FCM/APNs delivery + deep links not wired.
- [~] **Background jobs** `P0` — `credential-expiry-alerts` + `shift-reminder` edge functions exist but are **unscheduled**; `demo-nightly-reset.yml` runs the reseed. Ratio logging / nightly scores / birthday reclassification not built.
- [ ] **Generic audit log** `P0` `⚠️ LEGAL` — `activity_log` exists for display events, but not the append-only sensitive-write audit trigger referenced across sessions.
- [~] **Speech-to-text provider** `P1` `S2` — `transcribe()` demo stub; real capture undecided.
- [~] **Translation provider** `P1` `S5` — `translate()` stub powers the two-way messaging demo; provider undecided. Original always stored.
- [ ] **Offline queue** `P1` — IndexedDB + replay for clock-in / in-room logging.
- [ ] **Global search** `P1` — Command-K across students, staff, rooms, calendar.
- [~] **Error, empty, and loading states** `P1` — `EmptyState` primitive in use; skeletons / permission-denied / offline banner not systematic.
- [ ] **Teacher score nightly recompute** `P1` — scores are display-only; no job writes `teacher_scores`.
- [ ] **Sweep remaining new Date() calls** `P2` — engine path clean; display + seed still call it directly.
- [ ] **Single source for COMAR constants** `P1` — bands/tables live in `comar-engine.ts`; no formal `COMAR_VERSION` module. The 12-vs-18-month slip came from a duplicated copy.

## 📱 Mobile app

- [x] **Mobile shell + bottom nav** `P0` `S2`
- [x] **Active-room model** `P0` `S2` — schedule resolves the room; picker overrides; roster home-room fallback off-shift.
- [x] **Room briefing** `P0` `S2`
- [x] **Classroom — Overview / Lesson plan / Schedule & Feed** `P0/P1` `S2`
- [x] **Priorities engine · Today · Me** `P0/P1` `S3`
- [x] **Teacher score changes** `P1` `S3` (compute display-only; see nightly-recompute gap)
- [x] **Admin mobile app (Home, Rooms, Inbox, People)** `P0` `S4`
- [x] **Preview vs Cover** `P0` `S4`
- [x] **Float assignment** `P0` `S4`
- [x] **Unified approvals** `P0` `S4`
- [x] **Messaging** `P1` `S5` — team + family threads, quiet hours, translation, aging, Idea Garden, realtime.
- [x] **Heads-up drill-downs + swipe-to-dismiss** `P2` **(branch)** — credentials/documents list screens; swipe-right dismisses, persisted per admin (`dismissed_alerts`, migration 032, content-aware keys + 7-day snooze).
- [ ] **Widen child_updates log types** `P1` — diaper/mood/photo need the CHECK constraint widened.
- [~] **Real audio capture** `P1` — voice observations use a canned transcript.
- [ ] **Time-correction payroll math** `P1` — approving a correction doesn't compute the hours impact.
- [ ] **Coverage simulation for future days** `P1` — leave approval warns from today's roster, not the requested day's.

## 🖥️ Desktop

- [x] **Director dashboard** `P0` `S7` — compliance banner (locked), room board, accountability, approvals, heads-up, staff today.
- [x] **Dashboard widget model** `P1` `S7` — `dashboard_widgets` (sort_order, span, visible; migration 030).
- [x] **Custom widget layout UI** `P2` `S7` — drag reorder, 1/2/3 span, hide/show tray, reset.
- [x] **Classrooms + room detail** `P0` — card grid + Overview/Activity/Staffing/Children tabs, real-time ratios.
- [x] **Staff, Students, Reports pages** `P1` — `/students` (full module), `/staff` directory + profile, `/reports` (basic).
- [ ] **Inbox split view (desktop)** `P0` `S7` — list + detail; lesson plans as the week grid; Return requires a comment. (Mobile inbox exists; desktop split not built.)
- [ ] **Settings — qualifications** `P0` `S7` — **confirmed not built.** `/settings` covers icon, brand color, hours, kiosk mode, and staff PINs only. `lead_qualified` / `infant_toddler_trained` are read live by the engine but are **seed-only** — no UI writes them (the only `center_memberships` updates anywhere are `role` and `left_at`).
- [ ] **Teacher desktop** `P1` `S7` — Today/Classroom/Messages/Me on a big screen (teachers use `/m` today).
- [ ] **Lesson plan week grid + print** `P1` `S7` — desktop 5×4 grid + print stylesheet (mobile day-at-a-time built).
- [ ] **Responsive redirects** `P2` `S7` — below 768px, desktop teacher routes → `/m`.

## 🗓️ Calendar

- [x] **Calendar schema** `P1` `S8` — `calendar_event_types` + `calendar_events` (migration 031).
- [x] **Month, agenda, and day views** `P1` `S8` — desktop month + day panel; mobile month + agenda.
- [x] **Visibility matrix** `P1` `S8` `⚠️ LEGAL` — audience per type, server-enforced via `canSee`; own time-off always visible to the requester. (Lives in the Types sheet, not a Settings page.)
- [x] **Custom event types** `P2` `S8` — center-scoped (built-ins `center_id NULL`).
- [x] **Time off on the calendar** `P1` `S8` — pending requests with engine coverage note; approve / deny / find cover in place.
- [x] **Engine-generated events** `P1` `S8` — age transitions + credential expiries computed, never stored.
- [x] **Per-child birthday consent** `P1` `S8` `⚠️ LEGAL` — `children.birthday_visible` (default on).
- [ ] **Recurring events** `P1` — conference weeks, holidays, monthly drills. Columns reserved; not modelled.
- [ ] **Calendar reminders** `P2` — push/email ahead of trips, closures, expiries.
- [ ] **Subscribe feed (ICS)** `P2` — staff subscribing in their own calendar app.

## 🧒 Student module

- [x] **Shared component library** `P0` `SP`
- [x] **Student schema + RLS** `P0` `SP`
- [x] **Student directory + profile** `P0` `SP`
- [x] **Document upload** `P0` `SP`
- [x] **Enrollment wizard** `P1` `SP`
- [x] **SAEO — ELOF** `P1` `SP` — seeded Infant/Toddler + Preschool; checkpoints, observations, screening, referral.
- [x] **Sibling linking** `P2`
- [ ] **Custody restriction enforcement** `P0` `⚠️ LEGAL` — `is_pickup_restricted` is captured/edited but **not enforced**; the kiosk must refuse sign-out and alert. Cosmetic today.
- [ ] **Guardian invite flow** `P1` — invite email, account creation, link to child.
- [ ] **Immunization tracking** `P1` — dose-level records with due dates, not just a stored document.
- [ ] **Age-based room moves** `P1` — birthday triggers a proposal; needs effective-dated room assignment (age-mix fix exists but is immediate).

## ⚖️ Compliance & operations

- [x] **Staffing pattern builder** `P0` — `StaffingPatternGrid` + migration 015 (OCC **1206** 30-min slots, Save/Reset, Auto/Manual ratio).
- [x] **Credential portfolio + public profile** `P1` `S2/S3` — upload, expiry status, My Credentials, `/t/[handle]` public profile. (PDF bundle still deferred.)
- [x] **Time log** `P1` `S9` **(branch)** — read-only today's punches for staff + children; roster-vs-punch mismatch surfaced; teacher's own timesheet. Reads existing `time_entries`/`staff_breaks` (no new migration).
- [x] **Empty-room and empty-center states** `P1` `S10` **(branch)** — grey "nothing to evaluate", occupied-only counter, unseeded-center message. *Caveat:* "no children present" is surfaced in the UI only — there is no persistent compliance log yet (see below).
- [ ] **Ratio compliance logging** `P0` `⚠️ LEGAL` — append-only log of every evaluation, 3-year retention, exportable. Not built; blocks the "no children present in the log" half of S10.
- [ ] **Kiosk — break & clock-out punches** `P0` — "Go on break / End break / Clock out" at the kiosk. The Time log and timesheets depend on these punches; today they come from the classroom break control + seed.
- [ ] **Kiosk** `P0` `⚠️ LEGAL` — sign in/out, PIN lifecycle, branding, pickup photo verification, custody blocks.
- [ ] **Director-in-ratio rule** `P1` — conditionally countable; needs an explicit toggle + warning.
- [ ] **Incident reports** `P1` `⚠️ LEGAL`
- [ ] **Time, payroll, and ADP export** `P1` — biweekly periods, corrections as new rows, exceptions sheet (CSV only; no period math).
- [ ] **OCC personnel list** `P1` — Form 1203 from real qualification data.
- [ ] **CACFP meal counts** `P2`
- [ ] **Substitute pool** `P2` — availability, on-call status, assignment history (subs exist in seed only).
- [ ] **Unended break policy** `P1` — auto-close at clock-out, kiosk prompt, or director flag.
- [~] **Unused-kiosk signal** `S10` — **built then removed at the owner's request** (the "N enrolled, none signed in" heads-up). Declined, not pending. Revisit only if asked.

## 👪 Parent app (Session 11 — `feat/parent-foundation`)

Foundation only; parent *features* (feed/digest, messaging, two-step sign-in, progress, billing) are Session 12+.

- [x] **Child identity & enrollment model** `P0` `S11` `⚠️ LEGAL` — `families`/`enrollments`/`children.family_id` (migration 033, additive; `center_id` kept as mirror). Full backfill; a child is a person in a family, enrollment a dated center relationship.
- [x] **Parent principal + RLS** `P0` `S11` `⚠️ LEGAL` — `parentContext()` deny-by-default; guardian read policies (034) via SECURITY DEFINER helpers; name-scrub (`redactNames`); checkpoint release gate (`released_at`). **9 adversarial DB tests** prove cross-family denial.
- [x] **Identity, memberships & context switcher** `P1` `S11` — audited staff↔family switch; reuses `guardians` + `center_memberships` (no generic memberships table).
- [x] **Parent app shell & branding** `P1` `S11` — `/p` route group, guardian-gated, center branding, 4-tab nav (stubs).
- [x] **Sample family per center** `P1` `S11` — seeded, admin-only, excluded from every operational count.
- [x] **Parent view emulation** `P1` `S11` `⚠️ LEGAL` — `emulation_sessions` (035), read-only, director-only, audited; persistent bar + exit; Settings entry.
- [x] **Staff-parent assessment guard** `P0` `S11` `⚠️ LEGAL` — a guardian-staff is never the assessor of record for their own child; observations/ratings/referrals refused from staff; own-child access logged.
- [ ] **Remaining emulation entry points** `P2` `S11` — student-profile "View as parent" + mobile People→Students (the engine works for any child; two buttons unwired).
- [ ] **Parent prototype in repo + DECISIONS reconcile** `P2` `S11` — add `docs/prototypes/kb-parent.html`; fold §11b/§12/§13 into the repo `DECISIONS.md`.

## 🔒 Legal & data protection

- [x] **Photo consent per child** `P0` `⚠️ LEGAL` — consent captured on the child record. *Enforcement at photo-post time is unverified.*
- [ ] **Student record access policy** `P0` `⚠️ LEGAL` — a float should not see every health record center-wide; tighten RLS.
- [ ] **Audit trail on sensitive writes** `P0` `⚠️ LEGAL` — guardians, pickups, health, referrals, breaks, cover sessions, approvals.
- [ ] **Data retention + purge** `P1` — 3-year retention specced everywhere; nothing enforces it.
- [ ] **Assessment licensing review** `P1` `⚠️ LEGAL` — ELOF is public-domain Head Start, but confirm code-only referencing before any commercial framework.
- [ ] **Terms, privacy policy, DPA** `P1` — required before any other center uses this.
- [ ] **Backup + restore runbook** `P1` — custody records and ratio logs are unrecoverable if lost.

## 🧱 Foundations & delivery

- [x] **Auth screens** `P0` — login, signup, forgot password, invite, first-run setup.
- [x] **Design tokens** `P0` `SP`
- [x] **CSS naming convention** `P0` `SP`
- [x] **Seed data** `P0` `S6` — realistic single-center dataset shared by dev + demo.
- [x] **Demo sandbox** `P1` `S6` — `/demo` phone frame, persona login, clock, scenarios, reset, access gate.
- [x] **Demo phone frame + content polish** `P1` `S10` **(branch)** — 390×830 no-notch frame, honest empty states, deduped approvals, formatted dates.
- [ ] **Optimistic updates + conflicts** `P1` — last-write-wins loses data silently when two admins edit one record.
- [~] **Testing strategy** `P1` `S1` — Vitest covers the engine/core (92 tests); no Playwright for kiosk/clock-in.
- [ ] **Type generation in CI** `P1` — `database.ts` is hand-written; run `supabase gen types` on every migration.
- [ ] **Demo deploy target** `P1` `S6` — separate Vercel project on `demo.kinderbase.com` with its own env.
- [ ] **Deterministic demo personas** `P2` — switcher shows representative seeded users, not Maria / Soo / Laura.
- [ ] **Scenario state, not just clock+persona** `P2`
- [ ] **Multi-center rollup** `P2` — owner view across centers.
- [ ] **Roles & permissions editor** `P1` — who can approve / see what, per center.
- [ ] **Gap register sync workflow** `P2` — PR-body "Gaps:" line ticks items on merge and regenerates this file. Not installed.

---

## Open decisions

- **Are Assistant Teachers lead-qualified?** — changes the lead check in several rooms. Settings makes it a per-person flag; confirm the default.
- **Does one child under 2 keep a mixed group at full ratio at nap?** — the engine assumes yes (youngest governs).
- **Confirm the COMAR §D(1) reading** `⚠️ LEGAL` — 4+ toddlers in a mixed group needs 3 staff. Must be confirmed with an OCC licensing specialist before any partner demo (the engine tells staff whether a break is *legal*).
- **Speech-to-text and translation providers** — interfaces exist; providers undecided.
- **Who punches breaks?** — kiosk buttons are planned; until then breaks come from the classroom control + seed. Decide whether the kiosk is the only valid source.
- **Should an empty room ever render as compliant?** — *Settled: no.* Implemented: grey "nothing to evaluate", counter counts occupied rooms only. The matching **compliance-log** record ("no children present" instead of "compliant") still depends on building Ratio compliance logging.
- **Custom calendar type scope** — *Settled: center-scoped.* Implemented that way.
