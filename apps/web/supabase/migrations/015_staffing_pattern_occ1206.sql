-- OCC 1206 staffing pattern: per-staff, half-hourly grid.
-- Times use 30-min SLOT INDICES: slot s = [s*30min, (s+1)*30min). Slot 11 = 05:30,
-- slot 48 = 24:00. Paintable / child-count slots are 0..47; close_slot may be 48.
-- Additive only: the old staffing_patterns table is left untouched (deprecated).

-- Center operating hours + days (drive the grid columns and day tabs)
ALTER TABLE centers
  ADD COLUMN open_slot      smallint  NOT NULL DEFAULT 12,   -- 06:00
  ADD COLUMN close_slot     smallint  NOT NULL DEFAULT 38,   -- 19:00
  ADD COLUMN operating_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}';  -- 1=Mon..7=Sun

ALTER TABLE centers
  ADD CONSTRAINT centers_slot_range CHECK (open_slot >= 0 AND close_slot <= 48 AND open_slot < close_slot),
  ADD CONSTRAINT centers_operating_days CHECK (operating_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);

-- OCC 1206 header field
ALTER TABLE classrooms
  ADD COLUMN pattern_effective_date date;

-- Roster: the Y-axis rows of the pattern (one per staff member per classroom).
-- Either a linked member (user_id) or a free-text name for ad-hoc staff/subs.
CREATE TABLE classroom_staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE RESTRICT,
  staff_name    text,
  position_code text,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT classroom_staff_identity CHECK (user_id IS NOT NULL OR staff_name IS NOT NULL),
  CONSTRAINT classroom_staff_position CHECK (
    position_code IS NULL OR position_code IN ('D', 'TI', 'TP', 'TS', 'ATS', 'A')
  )
);

-- Prevent adding the same member twice; free-text names may repeat.
CREATE UNIQUE INDEX classroom_staff_unique_member
  ON classroom_staff (classroom_id, user_id) WHERE user_id IS NOT NULL;

-- Presence cells: a row means this staff member supervises the room in this slot.
-- Contiguous slots render as a bar; gaps are breaks.
CREATE TABLE staff_shift_slots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_staff_id uuid NOT NULL REFERENCES classroom_staff(id) ON DELETE CASCADE,
  day_of_week        smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  slot               smallint NOT NULL CHECK (slot BETWEEN 0 AND 47),
  UNIQUE (classroom_staff_id, day_of_week, slot)
);

CREATE INDEX staff_shift_slots_staff ON staff_shift_slots (classroom_staff_id);

-- Operator-entered total children present per slot (independent of the roster).
CREATE TABLE classroom_child_counts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id   uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week    smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  slot           smallint NOT NULL CHECK (slot BETWEEN 0 AND 47),
  total_children smallint NOT NULL DEFAULT 0,
  UNIQUE (classroom_id, day_of_week, slot)
);

-- RLS: tenant isolation via center membership (admin-only editing is enforced in
-- the server actions). Every policy has both USING and WITH CHECK so inserts and
-- updates are validated too.
ALTER TABLE classroom_staff       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shift_slots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_child_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classroom_staff_via_classroom" ON classroom_staff
  FOR ALL
  USING (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  )
  WITH CHECK (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );

CREATE POLICY "staff_shift_slots_via_classroom" ON staff_shift_slots
  FOR ALL
  USING (
    classroom_staff_id IN (
      SELECT cs.id FROM classroom_staff cs
      JOIN classrooms c ON c.id = cs.classroom_id
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  )
  WITH CHECK (
    classroom_staff_id IN (
      SELECT cs.id FROM classroom_staff cs
      JOIN classrooms c ON c.id = cs.classroom_id
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );

CREATE POLICY "classroom_child_counts_via_classroom" ON classroom_child_counts
  FOR ALL
  USING (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  )
  WITH CHECK (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );
