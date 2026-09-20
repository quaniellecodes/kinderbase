-- Students module: rich profile over the existing `children` entity.
-- The UI calls these "students"; the data lives on `children` (extended
-- additively) + satellite tables. Everything reaches the center via
-- children.center_id for RLS. All policies use USING + WITH CHECK.

CREATE TYPE student_enrollment_status AS ENUM ('active', 'inactive', 'waitlist', 'graduated');
CREATE TYPE guardian_rel AS ENUM ('mother', 'father', 'grandparent', 'guardian', 'other');
CREATE TYPE doc_status AS ENUM ('current', 'review_due', 'missing', 'na');

-- ── Extend children (kept additive; existing status/enrolled_at/birthdate stay) ──
ALTER TABLE children
  ADD COLUMN middle_name       text,
  ADD COLUMN preferred_name    text,
  ADD COLUMN student_code       text,
  ADD COLUMN enrollment_status  student_enrollment_status NOT NULL DEFAULT 'active',
  ADD COLUMN sex                text,
  ADD COLUMN primary_language   text,
  ADD COLUMN home_languages     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN tags               text[] NOT NULL DEFAULT '{}',
  ADD COLUMN address_line1      text,
  ADD COLUMN address_line2      text,
  ADD COLUMN city               text,
  ADD COLUMN state              char(2),
  ADD COLUMN zip                text,
  ADD COLUMN graduates_on       date,
  ADD COLUMN photo_path         text,
  ADD COLUMN photo_consent      boolean NOT NULL DEFAULT false,
  ADD COLUMN admin_notes        text;

-- Sign-in log details for the Activity tab.
ALTER TABLE child_attendance
  ADD COLUMN signed_in_by    uuid,
  ADD COLUMN sign_in_method  text,
  ADD COLUMN signed_out_by   uuid,
  ADD COLUMN sign_out_method text;

CREATE TABLE student_siblings (
  child_id   uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  sibling_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (child_id, sibling_id)
);

CREATE TABLE guardians (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id             uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  full_name            text NOT NULL,
  relationship         guardian_rel NOT NULL,
  email                text,
  mobile_phone         text,
  employer             text,
  work_phone           text,
  is_primary           boolean NOT NULL DEFAULT false,
  is_emergency         boolean NOT NULL DEFAULT false,
  custody_note         text,
  is_pickup_restricted boolean NOT NULL DEFAULT false,
  kiosk_pin            text,
  app_user_id          uuid REFERENCES users(id),
  invited_at           timestamptz,
  sort_order           int NOT NULL DEFAULT 0
);
CREATE INDEX guardians_child ON guardians (child_id);

CREATE TABLE authorized_pickups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  relationship  text,
  phone         text,
  kiosk_pin     text,
  photo_path    text,
  authorized_by uuid REFERENCES guardians(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE student_health (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id            uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  kind                text NOT NULL,   -- allergy | medication | diet | condition
  name                text NOT NULL,
  detail              text,
  severity            text,            -- severe | moderate | mild | prn
  rescue_med          text,
  rescue_med_location text,
  rescue_med_expires  date,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE student_physicians (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name       text NOT NULL,
  practice   text,
  phone      text,
  last_visit date
);

CREATE TABLE student_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  doc_type         text NOT NULL,
  label            text NOT NULL,
  storage_path     text,
  status           doc_status NOT NULL DEFAULT 'missing',
  is_required      boolean NOT NULL DEFAULT false,
  is_confidential  boolean NOT NULL DEFAULT false,
  signed_by        text,
  signed_on        date,
  review_due       date,
  uploaded_by      uuid REFERENCES users(id),
  uploaded_at      timestamptz,
  superseded_by    uuid REFERENCES student_documents(id) ON DELETE SET NULL
);

CREATE TABLE student_descriptors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id  uuid REFERENCES centers(id),   -- null = KinderBase default
  group_key  text NOT NULL,                 -- loves|comfort|naps|eating|...
  label      text NOT NULL,
  UNIQUE (center_id, group_key, label)
);

CREATE TABLE student_about (
  child_id   uuid PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  selections jsonb NOT NULL DEFAULT '{}',
  note       text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE student_schedule (
  child_id        uuid PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  days            jsonb NOT NULL DEFAULT '{}',
  dropoff_window  text,
  pickup_window   text,
  transition_room text,
  transition_date date
);

-- ── RLS: center-scoped via children ─────────────────────────────────────────
ALTER TABLE student_siblings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians           ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_pickups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_health      ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_physicians  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_descriptors ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_about       ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_schedule    ENABLE ROW LEVEL SECURITY;

-- child-scoped tables: member of the child's center
CREATE POLICY "student_siblings_via_child" ON student_siblings FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "guardians_via_child" ON guardians FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "authorized_pickups_via_child" ON authorized_pickups FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "student_health_via_child" ON student_health FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "student_physicians_via_child" ON student_physicians FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "student_about_via_child" ON student_about FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "student_schedule_via_child" ON student_schedule FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

-- Documents: members read/write non-confidential; confidential is director/admin only.
CREATE POLICY "student_documents_read" ON student_documents FOR SELECT
  USING (
    child_id IN (
      SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id
      WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL
        AND (NOT student_documents.is_confidential OR cm.role IN ('director', 'admin'))
    )
  );
CREATE POLICY "student_documents_write" ON student_documents FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

-- Descriptors: center defaults (null center_id) readable by all; center rows by members.
CREATE POLICY "student_descriptors_read" ON student_descriptors FOR SELECT
  USING (
    center_id IS NULL
    OR center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL)
  );
CREATE POLICY "student_descriptors_write" ON student_descriptors FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL));
