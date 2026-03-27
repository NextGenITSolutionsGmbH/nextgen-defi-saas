-- DeFi Tracker SaaS — Production seed (idempotent)
-- Creates 3 test users with password: SeedP@ssw0rd!

INSERT INTO "users" (id, email, "password_hash", plan, "totp_enabled", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'alice@example.com', '$2b$10$6RIYMQWMJ7vVfbXLGYGY6OMwf96iiWlwjOFPB/sHJY2NQ8.L00Jjm', 'STARTER', false, NOW(), NOW()),
  (gen_random_uuid(), 'bob@example.com',   '$2b$10$6RIYMQWMJ7vVfbXLGYGY6OMwf96iiWlwjOFPB/sHJY2NQ8.L00Jjm', 'PRO',     false, NOW(), NOW()),
  (gen_random_uuid(), 'carol@example.com', '$2b$10$6RIYMQWMJ7vVfbXLGYGY6OMwf96iiWlwjOFPB/sHJY2NQ8.L00Jjm', 'BUSINESS', false, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
