-- Parent-proposed profile changes with admin approval (family app). A guardian edits
-- a field on the parent app; instead of writing straight through, it files a PENDING
-- change request. Admins see it in their inbox and approve (which APPLIES the change)
-- or deny it with a reason. Major changes (birthday, removing an allergy) are flagged.
-- old_value/new_value are display strings for the admin card; apply_value is the raw
-- value the approver writes to the target table.

CREATE TABLE change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id    uuid NOT NULL REFERENCES centers(id),
  requested_by uuid REFERENCES users(id),
  field_key    text NOT NULL,            -- e.g. guardian.mobile_phone | child.birthdate | health.remove
  target_id    uuid,                     -- the row being changed (guardian/health id; child uses child_id)
  label        text NOT NULL,            -- human label, e.g. "Yolanda's phone", "Birthday", "Allergy: Peanuts"
  old_value    text,                     -- display of the current value
  new_value    text,                     -- display of the proposed value (null = removal)
  apply_value  jsonb,                     -- raw value the approver writes (null = removal)
  severity     text NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal', 'major')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  uuid REFERENCES users(id),
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX change_requests_center_status ON change_requests (center_id, status);
CREATE INDEX change_requests_child_status ON change_requests (child_id, status);

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

-- Staff/admin of the child's center: full access (child-scoped), like the 020
-- *_via_child pattern. (The admin decide action also runs via the service client and
-- restricts the approve/deny to admins in app code; RLS is the backstop.)
CREATE POLICY "change_requests_via_child" ON change_requests FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

-- Guardians: read + file + cancel their own children's requests (defense-in-depth;
-- the parent action writes via the service client with assertReachable/assertCanWrite).
CREATE POLICY "change_requests_guardian_read" ON change_requests FOR SELECT
  USING (child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "change_requests_guardian_insert" ON change_requests FOR INSERT
  WITH CHECK (child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "change_requests_guardian_delete" ON change_requests FOR DELETE
  USING (child_id IN (SELECT guardian_child_ids()));
