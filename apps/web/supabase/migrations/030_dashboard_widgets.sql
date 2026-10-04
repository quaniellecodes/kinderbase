-- Customizable director dashboard (docs/sessions/07-DESKTOP.md §2). Per-user,
-- per-center widget layout: order, span (1–3 columns), and visibility. No rows
-- for a user means "use the default layout" (resolved in code), so a new
-- director never sees an empty dashboard. The locked compliance banner is not a
-- widget and is never stored here.
CREATE TABLE dashboard_widgets (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id  uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  widget_key text NOT NULL,
  sort_order int NOT NULL,
  span       int NOT NULL DEFAULT 2 CHECK (span BETWEEN 1 AND 3),
  visible    boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, center_id, widget_key)
);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- A user reads and writes only their own layout rows.
CREATE POLICY "dashboard_widgets_own" ON dashboard_widgets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
