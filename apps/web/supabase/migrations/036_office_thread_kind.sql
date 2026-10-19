-- Office thread kind (family-facing, admins-only). A per-child private line to the
-- front office that the room's teachers never see — the counterpart to the
-- classroom ('family') thread. Added in its own migration because Postgres forbids
-- USING a new enum value in the same transaction that adds it (037 uses 'office').
ALTER TYPE thread_kind_enum ADD VALUE IF NOT EXISTS 'office';
