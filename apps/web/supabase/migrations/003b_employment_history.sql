CREATE TABLE employment_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id),
  employer_name    text NOT NULL,
  center_id        uuid REFERENCES centers(id),   -- null if employer not in KinderBase
  role_title       text NOT NULL,
  start_date       date NOT NULL,
  end_date         date,                           -- null = current position
  show_on_profile  boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE employment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employment_owner" ON employment_history
  FOR ALL USING (user_id = auth.uid());
