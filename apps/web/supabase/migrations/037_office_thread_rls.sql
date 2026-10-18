-- Office threads, part 2: allow two threads per child (one 'family' classroom
-- thread + one 'office' thread) and grant center admins read/write on office
-- threads. Teachers get NO access — they are neither members nor admins — which is
-- the whole point of the office line. Guardians reach office threads through the
-- existing member branch of threads_read / messages_read / messages_insert (027).

-- One thread per (child, kind) instead of one per child. Widening only — no data
-- loss: every existing family thread already has a distinct student_id, and NULL
-- student_ids (announcement/room/idea/dm) stay distinct under UNIQUE as before.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_student_id_key;
ALTER TABLE threads ADD CONSTRAINT threads_student_kind_key UNIQUE (student_id, kind);

-- Admin read/write on office threads (OR-ed with the existing member policies, so
-- the guardian keeps access as a member while teachers get none).
CREATE POLICY "threads_read_office" ON threads FOR SELECT USING (
  kind = 'office'
  AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin'))
);
CREATE POLICY "messages_read_office" ON messages FOR SELECT USING (
  thread_id IN (
    SELECT id FROM threads WHERE kind = 'office'
      AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin'))
  )
);
CREATE POLICY "messages_insert_office" ON messages FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND thread_id IN (
    SELECT id FROM threads WHERE kind = 'office'
      AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin'))
  )
);
