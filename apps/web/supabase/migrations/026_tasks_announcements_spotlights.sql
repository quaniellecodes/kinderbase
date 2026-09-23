-- Teacher Today (docs/sessions/03-TODAY-ME.md §1): admin-assigned tasks (incl.
-- nudges), management announcements, and monthly category spotlights.
-- Center-membership scoped RLS; write rules enforced in server actions.

CREATE TABLE staff_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   uuid NOT NULL REFERENCES centers(id),
  assigned_to uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  title       text NOT NULL,
  detail      text,
  due_at      timestamptz,
  source      text NOT NULL DEFAULT 'assigned' CHECK (source IN ('assigned', 'nudge', 'idea')),
  completed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX staff_tasks_assignee_idx ON staff_tasks (assigned_to, completed_at);

CREATE TABLE announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id  uuid NOT NULL REFERENCES centers(id),
  author_id  uuid NOT NULL REFERENCES users(id),
  body       text NOT NULL,
  kind       text NOT NULL DEFAULT 'announcement' CHECK (kind IN ('announcement', 'reminder')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX announcements_center_idx ON announcements (center_id, created_at DESC);

CREATE TABLE spotlights (
  center_id uuid NOT NULL REFERENCES centers(id),
  month     date NOT NULL,
  category  text NOT NULL,
  user_id   uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (center_id, month, category)
);

ALTER TABLE staff_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotlights     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_tasks_member" ON staff_tasks FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL));
CREATE POLICY "announcements_member" ON announcements FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL));
CREATE POLICY "spotlights_member" ON spotlights FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL));
