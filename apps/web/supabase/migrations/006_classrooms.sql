CREATE TYPE age_group_enum AS ENUM (
  'infant',
  'toddler',
  'two_year',
  'preschool',
  'school_age'
);

CREATE TABLE classrooms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id          uuid NOT NULL REFERENCES centers(id),
  name               text NOT NULL,
  age_group          age_group_enum NOT NULL,
  licensed_capacity  int NOT NULL,
  typical_enrollment int NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  deleted_at         timestamptz
);

CREATE TABLE staffing_patterns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  hour         smallint NOT NULL CHECK (hour BETWEEN 6 AND 19),
  staff_count  smallint NOT NULL DEFAULT 0,
  UNIQUE (classroom_id, day_of_week, hour)
);

ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE staffing_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classroom_center_member" ON classrooms
  FOR ALL USING (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "staffing_pattern_via_classroom" ON staffing_patterns
  FOR ALL USING (
    classroom_id IN (
      SELECT c.id FROM classrooms c
      JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );
