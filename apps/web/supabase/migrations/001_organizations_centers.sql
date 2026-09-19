CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TYPE license_type_enum AS ENUM ('child_care_center', 'letter_of_compliance');

CREATE TABLE centers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id),
  name                  text NOT NULL,
  address               text NOT NULL,
  licensed_capacity     int NOT NULL,
  occ_license_number    text NOT NULL,
  license_type          license_type_enum NOT NULL DEFAULT 'child_care_center',
  occ_region            text,
  created_at            timestamptz DEFAULT now()
);