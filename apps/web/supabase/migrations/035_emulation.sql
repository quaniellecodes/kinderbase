-- Session 11 Phase 6 — parent emulation / "view as parent" (PARENT-DECISIONS §7c).
--
-- A director opens a named guardian's view (or the sample family) to see exactly
-- what they see. Mirrors the staff Preview/Cover model (cover_sessions): a
-- server-side session record, read back per request, scoping the effective
-- principal. Read-only is enforced in code (a centralized write guard, never
-- per-action opt-in). Always audited; a privacy event, not a routine role view.
CREATE TABLE emulation_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id   uuid NOT NULL REFERENCES users(id),
  guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL,
  child_id    uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id   uuid NOT NULL REFERENCES centers(id),
  is_sample   boolean NOT NULL DEFAULT false,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);
CREATE INDEX emulation_sessions_open ON emulation_sessions (viewer_id) WHERE ended_at IS NULL;

ALTER TABLE emulation_sessions ENABLE ROW LEVEL SECURITY;

-- Permission-gated to owner/director of the center, and only the viewer's own
-- sessions. Not granted to every admin.
CREATE POLICY "emulation_own_director" ON emulation_sessions FOR ALL
  USING (
    viewer_id = auth.uid()
    AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role = 'director')
  )
  WITH CHECK (
    viewer_id = auth.uid()
    AND center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role = 'director')
  );
