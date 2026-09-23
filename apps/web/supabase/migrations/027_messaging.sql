-- Messaging (docs/sessions/05-MESSAGING.md). Team channels + per-child family
-- threads, quiet-hours delivery, two-way translation. `student_id` maps to our
-- `children` table. RLS is the DB backstop; the app (service client) enforces
-- the finer rules (float read-only in family, quiet-hours delivery). The one
-- rule RLS MUST hold: an admin can never read a staff DM.

CREATE TYPE thread_kind AS ENUM ('announcement', 'room', 'idea', 'dm', 'family');

CREATE TABLE threads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id    uuid NOT NULL REFERENCES centers(id),
  kind         thread_kind NOT NULL,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id   uuid REFERENCES children(id) ON DELETE CASCADE,   -- family: one per child
  title        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (student_id)
);
CREATE INDEX threads_center_idx ON threads (center_id, kind);

CREATE TABLE thread_members (
  thread_id    uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  role         text NOT NULL DEFAULT 'member',   -- member | guardian | observer
  last_read_at timestamptz,
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES users(id),
  body            text NOT NULL,
  lang            text NOT NULL DEFAULT 'en',
  created_at      timestamptz DEFAULT now(),
  deliver_at      timestamptz NOT NULL DEFAULT now(),   -- quiet hours push to 7:00 AM
  attachment_path text
);
CREATE INDEX messages_thread_idx ON messages (thread_id, created_at);

CREATE TABLE message_translations (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lang       text NOT NULL,
  body       text NOT NULL,
  PRIMARY KEY (message_id, lang)
);

CREATE TABLE idea_votes (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE centers ADD COLUMN quiet_hours_start time NOT NULL DEFAULT '18:30',
                    ADD COLUMN quiet_hours_end   time NOT NULL DEFAULT '07:00';
ALTER TABLE guardians ADD COLUMN preferred_lang text NOT NULL DEFAULT 'en';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE threads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_votes           ENABLE ROW LEVEL SECURITY;

-- A thread is readable if you're a member of it, OR it's a broadcast/room
-- channel at your center (announcement/idea/room), OR it's a family thread and
-- you're a director/admin at the center. DMs: members only — no admin override.
CREATE POLICY "threads_read" ON threads FOR SELECT USING (
  id IN (SELECT thread_id FROM thread_members WHERE user_id = auth.uid())
  OR (kind IN ('announcement', 'idea', 'room')
      AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
  OR (kind = 'family'
      AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')))
);

CREATE POLICY "messages_read" ON messages FOR SELECT USING (
  thread_id IN (SELECT thread_id FROM thread_members WHERE user_id = auth.uid())
  OR thread_id IN (
    SELECT id FROM threads WHERE
      (kind IN ('announcement', 'idea', 'room') AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
      OR (kind = 'family' AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')))
  )
);
-- Members may post to their own readable threads (author must be self).
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND (thread_id IN (SELECT thread_id FROM thread_members WHERE user_id = auth.uid())
       OR thread_id IN (SELECT id FROM threads WHERE kind IN ('room') AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL)))
);

CREATE POLICY "thread_members_self" ON thread_members FOR SELECT USING (
  user_id = auth.uid()
  OR thread_id IN (SELECT thread_id FROM thread_members WHERE user_id = auth.uid())
);
CREATE POLICY "message_translations_read" ON message_translations FOR SELECT USING (
  message_id IN (SELECT id FROM messages)
);
CREATE POLICY "idea_votes_member" ON idea_votes FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
