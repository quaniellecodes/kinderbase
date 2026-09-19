CREATE TYPE credential_type_enum AS ENUM (
  'preschool_90hr', 'infant_toddler_9hr', 'communication_9hr',
  'ada_training', 'first_aid_cpr', 'child_abuse_prevention',
  'medication_administration', 'cda', 'directors_certification',
  'college_degree', 'other'
);

CREATE TYPE credential_status_enum AS ENUM ('active', 'expiring_soon', 'expired', 'no_expiration');

CREATE TABLE credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  credential_type   credential_type_enum NOT NULL,
  custom_type_name  text,
  issuing_org       text NOT NULL,
  issued_at         date NOT NULL,
  expires_at        date,
  storage_path      text NOT NULL,
  show_on_profile   boolean NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  deleted_at        timestamptz
);

CREATE TABLE credential_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id   uuid NOT NULL REFERENCES credentials(id),
  action          text NOT NULL,
  changed_by      uuid NOT NULL REFERENCES users(id),
  previous_values jsonb,
  created_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_owner" ON credentials
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "credentials_center_admin" ON credentials
  FOR SELECT USING (
    user_id IN (
      SELECT cm.user_id FROM center_memberships cm
      WHERE cm.center_id = ANY(
        SELECT center_id FROM center_memberships
        WHERE user_id = auth.uid()
        AND role IN ('director', 'admin')
        AND left_at IS NULL
      )
      AND cm.left_at IS NULL
    )
  );

CREATE POLICY "audit_logs_owner" ON credential_audit_logs
  FOR SELECT USING (
    credential_id IN (
      SELECT id FROM credentials WHERE user_id = auth.uid()
    )
  );
