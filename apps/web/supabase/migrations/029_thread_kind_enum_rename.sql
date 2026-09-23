-- Naming consistency: 027 created the enum as `thread_kind`, but every other
-- enum in the schema uses the `*_enum` suffix (credential_type_enum,
-- age_group_enum, …) and packages/types/database.ts already declares
-- `thread_kind_enum`. Rename the type so SQL, a future `supabase gen types`
-- regen, and the hand-written types all agree. The `threads.kind` column follows
-- the rename automatically. Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'thread_kind')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'thread_kind_enum') THEN
    ALTER TYPE thread_kind RENAME TO thread_kind_enum;
  END IF;
END $$;
