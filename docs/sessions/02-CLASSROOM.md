# Session 2 — Active room + teacher Classroom

**Read first:** `docs/DECISIONS.md` §2, §5, §10, §12, §13. Spec: `docs/prototypes/kb-full.html` — open it as Maria, then Soo Kim, then Laura. Match what you see: layout, copy, states, and every interaction on the Classroom tab.
**Depends on:** Session 1 (engine, clock, `staff_assignments`, `loadRoomInput`, `activeClassroomFor`) and the shared components from the student profile (Card, Tab, Chip, Badge, Modal, Toast, PencilField).

---

## 1. Mobile shell — `app/(mobile)/m/layout.tsx`

- Phone-first layout: header area, scrollable body, fixed **bottom nav** with a raised center **＋** button.
- Teacher nav: Today · Classroom · ＋ · Messages · Me. Admin nav (Session 4): Home · Rooms · ＋ · Inbox · People. Choose by active role.
- Build a reusable `<BottomSheet>` (drag handle, backdrop tap to close, slides up) — every sheet in the next four sessions uses it.
- Safe-area insets for Capacitor.

## 2. Active classroom

`packages/core/active-room.ts`:
- `resolveActiveRoom(user, clock)` — assignment covering now → manual override (cookie, expires at the end of the current assignment block) → null.
- Multi-room teachers switch automatically at the assignment boundary; when that happens, open the **room briefing** on the next render.
- Picker options by role per DECISIONS §2. For floats, show each room's role (Lead-qualified / Aide) from `isLeadFor()`.

## 3. Migrations

```sql
CREATE TABLE lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  week_of date NOT NULL,                          -- Monday
  theme text, letter text, number text, shape text,
  status text NOT NULL DEFAULT 'draft',           -- draft | submitted | returned | approved
  submitted_by uuid REFERENCES users(id), submitted_at timestamptz,
  reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, review_comment text,
  UNIQUE (classroom_id, week_of)
);
CREATE TABLE lesson_plan_days (
  plan_id uuid NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  day text NOT NULL CHECK (day IN ('mon','tue','wed','thu','fri')),
  question text, circle_parts text[] NOT NULL DEFAULT '{}',   -- Greeting|Songs|Read Aloud|Music & Movement
  circle_notes text, outdoor text, stations text[4] NOT NULL DEFAULT '{"","","",""}',
  PRIMARY KEY (plan_id, day)
);
CREATE TABLE classroom_routines (                 -- the daily schedule blocks
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  starts_at time NOT NULL, title text NOT NULL, detail text, sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE activity_posts ADD COLUMN covering boolean NOT NULL DEFAULT false;   -- our table: child_updates
ALTER TABLE activity_posts ADD COLUMN goal_codes text[] NOT NULL DEFAULT '{}';
```
RLS: only the room's lead may write `lesson_plans`/`lesson_plan_days` while status is `draft` or `returned`. Routine changes are requests, not writes.

## 4. `/m/classroom/[id]` — header

Room name (tappable → picker sheet, chevron hidden when only one room) · staff on floor · "you: Aide" etc. when not primary · compliance pill (tap → **why sheet**: composition, governing rule + citation, the four checks, next age transition, age-mix fix). Tabs: Overview · Lesson plan · Schedule · Feed.

## 5. Overview tab

1. Numbers: Here now · Staff · Required · Need update — plus the compliance strip from the engine.
2. **Quick log**: Batch nap, Batch meal (enter select mode with that type preselected), Photo post, Observation.
3. **Voice card**: tap to record, waveform while listening, tap to stop → **voice review sheet**: editable transcript, child chips to tag, ELOF goal chips suggested from the tagged children's age band, "+ Find goal". Posting writes one `activity_post` per tagged child with `goal_codes`.
4. **In the room**: staff on the floor with Lead-qualified/Aide pill, Break/Back buttons (self only for teachers; anyone for admins), and the nap control (Settling · All resting quietly · Nap over) during the routine's nap block. Break runs `canStepOut`; if blocked, open the why sheet with the reasons and hint.
5. **Children grid**: avatar, update-count badge (green n / red 0), allergy "!" red, other flags amber, age + band. **Tap** = log sheet. **Select multiple** or **long-press** = select mode with an orange bar (All · Cancel · Log n).
- Log sheet: six types (Meal, Nap, Diaper, Mood, Photo, Milestone), note, "Say it instead" mic, attribution line ("Posts as …"; in Cover mode "Posts as Q. Turner-Moore · covering — not counted toward any teacher score").
- **Batch writes one row per child.** Always.

## 6. Lesson plan tab

Matches the OMH Creative Curriculum template (DECISIONS §5). Header card: week, status pill, theme, letter/number/shape, 20-block progress bar. Day chips M–F with `n/4`. Four section cards; the lead taps a section to edit it in a sheet (Circle Time has the four toggle chips). **Copy last week** fills incomplete days from the prior week's plan. **Submit** is disabled until 20/20, then sets `submitted` and creates an approval item (Session 4). If `returned`, show the reviewer's comment and a **Resubmit** button. Non-leads see a read-only banner.
Tablet width and print: render the full 5×4 week grid instead of day-at-a-time.

## 7. Schedule tab

Routine blocks from `classroom_routines` with detail line, past blocks dimmed, current block marked NOW, staff avatars on the current and next two blocks (from assignments). "Request change" creates a request.

## 8. Feed tab

Search + date chips (Today · Yesterday · This week · All time · Pick date), grouped by day, type tags, goal-code tags, and "covering · not counted toward teacher score" tags.

## 9. Room briefing sheet

Shown on active-room change when the user isn't the room's primary: room, count, who else is on the floor, the user's role pill, safety alerts (allergies, missing medication authorization, open incidents), now → next block, and the lead's handoff note (`classrooms.handoff_note`, editable by the lead). If the user is an Aide, add: "You count toward ratio, but a lead teacher must be in the room with you."

---

## Done when

- As a seeded lead, an assistant with two rooms, and a float, the Classroom tab matches the prototype.
- The assistant's room switches at the boundary and the briefing opens.
- Batch nap for 4 children produces 4 rows.
- A lesson plan can be filled, copied, submitted, and shows a returned comment.
- Blocked breaks show the engine's reasons.
- `BUILD.md` updated.
