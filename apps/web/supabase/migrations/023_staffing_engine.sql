-- Staffing engine (docs/sessions/01-ENGINE.md §2). Qualification is separate from
-- job title; time-windowed assignments are the source of truth for "who's on the
-- floor now"; append-only nap events; break audit. child_attendance already
-- exists (017) and is reused. All RLS scoped to center membership.

-- Qualification flags (later derived from credentials; admin-set for now).
ALTER TABLE center_memberships
  ADD COLUMN lead_qualified          boolean NOT NULL DEFAULT false,
  ADD COLUMN infant_toddler_trained  boolean NOT NULL DEFAULT false;

CREATE TYPE assignment_source AS ENUM ('schedule', 'float', 'substitute', 'cover');

CREATE TABLE staff_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id    uuid NOT NULL REFERENCES centers(id),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  source       assignment_source NOT NULL DEFAULT 'schedule',
  assigned_by  uuid REFERENCES users(id),
  note         text,
  created_at   timestamptz DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX staff_assignments_room_idx ON staff_assignments (classroom_id, starts_at, ends_at);
CREATE INDEX staff_assignments_user_idx ON staff_assignments (user_id, starts_at, ends_at);

CREATE TYPE nap_state AS ENUM ('awake', 'settling', 'resting');

-- Append-only; current state = latest row today for the classroom.
CREATE TABLE classroom_nap_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  state        nap_state NOT NULL,
  set_by       uuid NOT NULL REFERENCES users(id),
  set_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classroom_nap_events_room_idx ON classroom_nap_events (classroom_id, set_at DESC);

CREATE TABLE staff_breaks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id   uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES users(id),
  started_at     timestamptz NOT NULL,
  ended_at       timestamptz,
  engine_snapshot jsonb NOT NULL   -- the evaluation that allowed it, for audit
);
CREATE INDEX staff_breaks_room_idx ON staff_breaks (classroom_id, started_at DESC);

-- Preview / cover sessions (Session 4 uses this; created here so the engine can
-- count a covering admin via a source='cover' assignment).
CREATE TABLE cover_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  mode         text NOT NULL CHECK (mode IN ('preview', 'cover')),
  started_at   timestamptz NOT NULL,
  ended_at     timestamptz
);
CREATE INDEX cover_sessions_room_idx ON cover_sessions (classroom_id, started_at DESC);

-- ── RLS: center-membership scoped ────────────────────────────────────────────
ALTER TABLE staff_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_nap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_breaks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_sessions       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_assignments_member" ON staff_assignments FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL));

CREATE POLICY "nap_events_member" ON classroom_nap_events FOR ALL
  USING (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "staff_breaks_member" ON staff_breaks FOR ALL
  USING (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "cover_sessions_member" ON cover_sessions FOR ALL
  USING (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (classroom_id IN (SELECT c.id FROM classrooms c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));
