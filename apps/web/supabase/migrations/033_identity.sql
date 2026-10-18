-- Session 11 Phase 1 — identity & enrollment model (docs/PARENT-DECISIONS.md #16).
--
-- A child becomes a person owned by a `family`; a center relationship becomes a
-- dated `enrollment`. This is the Phase-1 decision that cannot be retrofitted once
-- there is real data (the family archive and cross-center journey depend on it).
--
-- ADDITIVE ONLY (non-negotiable rule #4): `children.center_id` is KEPT as a
-- denormalized mirror. The staffing engine reads a room's children from
-- `child_attendance` by classroom (lib/staffing/room-state.ts), never
-- `children.center_id`, so the entire roster/ratio/count path is unaffected; the
-- ~20 center-scoped directory/count reads keep working against the mirror.

-- ── Families ─────────────────────────────────────────────────────────────────
CREATE TABLE families (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  is_sample    boolean NOT NULL DEFAULT false,   -- admin-only demo family (§7c)
  created_at   timestamptz DEFAULT now()
);

-- ── Enrollments (dated, center-scoped relationship) ──────────────────────────
CREATE TABLE enrollments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id    uuid NOT NULL REFERENCES centers(id),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  starts_on    date NOT NULL,
  ends_on      date,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'waitlist', 'sample')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (child_id, center_id, starts_on)
);
CREATE INDEX enrollments_child ON enrollments (child_id);
CREATE INDEX enrollments_center ON enrollments (center_id);
CREATE INDEX enrollments_classroom ON enrollments (classroom_id);

-- ── Additive columns ─────────────────────────────────────────────────────────
ALTER TABLE children ADD COLUMN family_id uuid REFERENCES families(id);
-- Operational-exclusion flag read by the children-centric count/directory queries
-- (the sample child is also excluded centrally at the loadRoomInput attendance join).
ALTER TABLE children ADD COLUMN is_sample boolean NOT NULL DEFAULT false;
CREATE INDEX children_family ON children (family_id);

-- Explicit guardian permission levels (§1): pickup | account | edit_record.
ALTER TABLE guardians ADD COLUMN permissions text[] NOT NULL DEFAULT '{}';

-- ── Backfill existing data (in the same migration — a half-migrated identity
--    model is worse than none) ─────────────────────────────────────────────────
DO $$
DECLARE r RECORD; fid uuid;
BEGIN
  FOR r IN SELECT id, center_id, classroom_id, enrolled_at, status, last_name FROM children LOOP
    INSERT INTO families (display_name) VALUES (r.last_name) RETURNING id INTO fid;
    UPDATE children SET family_id = fid WHERE id = r.id;
    INSERT INTO enrollments (child_id, center_id, classroom_id, starts_on, status)
    VALUES (
      r.id, r.center_id, r.classroom_id, COALESCE(r.enrolled_at, CURRENT_DATE),
      CASE WHEN r.status = 'withdrawn' THEN 'ended' ELSE 'active' END
    )
    ON CONFLICT (child_id, center_id, starts_on) DO NOTHING;
  END LOOP;
END $$;

-- Guardian permissions from existing flags: a primary guardian may edit the
-- record; everyone may collect and see the feed; a pickup-restricted person loses
-- collection rights.
UPDATE guardians SET permissions =
  CASE WHEN is_primary THEN ARRAY['pickup', 'account', 'edit_record']
       ELSE ARRAY['pickup', 'account'] END;
UPDATE guardians SET permissions = array_remove(permissions, 'pickup') WHERE is_pickup_restricted;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Enrollments: readable by staff of the center OR a guardian of the child; writes admin-only.
CREATE POLICY "enrollments_read" ON enrollments FOR SELECT
  USING (
    center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL)
    OR child_id IN (SELECT child_id FROM guardians WHERE app_user_id = auth.uid())
  );
CREATE POLICY "enrollments_admin_write" ON enrollments FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')));

-- Families: readable by a guardian of a child in the family OR staff of a center the family enrolls in.
CREATE POLICY "families_read" ON families FOR SELECT
  USING (
    id IN (
      SELECT family_id FROM children WHERE family_id IS NOT NULL AND (
        id IN (SELECT child_id FROM guardians WHERE app_user_id = auth.uid())
        OR center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL)
      )
    )
  );
CREATE POLICY "families_admin_write" ON families FOR ALL
  USING (id IN (SELECT family_id FROM children WHERE center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin'))))
  WITH CHECK (true);
