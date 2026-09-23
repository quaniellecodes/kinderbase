-- Mobile Classroom logging (docs/sessions/02-CLASSROOM.md §3). `child_updates` is
-- our activity_posts. `covering` marks posts made by an admin covering a room
-- (never counted toward any teacher score); `goal_codes` tags ELOF goals on
-- voice observations. Additive.
ALTER TABLE child_updates
  ADD COLUMN covering   boolean NOT NULL DEFAULT false,
  ADD COLUMN goal_codes text[]  NOT NULL DEFAULT '{}';
