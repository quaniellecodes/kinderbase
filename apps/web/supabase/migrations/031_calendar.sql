-- Calendar (docs/sessions/08-CALENDAR.md). One calendar per center. Every item
-- belongs to a TYPE, and every type has an AUDIENCE — that is the whole
-- permission model, enforced server-side. Two kinds of item: stored events
-- (this table) and DERIVED events (time off, credential expiries, age
-- transitions, birthdays) computed per-request from data that already exists —
-- never written here. Recurrence columns are reserved but unused for now.

CREATE TABLE calendar_event_types (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      uuid REFERENCES centers(id) ON DELETE CASCADE,  -- NULL = built-in, every center
  key            text NOT NULL,
  label          text NOT NULL,
  colour         text NOT NULL,
  icon           text NOT NULL,                                  -- a single emoji
  is_system      boolean NOT NULL DEFAULT false,                 -- system types cannot be deleted
  is_derived     boolean NOT NULL DEFAULT false,                 -- timeoff / bday_* / licensing / ratio
  visible_admin  boolean NOT NULL DEFAULT true,
  visible_staff  boolean NOT NULL DEFAULT true,
  visible_family boolean NOT NULL DEFAULT false,                 -- no parent app yet
  sort_order     int NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (center_id, key)
);

CREATE TABLE calendar_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  type_id       uuid NOT NULL REFERENCES calendar_event_types(id) ON DELETE CASCADE,
  title         text NOT NULL,
  detail        text,
  starts_on     date NOT NULL,
  ends_on       date,                                            -- NULL = single day
  time_label    text,                                            -- "9:30 AM" — display only
  classroom_ids uuid[] NOT NULL DEFAULT '{}',                    -- empty = whole center
  child_id      uuid REFERENCES children(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id),
  series_id     uuid,                                            -- reserved for recurrence
  rrule         text,                                            -- reserved for recurrence
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX calendar_events_center_date ON calendar_events (center_id, starts_on);

-- Birthday visibility on the child (family-facing default is Q's call later).
ALTER TABLE children ADD COLUMN IF NOT EXISTS birthday_visible boolean NOT NULL DEFAULT true;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE calendar_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events      ENABLE ROW LEVEL SECURITY;

-- Types: read built-ins + your center's; write (custom types) director/admin only.
CREATE POLICY "cal_types_read" ON calendar_event_types FOR SELECT USING (
  is_system
  OR center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL)
);
CREATE POLICY "cal_types_write" ON calendar_event_types FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')));

-- Events: read = any center member; write = director/admin.
CREATE POLICY "cal_events_read" ON calendar_events FOR SELECT USING (
  center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL)
);
CREATE POLICY "cal_events_write" ON calendar_events FOR ALL
  USING (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')))
  WITH CHECK (center_id IN (SELECT center_id FROM center_memberships WHERE user_id = auth.uid() AND left_at IS NULL AND role IN ('director', 'admin')));

-- ── Built-in types (center_id NULL) ──────────────────────────────────────────
INSERT INTO calendar_event_types (center_id, key, label, colour, icon, is_system, is_derived, visible_admin, visible_staff, visible_family, sort_order) VALUES
  (NULL, 'closure',    'Closures & holidays',     '#E24B4A', '🚫', true, false, true, true,  true,  0),
  (NULL, 'trip',       'Field trips',             '#1D9E75', '🚌', true, false, true, true,  true,  1),
  (NULL, 'conference', 'Conferences',             '#185FA5', '🪑', true, false, true, true,  true,  2),
  (NULL, 'event',      'Center events',           '#D35400', '🎉', true, false, true, true,  true,  3),
  (NULL, 'bday_s',     'Student birthdays',       '#7B4FBB', '🎂', true, true,  true, true,  true,  4),
  (NULL, 'bday_t',     'Staff birthdays',         '#534AB7', '🎂', true, false, true, true,  false, 5),
  (NULL, 'timeoff',    'Time off & coverage',     '#EF9F27', '🌴', true, true,  true, false, false, 6),
  (NULL, 'training',   'Training & PD',           '#0F6E56', '📚', true, false, true, true,  false, 7),
  (NULL, 'licensing',  'Licensing & compliance',  '#993C1D', '⚖️', true, true,  true, false, false, 8),
  (NULL, 'drill',      'Drills',                  '#5f5e5a', '🧯', true, false, true, true,  false, 9),
  (NULL, 'ratio',      'Ratio changes',           '#854F0B', '⚠️', true, true,  true, true,  false, 10)
ON CONFLICT (center_id, key) DO NOTHING;
