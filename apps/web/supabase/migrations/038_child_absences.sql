-- Parent absence reporting (docs/PARENT-DECISIONS.md §6: "one tap, reaches
-- tomorrow's staffing"). A guardian reports that a child will be out on a date; it
-- surfaces to staff/admins on the calendar (derived — never written to
-- calendar_events). One row per child per day — re-reporting updates the reason.

CREATE TABLE child_absences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id   uuid NOT NULL REFERENCES centers(id),
  absent_on   date NOT NULL,
  reason      text NOT NULL DEFAULT 'other' CHECK (reason IN ('sick', 'vacation', 'appointment', 'other')),
  note        text,
  reported_by uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (child_id, absent_on)
);
CREATE INDEX child_absences_center_date ON child_absences (center_id, absent_on);

ALTER TABLE child_absences ENABLE ROW LEVEL SECURITY;

-- Staff/admin of the child's center: full access (child-scoped), matching the 020
-- *_via_child pattern. (The app also reads/writes via the service client.)
CREATE POLICY "child_absences_via_child" ON child_absences FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

-- Guardians: read + report + cancel for their own children (defense-in-depth; the
-- parent action writes via the service client with assertReachable/assertCanWrite).
CREATE POLICY "child_absences_guardian_read" ON child_absences FOR SELECT
  USING (child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "child_absences_guardian_write" ON child_absences FOR INSERT
  WITH CHECK (child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "child_absences_guardian_update" ON child_absences FOR UPDATE
  USING (child_id IN (SELECT guardian_child_ids()))
  WITH CHECK (child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "child_absences_guardian_delete" ON child_absences FOR DELETE
  USING (child_id IN (SELECT guardian_child_ids()));

-- New built-in calendar type so absences show on the staff/admin calendar. Derived
-- (computed per request, never stored as a calendar_event); staff + admins, not
-- families (a family sees their own child's absence in the parent app, not here).
INSERT INTO calendar_event_types (center_id, key, label, colour, icon, is_system, is_derived, visible_admin, visible_staff, visible_family, sort_order)
  VALUES (NULL, 'absence', 'Absences', '#B45309', '🤒', true, true, true, true, false, 12)
  ON CONFLICT (center_id, key) DO NOTHING;
