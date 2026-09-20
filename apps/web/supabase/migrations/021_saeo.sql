-- SAEO: framework (Head Start ELOF, framework-agnostic schema), assessment
-- checkpoints, screenings, evaluation/referrals, and observations. Framework
-- reference tables are read-only to authenticated users (seeded via service
-- role). Child-scoped tables reach the center via children.center_id.

CREATE TYPE elof_view AS ENUM ('infant_toddler', 'preschool');
CREATE TYPE checkpoint_status AS ENUM ('draft', 'submitted', 'locked');
CREATE TYPE referral_stage AS ENUM (
  'concern_raised', 'parent_consent_pending', 'referred', 'input_submitted',
  'evaluation_scheduled', 'eligible', 'not_eligible', 'services_active', 'closed'
);

-- ── Framework content (reference data) ──────────────────────────────────────
CREATE TABLE frameworks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  publisher    text,
  version      text,
  is_licensed  boolean NOT NULL DEFAULT false,
  is_system    boolean NOT NULL DEFAULT true,
  center_id    uuid REFERENCES centers(id)
);
CREATE TABLE framework_domains (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  view         elof_view NOT NULL,
  code         text NOT NULL,
  name         text NOT NULL,
  sort_order   int NOT NULL DEFAULT 0
);
CREATE TABLE framework_subdomains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id  uuid NOT NULL REFERENCES framework_domains(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE framework_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain_id uuid NOT NULL REFERENCES framework_subdomains(id) ON DELETE CASCADE,
  code         text NOT NULL,
  goal_text    text,   -- NULL when framework is_licensed
  sort_order   int NOT NULL DEFAULT 0
);
CREATE TABLE goal_progressions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id             uuid NOT NULL REFERENCES framework_goals(id) ON DELETE CASCADE,
  age_band_min_months int NOT NULL,
  age_band_max_months int NOT NULL,
  descriptor          text,
  indicators          text[],
  sort_order          int NOT NULL DEFAULT 0
);
CREATE TABLE goal_crosswalks (
  goal_id       uuid NOT NULL REFERENCES framework_goals(id) ON DELETE CASCADE,
  standard_set  text NOT NULL,
  standard_code text NOT NULL,
  PRIMARY KEY (goal_id, standard_set, standard_code)
);
CREATE TABLE rating_levels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id    uuid REFERENCES centers(id),
  level_number int NOT NULL,
  label        text NOT NULL,
  color        text NOT NULL,
  sort_order   int NOT NULL
);

-- ── Assessment ──────────────────────────────────────────────────────────────
CREATE TABLE checkpoints (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id    uuid NOT NULL REFERENCES centers(id),
  framework_id uuid NOT NULL REFERENCES frameworks(id),
  view         elof_view NOT NULL,
  period_label text NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  status       checkpoint_status NOT NULL DEFAULT 'draft',
  rated_by     uuid REFERENCES users(id),
  submitted_at timestamptz,
  UNIQUE (child_id, period_label)
);
CREATE TABLE checkpoint_ratings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id   uuid NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  goal_id         uuid NOT NULL REFERENCES framework_goals(id),
  rating_level_id uuid REFERENCES rating_levels(id),
  note            text,
  rated_at        timestamptz,
  UNIQUE (checkpoint_id, goal_id)
);

-- ── Observations ────────────────────────────────────────────────────────────
CREATE TABLE observations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  center_id    uuid NOT NULL REFERENCES centers(id),
  observed_by  uuid NOT NULL REFERENCES users(id),
  observed_on  date NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  photo_path   text,
  created_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz
);
CREATE TABLE observation_goals (
  observation_id uuid NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  goal_id        uuid NOT NULL REFERENCES framework_goals(id),
  PRIMARY KEY (observation_id, goal_id)
);

-- ── Screening (results only, insert-only) ───────────────────────────────────
CREATE TABLE screenings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id       uuid NOT NULL REFERENCES centers(id),
  instrument      text NOT NULL,
  interval_label  text,
  result_summary  text NOT NULL,
  outcome         text NOT NULL,   -- pass | refer | rescreen | scheduled
  administered_by uuid REFERENCES users(id),
  administered_on date,
  due_on          date,
  superseded_by   uuid REFERENCES screenings(id) ON DELETE SET NULL
);

-- ── Evaluation / referrals ──────────────────────────────────────────────────
CREATE TABLE referrals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id           uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  center_id          uuid NOT NULL REFERENCES centers(id),
  stage              referral_stage NOT NULL DEFAULT 'concern_raised',
  concern_summary    text NOT NULL,
  raised_by          uuid NOT NULL REFERENCES users(id),
  raised_on          date NOT NULL,
  agency             text,
  is_part_c          boolean NOT NULL,
  parent_consent_on  date,
  referred_on        date,
  evaluation_on      date,
  outcome_note       text,
  plan_type          text,
  plan_start         date,
  plan_review_due    date,
  closed_on          date
);
CREATE TABLE referral_inputs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id     uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  submitted_by    uuid NOT NULL REFERENCES users(id),
  body            text NOT NULL,
  observation_ids uuid[],
  submitted_at    timestamptz DEFAULT now()
);
CREATE TABLE plan_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id   uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  goal_text     text NOT NULL,
  strategy      text,
  progress_note text,
  reviewed_on   date
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE frameworks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_domains   ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_subdomains ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_goals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progressions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_crosswalks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_levels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_ratings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_goals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_inputs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_goals          ENABLE ROW LEVEL SECURITY;

-- Framework reference data: readable by any authenticated user; seeded via service role.
CREATE POLICY "frameworks_read" ON frameworks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "framework_domains_read" ON framework_domains FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "framework_subdomains_read" ON framework_subdomains FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "framework_goals_read" ON framework_goals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "goal_progressions_read" ON goal_progressions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "goal_crosswalks_read" ON goal_crosswalks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "rating_levels_read" ON rating_levels FOR SELECT USING (auth.uid() IS NOT NULL);

-- Helper: child belongs to a center the caller is an active member of.
-- (Inlined per policy.)
CREATE POLICY "checkpoints_via_child" ON checkpoints FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "checkpoint_ratings_via_checkpoint" ON checkpoint_ratings FOR ALL
  USING (checkpoint_id IN (SELECT cp.id FROM checkpoints cp JOIN children c ON c.id = cp.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (checkpoint_id IN (SELECT cp.id FROM checkpoints cp JOIN children c ON c.id = cp.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "observations_via_child" ON observations FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "observation_goals_via_observation" ON observation_goals FOR ALL
  USING (observation_id IN (SELECT o.id FROM observations o JOIN children c ON c.id = o.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (observation_id IN (SELECT o.id FROM observations o JOIN children c ON c.id = o.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "referrals_via_child" ON referrals FOR ALL
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "referral_inputs_via_referral" ON referral_inputs FOR ALL
  USING (referral_id IN (SELECT r.id FROM referrals r JOIN children c ON c.id = r.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (referral_id IN (SELECT r.id FROM referrals r JOIN children c ON c.id = r.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

CREATE POLICY "plan_goals_via_referral" ON plan_goals FOR ALL
  USING (referral_id IN (SELECT r.id FROM referrals r JOIN children c ON c.id = r.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL))
  WITH CHECK (referral_id IN (SELECT r.id FROM referrals r JOIN children c ON c.id = r.child_id JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));

-- Screenings: SELECT for center members; INSERT for director/admin only; no UPDATE/DELETE.
CREATE POLICY "screenings_read" ON screenings FOR SELECT
  USING (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.left_at IS NULL));
CREATE POLICY "screenings_insert_admin" ON screenings FOR INSERT
  WITH CHECK (child_id IN (SELECT c.id FROM children c JOIN center_memberships cm ON cm.center_id = c.center_id WHERE cm.user_id = auth.uid() AND cm.role IN ('director', 'admin') AND cm.left_at IS NULL));
