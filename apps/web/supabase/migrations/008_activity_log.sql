CREATE TABLE activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   uuid NOT NULL REFERENCES centers(id),
  actor_id    uuid REFERENCES users(id),
  event_type  text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX activity_log_center_created ON activity_log (center_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_read_member" ON activity_log
  FOR SELECT USING (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "activity_log_insert_member" ON activity_log
  FOR INSERT WITH CHECK (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );
