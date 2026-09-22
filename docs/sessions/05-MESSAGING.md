# Session 5 — Messaging (replaces Google Chat)

**Read first:** `docs/DECISIONS.md` §7, §13. Spec: `docs/prototypes/kb-full.html` — Messages (as Maria, Laura) and Inbox › Messages (as You).
**Depends on:** Sessions 1–4. Uses Supabase Realtime.

---

## 1. Migrations

```sql
CREATE TYPE thread_kind AS ENUM ('announcement','room','idea','dm','family');
CREATE TABLE threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id),
  kind thread_kind NOT NULL,
  classroom_id uuid REFERENCES classrooms(id),     -- room + family threads
  student_id uuid REFERENCES students(id),         -- family threads: ONE per child (our table: children)
  title text, created_at timestamptz DEFAULT now(),
  UNIQUE (student_id)                              -- enforces per-child family threads
);
CREATE TABLE thread_members (
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL DEFAULT 'member',             -- member | guardian | observer
  last_read_at timestamptz,
  PRIMARY KEY (thread_id, user_id)
);
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL, lang text NOT NULL DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  deliver_at timestamptz NOT NULL DEFAULT now(),   -- quiet hours push this to 7:00 AM
  attachment_path text
);
CREATE TABLE message_translations (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lang text NOT NULL, body text NOT NULL, PRIMARY KEY (message_id, lang)
);
CREATE TABLE idea_votes (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id), PRIMARY KEY (message_id, user_id)
);
ALTER TABLE centers ADD COLUMN quiet_hours_start time NOT NULL DEFAULT '18:30',
                    ADD COLUMN quiet_hours_end time NOT NULL DEFAULT '07:00';
ALTER TABLE guardians ADD COLUMN preferred_lang text NOT NULL DEFAULT 'en';
```

**RLS — get this exactly right:**
- Family threads: the child's guardians, staff assigned to the child's classroom, floats currently assigned there (**read-only**), and directors/admins (read).
- Staff DMs: members only. **No admin override.** Never add an admin read policy on `dm` threads.
- Room threads: staff assigned to the room. Announcement: all center staff read; only admins post; replies are private to admins.
- Floats cannot insert into family threads — replies route to the room's lead.

## 2. Behavior

- **Two top-level tabs:** Team (announcement pinned, room channel for each of the user's rooms, Idea Garden, Direct) and Families (quiet-hours banner, grouped by room, "Message all" broadcast for leads).
- Every family thread shows a disclosure banner: "Center record — directors can view this thread." Floats see "You can read this thread. Replies route to Ms. X" and a disabled composer.
- **Quiet hours:** messages to families composed during quiet hours get `deliver_at` = next 7:00 AM; the composer hint says so.
- **Translation:** when a guardian's `preferred_lang` isn't English, translate both directions via `translate()`; show the original with the translation beneath and a "↻ translated" badge. Always store the original.
- **Aging:** a family thread whose last message is from a guardian and older than 24h shows a red "No reply 26h" tag — to the teacher **and** on the admin Home heads-up. Replying clears it.
- Unread dots, read receipts on outgoing ("Read"), unread badge on the Messages tab.
- Composer: photo attach, mic (`transcribe()`), send.
- Idea Garden: upvote; admins get **Make it a task** → `staff_tasks` with `source='idea'`.
- Realtime: new messages appear without refresh.

## 3. Admin Inbox › Messages

Staff (announcements with "Seen by n of m", Idea Garden with vote count, DMs addressed to the admin) and Families (all family threads, aging first).

---

## Done when

- Maria, Laura, and You see the prototype's Messages behavior against real data.
- A Spanish-speaking guardian's thread translates both ways and stores originals.
- A message sent at 8 PM to a family delivers at 7 AM.
- An admin cannot read a staff DM via any query.
- `BUILD.md` updated.
