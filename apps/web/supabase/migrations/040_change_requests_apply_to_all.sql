-- Let a parent choose, per request, whether a family-level change (guardian contact,
-- an authorized pickup) applies to ALL their children or just the active one — a mom
-- with children from different households may want to authorize a pickup for only one
-- child. Default false (this child only); the parent opts in via a checkbox.
ALTER TABLE change_requests ADD COLUMN apply_to_all boolean NOT NULL DEFAULT false;
