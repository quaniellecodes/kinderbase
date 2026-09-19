-- Functional Auto/Manual ratio mode per classroom. Both NULL = Auto (COMAR
-- default from the staffing engine). Both set = Manual override for this room.
-- All-or-none so the mode is unambiguous.

ALTER TABLE classrooms
  ADD COLUMN ratio_children_per_staff smallint,
  ADD COLUMN ratio_max_group          smallint;

ALTER TABLE classrooms
  ADD CONSTRAINT classrooms_ratio_all_or_none CHECK (
    (ratio_children_per_staff IS NULL AND ratio_max_group IS NULL)
    OR (ratio_children_per_staff IS NOT NULL AND ratio_max_group IS NOT NULL)
  ),
  ADD CONSTRAINT classrooms_ratio_positive CHECK (
    (ratio_children_per_staff IS NULL OR ratio_children_per_staff > 0)
    AND (ratio_max_group IS NULL OR ratio_max_group > 0)
  );
