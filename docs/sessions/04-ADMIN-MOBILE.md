# Session 4 — Admin mobile app + Preview / Cover

**Read first:** `docs/DECISIONS.md` §2 (Preview vs Cover), §3, §6. Spec: `docs/prototypes/kb-full.html` as **You**.
**Depends on:** Sessions 1–3.

---

## 1. Migrations

```sql
CREATE TABLE cover_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id),
  user_id uuid NOT NULL REFERENCES users(id),
  mode text NOT NULL CHECK (mode IN ('preview','cover')),
  started_at timestamptz NOT NULL, ended_at timestamptz
);
```
- Entering **Cover** also inserts a `staff_assignments` row with `source='cover'` for the admin, so the engine counts them. Ending Cover closes both.
- **Preview** never creates an assignment. Every write path (posts, breaks, nap state, lesson plans) checks for an open preview session and refuses with "Preview is read-only".
- Cover and preview start/end go to the audit log.

## 2. Approvals — unify existing requests into one queue

`getApprovals(center)` returns time adjustments, leave requests, schedule-change requests, and submitted lesson plans as one list, each with its own card:
- **Time correction:** before → after, the reason, and the payroll impact ("adds 44 min · 73.2 hrs this period").
- **Leave:** date(s), reason, and a coverage warning computed by the engine for that day ("Toddler B will need a lead-qualified cover").
- **Schedule change:** before → after.
- **Lesson plan:** Return (requires a comment) · Review (opens the full week grid) · Approve.
Approving/denying/returning animates the card out and notifies the requester.

## 3. `/m/admin` — Home

- Header: **center switcher** (sheet: each center + "All centers" rollup for owners only).
- **Compliance alert** from the engine for the worst room: composition, citation, required vs present, missing lead — with **Assign float**, **Cover it myself**, and **Age-mix fix** (when `suggestAgeMixFix` returns one). Green "All rooms in compliance" otherwise.
- Stats: Staff on floor · Children · Compliant (tappable).
- Needs your approval (top 3). Rooms right now (engine status per room).
- **Heads up:** teachers not posting (with **Nudge** → `staff_tasks`), upcoming age transitions from `nextAgeTransition` ("Ivy becomes a 2-year-old in 11 days — Toddler B will need 2 staff"), expiring credentials, students missing documents, family messages unanswered > 24h.
- Staff today: late (scheduled but no kiosk punch), subs on call, floats and their current room.

## 4. `/m/admin/rooms` and `/[id]`

- Filters: All · Needs attention · Plan not in.
- Room detail: compliance explanation inline (same `whyHTML` content as the teacher sheet, with the **Move them** action for age-mix fixes), actions (Assign float · Staffing pattern · Review plan · Step in), In the room (breaks for anyone, nap control), children present.
- **Admin view / Teacher view** toggle → sheet: **Preview** or **Cover this room** → opens `/m/classroom/[id]?mode=…` with a purple (preview) or orange (cover) bar and an Exit button. Exiting Cover confirms first.

## 5. Float assignment sheet

For each candidate (floats, subs on call, staff in other rooms), simulate with the engine and show one pill: **Fixes it** · **Still n short** · **Breaks <room>** (blocked) · role they'd join as (Lead-qualified / Aide). Assigning a float inserts a `source='float'` assignment starting now and sends them a push: "Reassigned to Toddler Room B" — opening the app shows the room briefing with the reassignment banner.

## 6. Age-mix fix

"Move them" moves the suggested children to the target room (writes to the students' classroom assignment with an effective time and the audit log) and re-evaluates both rooms.

## 7. `/m/admin/inbox` and `/m/admin/people`

- Inbox segments: **Approvals** · **Messages** (Messages list comes from Session 5; until then show announcements you've posted with "seen by n of m").
- People: **Staff** (stars + score, room, Lead-qualified/Aide, flag pills: no posts n days, credential expired/expiring, late) and **Students** (room, age, allergy/incident/missing-doc flags). Search + filters (All · Flagged · Aides).

## 8. Admin ＋ sheet

Announce · Assign task · Assign float · Add student · Observe · Incident.

---

## Done when

- Everything under **You** in the prototype works against real data.
- Cover counts the admin in ratio and every post shows "covering"; Preview can't write anything.
- Returning a lesson plan shows up in the lead's Priorities with the comment.
- Assigning a float updates the engine immediately and the float gets the briefing.
- `BUILD.md` updated.
