-- Fix circular RLS on centers.
-- 012 created "centers_org_members", whose USING clause selects FROM centers
-- inside a policy ON centers -> Postgres raises "infinite recursion detected
-- in policy for relation centers" whenever centers is read (including the
-- embedded centers(id, name) join in getMemberships), which surfaced as
-- "Your account isn't linked to any center yet."
--
-- Replace it with "centers_member", which checks center_memberships directly
-- and never self-references centers. Idempotent so it is safe on prod, where
-- the equivalent policy was already applied by hand.

DROP POLICY IF EXISTS "centers_org_members" ON centers;
DROP POLICY IF EXISTS "centers_member" ON centers;

CREATE POLICY "centers_member" ON centers
  FOR SELECT USING (
    id IN (
      SELECT cm.center_id FROM center_memberships cm
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );
