# Session 3 — Teacher Today + Me

**Read first:** `docs/DECISIONS.md` §5, §8. Spec: `docs/prototypes/kb-full.html` — Today and Me as Maria, Soo Kim, and Laura.
**Depends on:** Sessions 1–2.

---

## 1. Migrations

```sql
CREATE TABLE staff_tasks (                       -- admin-assigned priorities only
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id),
  assigned_to uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  title text NOT NULL, detail text, due_at timestamptz,
  source text NOT NULL DEFAULT 'assigned',       -- assigned | nudge | idea
  completed_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL, kind text NOT NULL DEFAULT 'announcement',   -- announcement | reminder
  created_at timestamptz DEFAULT now()
);
CREATE TABLE spotlights (
  center_id uuid NOT NULL REFERENCES centers(id),
  month date NOT NULL, category text NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (center_id, month, category)
);
```
Nudges from admins become `staff_tasks` rows with `source='nudge'` — they land in Priorities, not just a push.

## 2. Priorities — `packages/core/priorities.ts`

`getPriorities(user, activeRoom, clock)` merges **computed** items (never stored) with **assigned** rows, sorted by urgency (red = today/overdue, amber = this week):
- Children in the active room without an update today → inline faces, tap → log sheet. **Not for floats.**
- Lesson plan due / returned (only for the room's lead) → deep link to Classroom › Lesson plan.
- Own credential expiring within 30 days → deep link to Me › Credentials.
- Own pending requests (e.g. time correction) → deep link to Me.
- Assigned `staff_tasks` → checkbox to complete.
- Cap at 5 visible; "N more this week" row.
- For a lead teacher: if a scheduled break would be covered by someone who is an Aide for that room, run `evaluate` without the lead and show a red "Won't hold" pill on that shift row with the why sheet.

## 3. `/m/today`

Header: avatar, greeting by `clock.now()`, date.
- **Teachers:** From management (latest 2 announcements, tagged) → Priorities → My shift (clock-in time from kiosk punch, assignment rows with NOW highlight, break row) → This month (spotlights — one person per category, never ranked).
- **Floats:** "You're in now" hero (room, role, until, reason, Briefing / Open room) or **On call** → Your day (assignment timeline with role pills) → From management → Priorities (tasks only) → note that daily child updates stay with primary teachers → spotlights.
- No clock in/out on the phone.

## 4. `/m/me`

- Hero: banner, avatar, name, role, **rating pill** (stars, score, monthly trend) → growth sheet; room tags; "Since"; stats row (Attendance · Tenure · Expiring).
- **My growth** card: score, stars, signal bars, "Closest win" — the single action that moves the lowest signal fastest.
- **Growth sheet:** each signal with its weight and one-line definition; floats show *Posts / floor hour* and no Lesson plans, with renormalized weights; lifetime score.
- **Schedule:** week strip (today highlighted) + leave balances (Sick · Vacation · Personal). Action is **Request update**, never edit.
- **Employment** — in this order: Public profile · Credentials · Training hours (Maryland COK) · Time & hours · Requests.
- **Coaching:** focused observations and shared goals (PBC); empty state if none.

## 5. Teacher score changes — `packages/core/teacher-score.ts`

- Floats: posts per hour on the floor; lesson plans excluded; weights renormalized.
- `activity_posts.covering = true` never counts toward anyone.
- Observations signal counts completed coaching cycles only.

---

## Done when

- Maria, an assistant, and a float each see the prototype's Today and Me.
- Checking an assigned task completes it; computed items disappear when resolved.
- The break warning appears for a lead whose break is covered by an Aide.
- `BUILD.md` updated.
