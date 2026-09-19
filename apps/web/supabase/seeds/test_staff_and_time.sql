-- Test data: 20 staff members + 30 days of clock-in/out history
-- Run AFTER migrations 001–010
-- public.users.id must match auth.users.id — this seed inserts both

DO $$
DECLARE
  center1_id uuid;
  center2_id uuid;

  u1  uuid := gen_random_uuid();
  u2  uuid := gen_random_uuid();
  u3  uuid := gen_random_uuid();
  u4  uuid := gen_random_uuid();
  u5  uuid := gen_random_uuid();
  u6  uuid := gen_random_uuid();
  u7  uuid := gen_random_uuid();
  u8  uuid := gen_random_uuid();
  u9  uuid := gen_random_uuid();
  u10 uuid := gen_random_uuid();
  u11 uuid := gen_random_uuid();
  u12 uuid := gen_random_uuid();
  u13 uuid := gen_random_uuid();
  u14 uuid := gen_random_uuid();
  u15 uuid := gen_random_uuid();
  u16 uuid := gen_random_uuid();
  u17 uuid := gen_random_uuid();
  u18 uuid := gen_random_uuid();
  u19 uuid := gen_random_uuid();
  u20 uuid := gen_random_uuid();

  work_day  date;
  clock_in  timestamptz;
  clock_out timestamptz;
  staff_ids  uuid[];
  staff_ids2 uuid[];
  sid uuid;
BEGIN
  SELECT id INTO center1_id FROM centers ORDER BY created_at LIMIT 1;
  SELECT id INTO center2_id FROM centers ORDER BY created_at LIMIT 1 OFFSET 1;
  IF center2_id IS NULL THEN center2_id := center1_id; END IF;

  -- ── 1. Insert auth.users stubs (minimum required fields) ─────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES
    (u1,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aaliyah.washington@test.kb',  '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u2,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'brandon.hayes@test.kb',        '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u3,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carla.mendez@test.kb',         '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u4,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'darius.johnson@test.kb',       '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u5,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'elena.brooks@test.kb',         '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u6,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'felix.nguyen@test.kb',         '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u7,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grace.campbell@test.kb',       '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u8,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hector.rivera@test.kb',        '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u9,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'imani.scott@test.kb',          '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u10, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james.kim@test.kb',            '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u11, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kendra.thomas@test.kb',        '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u12, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luis.garcia@test.kb',          '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u13, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'monique.davis@test.kb',        '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u14, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noah.wilson@test.kb',          '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u15, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olivia.martin@test.kb',        '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u16, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patrick.robinson@test.kb',     '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u17, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quinn.anderson@test.kb',       '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u18, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rosa.clark@test.kb',           '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u19, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'samuel.lewis@test.kb',         '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (u20, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tanya.walker@test.kb',         '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Insert public.users ────────────────────────────────────────────
  INSERT INTO users (id, email, full_name, role, kiosk_pin) VALUES
    (u1,  'aaliyah.washington@test.kb',  'Aaliyah Washington',  'staff', '1001'),
    (u2,  'brandon.hayes@test.kb',       'Brandon Hayes',       'staff', '1002'),
    (u3,  'carla.mendez@test.kb',        'Carla Mendez',        'staff', '1003'),
    (u4,  'darius.johnson@test.kb',      'Darius Johnson',      'staff', '1004'),
    (u5,  'elena.brooks@test.kb',        'Elena Brooks',        'staff', '1005'),
    (u6,  'felix.nguyen@test.kb',        'Felix Nguyen',        'staff', '1006'),
    (u7,  'grace.campbell@test.kb',      'Grace Campbell',      'staff', '1007'),
    (u8,  'hector.rivera@test.kb',       'Hector Rivera',       'staff', '1008'),
    (u9,  'imani.scott@test.kb',         'Imani Scott',         'staff', '1009'),
    (u10, 'james.kim@test.kb',           'James Kim',           'staff', '1010'),
    (u11, 'kendra.thomas@test.kb',       'Kendra Thomas',       'staff', '1011'),
    (u12, 'luis.garcia@test.kb',         'Luis Garcia',         'staff', '1012'),
    (u13, 'monique.davis@test.kb',       'Monique Davis',       'staff', '1013'),
    (u14, 'noah.wilson@test.kb',         'Noah Wilson',         'staff', '1014'),
    (u15, 'olivia.martin@test.kb',       'Olivia Martin',       'staff', '1015'),
    (u16, 'patrick.robinson@test.kb',    'Patrick Robinson',    'staff', '1016'),
    (u17, 'quinn.anderson@test.kb',      'Quinn Anderson',      'staff', '1017'),
    (u18, 'rosa.clark@test.kb',          'Rosa Clark',          'staff', '1018'),
    (u19, 'samuel.lewis@test.kb',        'Samuel Lewis',        'staff', '1019'),
    (u20, 'tanya.walker@test.kb',        'Tanya Walker',        'staff', '1020')
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. Assign to centers ──────────────────────────────────────────────
  INSERT INTO center_memberships (user_id, center_id, role) VALUES
    (u1,  center1_id, 'lead_teacher'),
    (u2,  center1_id, 'assistant_teacher'),
    (u3,  center1_id, 'lead_teacher'),
    (u4,  center1_id, 'aide'),
    (u5,  center1_id, 'lead_teacher'),
    (u6,  center1_id, 'assistant_teacher'),
    (u7,  center1_id, 'aide'),
    (u8,  center1_id, 'lead_teacher'),
    (u9,  center1_id, 'assistant_teacher'),
    (u10, center1_id, 'substitute'),
    (u11, center1_id, 'aide'),
    (u12, center1_id, 'lead_teacher'),
    (u13, center2_id, 'lead_teacher'),
    (u14, center2_id, 'assistant_teacher'),
    (u15, center2_id, 'lead_teacher'),
    (u16, center2_id, 'aide'),
    (u17, center2_id, 'assistant_teacher'),
    (u18, center2_id, 'lead_teacher'),
    (u19, center2_id, 'aide'),
    (u20, center2_id, 'substitute'),
    (u5,  center2_id, 'lead_teacher'),
    (u9,  center2_id, 'assistant_teacher')
  ON CONFLICT (user_id, center_id) DO NOTHING;

  -- ── 4. Generate 30 days of time entries ──────────────────────────────
  staff_ids  := ARRAY[u1,u2,u3,u4,u5,u6,u7,u8,u9,u10,u11,u12];
  staff_ids2 := ARRAY[u13,u14,u15,u16,u17,u18,u19,u20,u5,u9];

  FOR work_day IN
    SELECT d::date
    FROM generate_series(
      current_date - interval '30 days',
      current_date - interval '1 day',
      interval '1 day'
    ) AS d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
  LOOP
    FOREACH sid IN ARRAY staff_ids LOOP
      IF random() < 0.85 THEN
        clock_in  := (work_day::timestamptz AT TIME ZONE 'America/New_York')
                     + interval '7 hours' + (random() * interval '90 minutes');
        clock_out := clock_in + interval '6 hours 30 minutes' + (random() * interval '2 hours 30 minutes');
        INSERT INTO time_entries (user_id, center_id, clocked_in_at, clocked_out_at)
        VALUES (sid, center1_id, clock_in, clock_out)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    FOREACH sid IN ARRAY staff_ids2 LOOP
      IF random() < 0.85 THEN
        clock_in  := (work_day::timestamptz AT TIME ZONE 'America/New_York')
                     + interval '7 hours' + (random() * interval '90 minutes');
        clock_out := clock_in + interval '6 hours 30 minutes' + (random() * interval '2 hours 30 minutes');
        INSERT INTO time_entries (user_id, center_id, clocked_in_at, clocked_out_at)
        VALUES (sid, center2_id, clock_in, clock_out)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Two staff currently clocked in with no clock_out
  INSERT INTO time_entries (user_id, center_id, clocked_in_at) VALUES
    (u1, center1_id, (current_date::timestamptz AT TIME ZONE 'America/New_York') + interval '7 hours 45 minutes'),
    (u3, center1_id, (current_date::timestamptz AT TIME ZONE 'America/New_York') + interval '8 hours 10 minutes')
  ON CONFLICT DO NOTHING;

END $$;
