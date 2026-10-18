-- Session 11 Phase 2 — parent principal read access (docs/PARENT-DECISIONS.md §1).
--
-- Guardians authenticate as `users` linked via guardians.app_user_id. These are
-- SELECT-only policies ADDED ALONGSIDE the existing staff (center-membership)
-- policies; Postgres OR's permissive policies, so staff access is unchanged. A
-- parent gets NO policy on staffing, assignments, time_entries, staff_breaks,
-- teacher_scores, approvals, staff threads, or lesson plans, so those remain
-- denied to the parent principal automatically (deny by default).
--
-- Resolving the guardian's children through a plain subquery on `guardians`
-- recurses: children policy → guardians (RLS) → guardians_via_child → children
-- (RLS) → children policy → … So the child/update sets come from SECURITY DEFINER
-- helpers that read WITHOUT RLS, breaking the cycle (same fix as the old circular
-- centers policy).

-- Checkpoint release (§2): ratings are parent-visible only once released, with a
-- narrative. Observations stay live. released_at is the family-visibility switch;
-- the internal staff workflow still uses status draft|submitted|locked.
ALTER TABLE checkpoints ADD COLUMN released_at timestamptz;
ALTER TABLE checkpoints ADD COLUMN released_by uuid REFERENCES users(id);

CREATE OR REPLACE FUNCTION guardian_child_ids()
  RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT child_id FROM guardians WHERE app_user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION guardian_update_ids()
  RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT update_id FROM child_update_children WHERE child_id IN (SELECT guardian_child_ids()) $$;

-- A guardian reads only their own guardian rows.
CREATE POLICY "guardians_self_read" ON guardians FOR SELECT
  USING (app_user_id = auth.uid());

CREATE POLICY "children_guardian_read" ON children FOR SELECT
  USING (id IN (SELECT guardian_child_ids()));

CREATE POLICY "child_attendance_guardian_read" ON child_attendance FOR SELECT
  USING (child_id IN (SELECT guardian_child_ids()));

-- The guardian sees an update tagged to their child (via the definer helper), and
-- only their own child's tag row — a sibling or classmate tagged on the same
-- update never arrives (name scrub enforced at the row level).
CREATE POLICY "child_updates_guardian_read" ON child_updates FOR SELECT
  USING (id IN (SELECT guardian_update_ids()));
CREATE POLICY "child_update_children_guardian_read" ON child_update_children FOR SELECT
  USING (child_id IN (SELECT guardian_child_ids()));

-- Observations are live.
CREATE POLICY "observations_guardian_read" ON observations FOR SELECT
  USING (child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "observation_goals_guardian_read" ON observation_goals FOR SELECT
  USING (observation_id IN (SELECT id FROM observations WHERE child_id IN (SELECT guardian_child_ids())));

-- Checkpoints + ratings: visible only once released.
CREATE POLICY "checkpoints_guardian_read" ON checkpoints FOR SELECT
  USING (released_at IS NOT NULL AND child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "checkpoint_ratings_guardian_read" ON checkpoint_ratings FOR SELECT
  USING (checkpoint_id IN (SELECT id FROM checkpoints WHERE released_at IS NOT NULL AND child_id IN (SELECT guardian_child_ids())));
