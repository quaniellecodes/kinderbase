-- Staff profile screen: admin notes, teacher scores (display-only this session),
-- profile fields (emergency contact / availability / leave balances), leave days
-- for the attendance heatmap, and a unified staff_requests table (schedule
-- changes + time corrections + leave).

-- Admin-only notes (never visible to the employee).
CREATE TABLE staff_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  center_id   uuid NOT NULL REFERENCES centers(id),
  written_by  uuid NOT NULL REFERENCES users(id),
  content     text NOT NULL,
  category    text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'hr', 'performance_review', 'commendation', 'incident')),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX staff_notes_user ON staff_notes (user_id, created_at DESC);

-- Teacher quality score (computed nightly in a later session; we only display).
CREATE TABLE teacher_scores (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id),
  center_id             uuid NOT NULL REFERENCES centers(id),
  attendance_score      numeric(3,2) NOT NULL DEFAULT 0,
  posting_score         numeric(3,2) NOT NULL DEFAULT 0,
  lesson_plan_score     numeric(3,2) NOT NULL DEFAULT 0,
  schedule_score        numeric(3,2) NOT NULL DEFAULT 0,
  observation_score     numeric(3,2) NOT NULL DEFAULT 0,
  center_score          numeric(3,2) NOT NULL DEFAULT 0,
  teacher_visible_score numeric(3,2),
  teacher_visible_as_of date,
  computed_at           timestamptz DEFAULT now(),
  UNIQUE (user_id, center_id)
);

-- Profile-only fields with no home elsewhere.
CREATE TABLE staff_profiles (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES users(id),
  center_id                  uuid NOT NULL REFERENCES centers(id),
  personal_email             text,
  emergency_contact_name     text,
  emergency_contact_relation text,
  emergency_contact_phone    text,
  availability               jsonb NOT NULL DEFAULT '{}',  -- {mon..sun: 'full'|'am'|'pm'|'none'}
  sick_hours                 numeric(5,1) NOT NULL DEFAULT 0,
  vacation_hours             numeric(5,1) NOT NULL DEFAULT 0,
  personal_hours             numeric(5,1) NOT NULL DEFAULT 0,
  updated_at                 timestamptz DEFAULT now(),
  UNIQUE (user_id, center_id)
);

-- Staff leave/absence days — drives the attendance heatmap + counts.
CREATE TABLE staff_leave_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  center_id  uuid NOT NULL REFERENCES centers(id),
  day        date NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('pto', 'sick', 'personal', 'unexcused')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, day)
);
CREATE INDEX staff_leave_days_user ON staff_leave_days (user_id, day);

-- Unified requests: schedule changes, time corrections (drives time-history
-- adjustment badges), and leave.
CREATE TABLE staff_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  center_id     uuid NOT NULL REFERENCES centers(id),
  type          text NOT NULL CHECK (type IN ('schedule', 'time_correction', 'leave')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  for_date      date,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  details       text,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX staff_requests_user ON staff_requests (user_id, created_at DESC);
CREATE INDEX staff_requests_center_status ON staff_requests (center_id, status);

ALTER TABLE staff_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_requests   ENABLE ROW LEVEL SECURITY;

-- Helper predicate reused below: caller is an active director/admin of the center.
-- (Inlined per-policy since Postgres RLS can't share a fragment.)

-- Notes: admin-only (never the employee).
CREATE POLICY "staff_notes_admin_only" ON staff_notes
  FOR ALL
  USING (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  )
  WITH CHECK (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  );

-- Teacher scores: center admins, or the teacher reading their own row.
CREATE POLICY "teacher_scores_admin_or_self" ON teacher_scores
  FOR ALL
  USING (
    user_id = auth.uid()
    OR center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  )
  WITH CHECK (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  );

-- Profiles: center admins, or self (read + edit own).
CREATE POLICY "staff_profiles_admin_or_self" ON staff_profiles
  FOR ALL
  USING (
    user_id = auth.uid()
    OR center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  );

-- Leave days: center admins, or self read.
CREATE POLICY "staff_leave_days_admin_or_self" ON staff_leave_days
  FOR ALL
  USING (
    user_id = auth.uid()
    OR center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  )
  WITH CHECK (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND role IN ('director', 'admin') AND left_at IS NULL
    )
  );

-- Requests: any active center member (create own / read), admins manage all.
CREATE POLICY "staff_requests_member" ON staff_requests
  FOR ALL
  USING (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  )
  WITH CHECK (
    center_id IN (
      SELECT center_id FROM center_memberships
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );
