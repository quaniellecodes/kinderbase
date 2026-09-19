ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "centers_org_members" ON centers
  FOR SELECT USING (
    org_id IN (
      SELECT c.org_id FROM centers c
      JOIN center_memberships cm ON cm.center_id = c.id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );

CREATE POLICY "memberships_owner" ON center_memberships
  FOR SELECT USING (user_id = auth.uid());
