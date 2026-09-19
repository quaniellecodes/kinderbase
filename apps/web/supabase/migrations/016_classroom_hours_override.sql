-- Per-classroom hours/days override. NULL on all three = inherit the center's
-- hours (centers.open_slot / close_slot / operating_days). Slot indices are the
-- same 30-min scheme as elsewhere (0..48). Override is all-or-nothing so the
-- "inherit vs custom" toggle stays simple.

ALTER TABLE classrooms
  ADD COLUMN open_slot      smallint,
  ADD COLUMN close_slot     smallint,
  ADD COLUMN operating_days smallint[];

ALTER TABLE classrooms
  ADD CONSTRAINT classrooms_hours_all_or_none CHECK (
    (open_slot IS NULL AND close_slot IS NULL AND operating_days IS NULL)
    OR (open_slot IS NOT NULL AND close_slot IS NOT NULL AND operating_days IS NOT NULL)
  ),
  ADD CONSTRAINT classrooms_slot_range CHECK (
    open_slot IS NULL
    OR (open_slot >= 0 AND close_slot <= 48 AND open_slot < close_slot)
  ),
  ADD CONSTRAINT classrooms_operating_days CHECK (
    operating_days IS NULL OR operating_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
  );
