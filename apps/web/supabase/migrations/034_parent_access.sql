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

-- A guardian reads only their own guardian rows.
CREATE POLICY "guardians_self_read" ON guardians FOR SELECT
  USING (app_user_id = auth.uid());

CREATE POLICY "children_guardian_read" ON children FOR SELECT
  USING (id IN (SELECT guardian_child_ids()));

CREATE POLICY "child_attendance_guardian_read" ON child_attendance FOR SELECT
  USING (child_id IN (SELECT guardian_child_ids()));

-- NOTE: no guardian read policy on child_updates / child_update_children /
-- observations / observation_goals. Those carry free-text bodies/captions a
-- teacher wrote for the room, which can name another child — and RLS cannot
-- rewrite text. Parents reach that content ONLY through the server-side scrubbed
-- reader (redactNames, Session 12), so until then they are denied here. Granting
-- a raw-row SELECT would leak classmate names in `body`/`title` via the anon API.

-- Checkpoints + ratings: visible only once released (the release IS the
-- family-facing gate; the teacher's narrative is attached deliberately).
CREATE POLICY "checkpoints_guardian_read" ON checkpoints FOR SELECT
  USING (released_at IS NOT NULL AND child_id IN (SELECT guardian_child_ids()));
CREATE POLICY "checkpoint_ratings_guardian_read" ON checkpoint_ratings FOR SELECT
  USING (checkpoint_id IN (SELECT id FROM checkpoints WHERE released_at IS NOT NULL AND child_id IN (SELECT guardian_child_ids())));
