CREATE TABLE time_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  center_id       uuid NOT NULL REFERENCES centers(id),
  clocked_in_at   timestamptz NOT NULL DEFAULT now(),
  clocked_out_at  timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  token      text NOT NULL,
  platform   text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own entries; directors/admins can read all entries for their center
CREATE POLICY "time_entries_own" ON time_entries
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "time_entries_center_admin" ON time_entries
  FOR SELECT USING (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid()
        AND role IN ('director', 'admin')
        AND left_at IS NULL
    )
  );

CREATE POLICY "push_tokens_own" ON push_tokens
  FOR ALL USING (user_id = auth.uid());
