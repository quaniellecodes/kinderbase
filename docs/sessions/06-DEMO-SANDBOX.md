# Session 6 — Demo sandbox (phone simulator + role switcher)

**Goal:** a `/demo` page that looks and works like the prototype's outer frame — the **real app** running inside a phone on the left, a control panel on the right — for showing KinderBase to partners.
**Read first:** `docs/DECISIONS.md` §4 (clock), §10 (demo data rule), §12. Spec: the right-hand panel of `docs/prototypes/kb-full.html`.
**Depends on:** Sessions 1–5. The demo Supabase project (here: the existing **sandbox**) already has fake data — use it; don't create another.

---

## 1. Hard safety rules

- Everything in this session is gated on `DEMO_MODE === 'true'`. In any other environment, every `/demo` and `/api/demo/*` route returns **404** — not 401, not a redirect.
- The demo environment points only at the demo Supabase project (sandbox). Add a startup assertion: if `DEMO_MODE` is true and the Supabase URL matches the production project, crash.
- No real child, family, or staff data — ever. All demo people are invented.
- Demo credentials live in server env only. Nothing sensitive reaches the browser.

## 2. Demo personas (seed)

Seed users that match the prototype exactly:

| Key | Name | Role | Setup |
|---|---|---|---|
| `lead` | Maria Torres | Lead Teacher | Infant Room A 6:30–3:30; lead-qualified + infant/toddler trained |
| `multi` | Soo Kim | Assistant Teacher | Infant A 6:30–12:00, Toddler B 12:00–4:30 |
| `float` | Laura Rivera | Float | on call until 12:00, then Infant A (as Aide), then Preschool C; lead-qualified, **not** infant/toddler trained |
| `director` | Q. Turner-Moore | Director | all rooms, all centers |

Plus the rooms, children (with DOBs producing the prototype's ages relative to the demo clock), routines, lesson plans (Infant A draft, E empty, others submitted), approvals, threads (including the Spanish thread and the 26-hour unanswered one), announcements, spotlights, and staff flags from the prototype. **Seed DOBs relative to the demo date**, so ages stay correct whenever the demo is reset.

## 3. One-tap login — `POST /api/demo/login`

```ts
// body: { persona: 'lead' | 'multi' | 'float' | 'director' }
// 1. 404 unless DEMO_MODE
// 2. require a valid demo-gate cookie (see §6)
// 3. sign in server-side as that seeded user (password from DEMO_USER_PASSWORD env)
// 4. set the Supabase session cookies on the response
// 5. return { ok: true }
```
The panel calls this, then reloads the phone iframe. Switching personas must not require the viewer to type anything.

## 4. `/demo` page

**Desktop layout:**
- Left: a phone frame (390 × 844, rounded, notch, subtle shadow) containing an `<iframe src="/m">`, same-origin.
- Right: control panel, same visual language as the prototype's side panel:
  - **Who's holding the phone** — four persona cards (avatar, name, role). The active one is highlighted.
  - **Time of day** — presets (9:12 AM, 12:05 PM nap, 3:10 PM) plus a custom time input. Sets the `kb_demo_now` cookie that `getClock()` already honors, then reloads the iframe.
  - **Scenarios** — one-tap presets (§5).
  - **Stories to walk through** — the five numbered stories from the prototype, as static copy.
  - **Reset demo** — confirms, reseeds, returns to the lead persona at 9:12.
- A thin "Sample data — no real children" banner inside the phone frame, above the app.

**On a phone** (viewport < 768px): skip the frame; render the app full-screen with a small floating pill in the corner that opens the same controls as a bottom sheet.

## 5. Scenarios — `supabase/seed/demo/scenarios/*.ts`

Each is: reset to baseline → apply changes → set clock → log in as a persona.

| Scenario | Clock | Persona | State |
|---|---|---|---|
| Toddler room out of compliance | 9:12 | director | baseline (4 toddlers + 2 twos, 1 staff) |
| Float reassignment | 9:12 | float | Laura already assigned to Toddler B — briefing shows on load |
| Nap-time breaks | 12:05 | director | all nap rooms `settling` |
| Break that won't hold | 12:05 | lead | Laura covering Infant A |
| Lesson plan review loop | 9:12 | director | Infant A plan submitted, waiting in Inbox |
| Families & translation | 9:12 | lead | unanswered + Spanish threads fresh |

## 6. Access gate

- `/demo` requires a passcode (`DEMO_PASSCODE` env) or a signed invite link (`/demo?invite=<token>`, HMAC with `DEMO_INVITE_SECRET`, expiry embedded). Success sets an httpOnly gate cookie for 7 days.
- Rate-limit `/api/demo/login` and the passcode form.

## 7. Resets

- **Manual:** the Reset button (above).
- **Nightly:** a scheduled Edge Function reseeds the demo project at 3:00 AM ET.
- Reset must be idempotent and finish in under 10 seconds.

## 8. Deploy

- A separate Vercel project (or environment) for the demo — e.g. `demo.kinderbase.com` — with `DEMO_MODE=true` and the demo Supabase keys. (Locally: a second dev instance on :3001 with `DEMO_MODE=true`.)
- Production never has `DEMO_MODE`, `DEMO_USER_PASSWORD`, `DEMO_PASSCODE`, or `DEMO_INVITE_SECRET` set.

---

## Done when

- `/demo` shows the real app in a phone frame; tapping each persona switches users in under two seconds with no typing.
- Changing the clock changes greetings, schedules, nap controls, and engine results.
- Every scenario lands in the state described.
- Reset restores the baseline.
- In a non-demo build, `/demo` and `/api/demo/login` return 404.
- `BUILD.md` updated.
