CREATE TYPE platform_role_enum AS ENUM ('owner', 'staff');
CREATE TYPE center_role_enum AS ENUM (
  'director', 'admin', 'lead_teacher', 'assistant_teacher', 'aide', 'substitute'
);

CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text UNIQUE NOT NULL,
  full_name       text NOT NULL,
  phone           text,
  role            platform_role_enum NOT NULL DEFAULT 'staff',
  handle          text UNIQUE,
  profile_public  boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE center_memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  center_id         uuid NOT NULL REFERENCES centers(id),
  role              center_role_enum NOT NULL,
  is_primary_center boolean NOT NULL DEFAULT false,
  joined_at         timestamptz DEFAULT now(),
  left_at           timestamptz,
  UNIQUE(user_id, center_id)
);