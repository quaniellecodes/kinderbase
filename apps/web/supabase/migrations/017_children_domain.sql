-- Children domain: enrolled children, daily attendance (sign-in/out), and the
-- per-child care log (meals/naps/milestones/incidents) that feeds the activity
-- feed and teacher accountability. Minimal child record for now — guardian/
-- contact details will live in a future child profile.

CREATE TABLE children (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id    uuid NOT NULL REFERENCES centers(id),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  birthdate    date NOT NULL,
  enrolled_at  date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'withdrawn')),
  created_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX children_classroom ON children (classroom_id);
CREATE INDEX children_center ON children (center_id);

-- One row per child per day. Present = signed_in_at set and signed_out_at null.
-- Absent = no row for that date.
CREATE TABLE child_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  classroom_id    uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  signed_in_at    timestamptz,
  signed_out_at   timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (child_id, attendance_date)
);

CREATE INDEX child_attendance_classroom_date ON child_attendance (classroom_id, attendance_date);

-- Per-child care log. A single update can tag multiple children (see the join
-- table) — e.g. one nap log covering two kids.
CREATE TABLE child_updates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES users(id),
  update_type  text NOT NULL CHECK (update_type IN ('meal', 'nap', 'milestone', 'incident')),
  body         text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX child_updates_classroom_created ON child_updates (classroom_id, created_at DESC);
CREATE INDEX child_updates_author ON child_updates (author_id, created_at DESC);

CREATE TABLE child_update_children (
  update_id uuid NOT NULL REFERENCES child_updates(id) ON DELETE CASCADE,
  child_id  uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (update_id, child_id)
);

-- RLS: tenant isolation via center membership. Admin-only mutations are enforced
-- in server actions; these policies validate reads and writes (USING + WITH CHECK).
ALTER TABLE children             ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_updates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_update_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "children_via_center" ON children
  FOR ALL
  USING (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  )
  WITH CHECK (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "child_attendance_via_classroom" ON child_attendance
  FOR ALL
  USING (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  )
  WITH CHECK (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );

CREATE POLICY "child_updates_via_classroom" ON child_updates
  FOR ALL
  USING (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  )
  WITH CHECK (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );

CREATE POLICY "child_update_children_via_update" ON child_update_children
  FOR ALL
  USING (
    update_id IN (
      SELECT cu.id FROM child_updates cu
      JOIN classrooms c ON c.id = cu.classroom_id
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  )
  WITH CHECK (
    update_id IN (
      SELECT cu.id FROM child_updates cu
      JOIN classrooms c ON c.id = cu.classroom_id
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );
