-- Lesson plans + daily routines (docs/sessions/02-CLASSROOM.md §3, §6, §7).
-- OMH Creative Curriculum template. Only the room's lead writes the plan while
-- draft/returned (enforced in the server action; RLS is center-member scoped).

CREATE TABLE lesson_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  week_of       date NOT NULL,                       -- Monday
  theme         text,
  letter        text,
  number        text,
  shape         text,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'submitted', 'returned', 'approved')),
  submitted_by  uuid REFERENCES users(id),
  submitted_at  timestamptz,
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  review_comment text,
  UNIQUE (classroom_id, week_of)
);

CREATE TABLE lesson_plan_days (
  plan_id      uuid NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  day          text NOT NULL CHECK (day IN ('mon', 'tue', 'wed', 'thu', 'fri')),
  question     text,
  circle_parts text[] NOT NULL DEFAULT '{}',         -- Greeting|Songs|Read Aloud|Music & Movement
  circle_notes text,
  outdoor      text,
  stations     text[] NOT NULL DEFAULT '{"","","",""}',
  PRIMARY KEY (plan_id, day)
);

CREATE TABLE classroom_routines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  starts_at    time NOT NULL,
  title        text NOT NULL,
  detail       text,
  sort_order   int NOT NULL DEFAULT 0
);
CREATE INDEX classroom_routines_room_idx ON classroom_routines (classroom_id, sort_order);

ALTER TABLE lesson_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_days  ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_plans_member" ON lesson_plans FOR ALL
  USING (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "lesson_plan_days_member" ON lesson_plan_days FOR ALL
  USING (plan_id IN (SELECT lp.id FROM lesson_plans lp JOIN classrooms c ON c.id = lp.classroom_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (plan_id IN (SELECT lp.id FROM lesson_plans lp JOIN classrooms c ON c.id = lp.classroom_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "classroom_routines_member" ON classroom_routines FOR ALL
  USING (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));
