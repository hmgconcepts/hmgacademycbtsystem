-- ============================================================================
-- DEMO / EVALUATION ACCOUNTS — creates one teacher and one admin login
--
--   ⚠  FOR EVALUATION AND TRAINING ONLY. Delete these accounts before using
--      the platform with real students (see the removal block at the bottom).
--
--   Passwords are hashed with pgcrypto (bcrypt) exactly the way Supabase's
--      own sign-up flow stores them, and the on_auth_user_created trigger
--      builds each profile automatically (the teacher lands in "pending"
--      status, so the demo ADMIN can practise the approval workflow).
--
--   Idempotent: re-running updates the passwords/roles in place and never
--      duplicates accounts (ON CONFLICT (email) DO UPDATE).
--
--   Run this in the Supabase SQL Editor AFTER complete-schema.sql.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Demo TEACHER ────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'teacher.demo@hmgacademy.local',
  crypt('DemoTeacher#2026', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"],"role":"teacher"}'::jsonb,
  '{"full_name":"Demo Teacher","email":"teacher.demo@hmgacademy.local","role":"teacher"}'::jsonb
)
ON CONFLICT (email) DO UPDATE
SET encrypted_password = EXCLUDED.encrypted_password, updated_at = NOW();

-- ── Demo ADMIN (first-run owner rights; first REAL account you create on the
--    dashboard will NOT steal ownership because the owner is the earliest
--    created profile — delete this demo account before production) ──────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'admin.demo@hmgacademy.local',
  crypt('DemoAdmin#2026', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  '{"full_name":"Demo Administrator","email":"admin.demo@hmgacademy.local","role":"admin"}'::jsonb
)
ON CONFLICT (email) DO UPDATE
SET encrypted_password = EXCLUDED.encrypted_password, updated_at = NOW();

-- ── Post-verification ───────────────────────────────────────────────────────
--   SELECT email, raw_app_meta_data->>'role' AS role, created_at
--     FROM auth.users WHERE email LIKE '%.demo@hmgacademy.local';
--
--   Sign in on teacher.html / admin.html with:
--     teacher.demo@hmgacademy.local   /  DemoTeacher#2026
--     admin.demo@hmgacademy.local     /  DemoAdmin#2026

-- ── REMOVE DEMO ACCOUNTS (run before production) ────────────────────────────
--   DELETE FROM auth.users WHERE email IN (
--     'teacher.demo@hmgacademy.local',
--     'admin.demo@hmgacademy.local'
--   );
