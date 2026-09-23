# KinderBase — Decisions Addendum

> **Where this conflicts with `kinderbase-claude-code-brief.md`, this file wins.**
> Reference prototype (executable spec): `docs/prototypes/kb-full.html` — teacher, float, and director apps
> with the staffing engine, persona switcher, and clock. Plus the student profile mock.
>
> **Repo reconciliation (2026, KinderBase codebase):** these docs were written against a slightly
> different schema. Adopted mappings — the docs' names on the left, our tables on the right:
> `students → children`, `activity_posts → child_updates` (+ SAEO `observations` for goal-tagged
> notes), `child_attendance` already exists. Age bands adopted at **18/24/36/60 months** per §3
> (our legacy `COMAR_AGE_BANDS` used a 12-month cutoff — being corrected). Demo DB = the existing
> **sandbox** project (no separate demo project). Mobile lives in `app/(mobile)/m`; the `/demo`
> simulator runs with `DEMO_MODE=true` (e.g. a second dev instance on :3001).

---

## 1. Build order (current)

1. Student profile — Parts 0–4 first (shared components, schema, directory, Info/Family/Health/Documents). SAEO and the enrollment wizard follow later. **(Done in the KinderBase repo — full Students module A–G.)**
2. **Staffing engine + clock** (see `01-ENGINE.md`).
3. Teacher Classroom screen with the active-room model.
4. Teacher Today + admin Home.
5. Messaging.
6. Demo sandbox.
7. Credentials portfolio, public profile, kiosk, OCC exports, and the remaining tracker items.

---

## 2. Roles, rooms, and context

**The active classroom is context, not identity.** Never model `user → one classroom`. Model `user → active classroom`, resolved as:

1. The user's time-windowed staff assignment covering `clock.now()`, else
2. A manual override from the classroom picker, else
3. None (floats between assignments are "on call").

| Who | Picker shows | Default |
|---|---|---|
| Single-room teacher | Hidden | Their room |
| Multi-room teacher | Their assigned rooms | Room scheduled now — switches automatically at the boundary |
| Float | All rooms | Current float assignment, or on call |
| Admin (teacher view) | Every room | Last room viewed |

When the active room changes to one the user isn't primary in, show a **room briefing** first: head count, who else is on the floor, the user's role in that room, safety alerts (allergies, missing medication authorization, open incidents), what's happening now/next, and a handoff note from the room's lead.

**Job title and qualification are separate.** Job title (Lead Teacher, Assistant Teacher, Float, Aide) is display. For compliance the engine only asks: is this person **lead-qualified for this group?**
- Lead-qualified requires the teacher qualification, and for any group containing children under 2, also the 9-hour infant/toddler course.
- A float without the infant/toddler course **can still work an infant or toddler room — as an Aide.** Never block the assignment; show the role.
- *Assumption to confirm:* Assistant Teachers are lead-qualified.

**Admin "Teacher view" is two modes, never one:**
- **Preview** — see the room exactly as a teacher does. Read-only. Not counted in ratio. Every write is refused.
- **Cover** — the admin is on the floor. Counts toward ratio, time in room is recorded, every post is attributed to the admin and tagged `covering`. Covering posts never count toward any teacher's score.
- The flip is **room-level only**. No "view as <person>" — that would expose staff DMs.

---

## 3. Staffing rules (Maryland child care centers)

Implemented in `packages/core/staffing-engine.ts`. Version with `COMAR_VERSION`.

**Age bands** — COMAR 13A.16.01.02. Age is from date of birth to the evaluation date.

| Band | Definition |
|---|---|
| Infant | 6 weeks to under **18 months** |
| Toddler | 18 months to under 2 years |
| Two | 2 years to under 3 |
| Preschool | 3 years to under 5 |
| School-age | 5 and older |

> The 12-month cutoff used in family child care does **not** apply to centers.
> **⚠ CONFIRM with your Maryland OCC licensing specialist before demoing to partners** — this and the §D(1) reading below drive an engine that tells staff whether a break is legal.

**Four checks, every room, continuously:**
1. **Group size** within the maximum for the actual age mix.
2. **Staff count** — aides count toward ratio.
3. **At least one lead-qualified staff member present.** Any number of aides, never zero leads. (Aides work under the direct supervision of the person in charge of the group — COMAR 13A.16.06.12.)
4. **Nap rule** (COMAR 13A.16.08.08).

**Same-age groups** (13A.16.08.03 §C): infants 1:3 max 6 · toddlers 1:3 max 9 · infants+toddlers 1:3, max 9 with 1–2 infants, max 6 with 3+ · twos 1:6 max 12 · 3–4 yr 1:10 max 20 · 5+ 1:15 max 30.

**Mixed groups containing infants or toddlers** (§D(1)) use the minimum-staff table, not a ratio. Apply the strictest row that matches:

| Row | Max group | Min staff |
|---|---|---|
| 1–2 infants | 9 | 2 |
| 3+ infants | 6 | 2 |
| 1–2 toddlers | 12 | 2 |
| 3 toddlers | 9 | 2 |
| 4+ toddlers | 9 | **3** |
| No infants, 1–2 toddlers, 6+ twos | 12 | 3 |

> Consequence: 4 toddlers + 2 two-year-olds needs **3** staff, not 2. The engine must surface this and suggest the fix (move the 2-year-olds to a room where they fit).

**Mixed with preschoolers, no under-2s** (§D(2)): 1:10, max 20, and a group of 13–20 may include no more than six 2-year-olds.

**Nap:**
- Any group with a child under 2 holds **full ratio at all times, including nap.** No reduction. *(Assumption: the youngest child governs a mixed group.)*
- Groups where every child is 2+: full ratio **until every child is resting quietly** (an explicit room state set by staff). Then one staff member — teacher **or** aide — may hold the room. Others may step out but must remain on premises within hearing range.

**Breaks** are evaluated by removing that person and re-running all four checks. Blocked breaks must explain why in plain language.

---

## 4. Time

**All "what time is it" reads go through `packages/core/clock.ts`.** Never call `new Date()` / `Date.now()` for business logic. In production `clock.now()` returns real time; in demo mode it reads an override. This is what makes the engine testable and the demo sandbox possible.

---

## 5. Teacher app

**Nav:** Today · Classroom · **＋** · Messages · Me

- **Today:** From management → Priorities → My shift → Spotlights. Floats instead lead with "where you are now" and their day timeline.
- **Priorities** merge *computed* items (children without an update today, lesson plan due, credential expiring — derived at query time, never stored) with *assigned* tasks from admins (stored rows). Sorted by urgency. Capped, with "N more this week". Floats do not get the children-need-updates item.
- **Classroom:** header shows active room + picker + compliance pill. Tabs: Overview · Lesson plan · Schedule · Feed.
  - Overview: numbers (here / staff / required / need update), compliance strip, Quick log (batch nap, batch meal, photo, observation), voice observation, "In the room" (staff with qualification + break controls + nap state), roster.
  - Selection is an **explicit mode** ("Select multiple" or long-press). A single tap always opens that child's log sheet.
  - Lesson plan: OMH Creative Curriculum template (Theme, Letter, Number, Shape; Question of the Day, Circle Time with Greeting/Songs/Read Aloud/Music & Movement, Outdoor, Small Group Stations 1–4). Day-at-a-time on phone, full grid on tablet/print. Editable only by the room's lead; read-only for everyone else. Due Monday 8:00 AM. "Copy last week."
  - Schedule: the room's daily routine with the current block marked. Changes are requested, not edited.
  - Feed: searchable, filterable by date.
- **＋ (quick add):** Photo · Voice note · Log update · Milestone · Time off · Incident.
- **Me:** hero with star rating, Growth (signal breakdown + "closest win"), Schedule (week strip + leave balances, "Request update"), Employment (Public profile first, then Credentials, Training hours by Maryland COK domain, Time & hours, Requests), Coaching.
- **No clock in/out on the phone.** Punching happens at the kiosk only.

**Activity posts:** a batch entry writes **one row per child**. Batching is UI only.

---

## 6. Admin app

**Nav:** Home · Rooms · **＋** · Inbox · People

- Home: compliance alert (with Assign float / Cover it myself / See age-mix fix), stats, rooms right now, heads-up items, staff today.
- Rooms: every room with live compliance; room detail shows the engine's full explanation, actions, staff on floor, and the **Admin view / Teacher view** toggle.
- Inbox: Approvals (time corrections with before/after, leave with coverage warning, schedule changes, lesson plan Return/Review/Approve) and Messages.
- People: staff (rating, qualification, flags) and students.
- Center switcher; "All centers" is an owner-only rollup.

---

## 7. Messaging (replaces Google Chat)

- **Team** and **Families** are separate at the top level.
- Team: Management (announcements, pinned), per-room staff channel, **Idea Garden** (staff suggestions; upvote → convert to task), DMs.
- Families: threads are **per child**, not per parent — every guardian of a child sees one thread.
- **Quiet hours** enforced (default 6:30 PM–7:00 AM): compose anytime, deliver at 7:00 AM.
- Directors can read family threads, and teachers are told so **in the thread**. Staff DMs are never admin-readable.
- Auto-translation both directions, original text preserved.
- Unanswered family messages age visibly for both teacher and admin.
- Floats can read the family threads of the room they're covering; replies route to the primary teacher.

---

## 8. Teacher score

- Five signals: attendance 30%, posts 25%, lesson plans 20%, schedule 15%, observations 10%.
- **Observations score completed coaching cycles, never what was observed** (Practice-Based Coaching must stay non-evaluative).
- **Floats:** posts are measured per hour on the floor; lesson plans are excluded and weights renormalized.
- Admin-covering posts never count toward any teacher.
- Teacher-visible score is 30 days delayed; admin score is live.
- Recognition is **category spotlights**, never a ranked leaderboard. Attendance is never peer-visible.

---

## 9. Assessment

- **Head Start ELOF only** for now, full text (federal, public domain). Seed from headstart.gov — do not invent wording. **(Done: Infant/Toddler + Preschool views seeded verbatim.)**
- View is derived from age: Infant/Toddler (birth–36 months) or Preschool (36–60 months). Checkpoints snapshot the view they were rated in.
- Schema stays framework-agnostic; licensed frameworks store codes only.
- Screening is read-only and append-only. Evaluation is a referral tracker (MITP under 3, Part B after), never a result staff record themselves.

---

## 10. Engineering conventions

- Tailwind utilities or BEM modifiers. **Never** name a modifier the same as a layout class (`.badge.app` inherited `min-height:100vh`).
- Two-column layouts: the columns must be the only direct children of the grid container.
- Every write to guardians, pickups, health, referrals, checkpoint reopens, staff breaks, and cover sessions goes to the audit log.
- Children's data never appears in the demo environment. Demo uses its own seeded Supabase project (here: the sandbox).

---

## 12. Routes & shells

- The phone UI lives in a **mobile route group**: `app/(mobile)/m/...`. Capacitor loads `/m`. The existing desktop dashboard (`/dashboard/...`, `(dashboard)` group) is unchanged.
- Teacher: `/m/today` · `/m/classroom/[classroomId]` (tabs via `?tab=overview|plan|schedule|feed`) · `/m/messages` · `/m/messages/[threadId]` · `/m/me`
- Admin: `/m/admin` · `/m/admin/rooms` · `/m/admin/rooms/[classroomId]` · `/m/admin/inbox` · `/m/admin/people`
- Admin teacher view: `/m/classroom/[classroomId]?mode=preview|cover` — mode is carried in a server-side session record, not trusted from the URL alone.
- Which nav a user sees comes from their active role (existing RoleSwitcher context), not the URL.
- Bottom sheets, not pages, for: log, batch log, voice review, lesson-plan section edit, room briefing, compliance "why", classroom picker, float assignment, Preview/Cover choice, quick add, growth breakdown, center switcher.

## 13. External services (interfaces now, providers later)

- `packages/core/speech.ts` — `transcribe(audio): Promise<string>`. Capacitor: `@capacitor-community/speech-recognition`; web: Web Speech API; demo: returns a canned transcript.
- `packages/core/translate.ts` — `translate(text, to): Promise<string>`. Provider TBD; demo returns a canned translation. Always store the original.
- Never block a post on either service — if transcription or translation fails, the user can type / the original is shown.

---

## 14. Open questions (confirm before partner demos)

1. Are Assistant Teachers lead-qualified? (Engine currently assumes yes.)
2. In a mixed group at nap, does one child under 2 keep the whole group at full ratio? (Engine assumes yes.)
3. Confirm the §D(1) reading — that 4+ toddlers in a mixed group requires 3 staff — with the licensing specialist.
4. Confirm the 18-month infant→toddler center band (vs the 12-month family-childcare cutoff).
