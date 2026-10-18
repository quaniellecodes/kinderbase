-- Per-admin dismissal of "Heads up" items on the admin Home (and desktop
-- dashboard). Heads-up items are derived every render, so a dismissal has to be
-- stored or it reappears immediately. `alert_key` is content-aware (e.g.
-- "cred:9", "aging:<thread-id>"), so a dismissed item re-surfaces when the
-- underlying situation materially changes. Dismissals are read with a rolling
-- window in code (a snooze), so they also age out on their own.
CREATE TABLE dismissed_alerts (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id    uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  alert_key    text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, center_id, alert_key)
);

ALTER TABLE dismissed_alerts ENABLE ROW LEVEL SECURITY;

-- A user reads and writes only their own dismissals.
CREATE POLICY "dismissed_alerts_own" ON dismissed_alerts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
