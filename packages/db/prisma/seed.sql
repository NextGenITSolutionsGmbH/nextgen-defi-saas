-- DeFi Tracker SaaS — Production seed (idempotent)
-- Creates 3 test users with password: SeedP@ssw0rd!

INSERT INTO "User" (id, email, "passwordHash", plan, "totpEnabled", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'alice@example.com', '$2b$10$6RIYMQWMJ7vVfbXLGYGY6OMwf96iiWlwjOFPB/sHJY2NQ8.L00Jjm', 'STARTER', false, NOW(), NOW()),
  (gen_random_uuid(), 'bob@example.com',   '$2b$10$6RIYMQWMJ7vVfbXLGYGY6OMwf96iiWlwjOFPB/sHJY2NQ8.L00Jjm', 'PRO',     false, NOW(), NOW()),
  (gen_random_uuid(), 'carol@example.com', '$2b$10$6RIYMQWMJ7vVfbXLGYGY6OMwf96iiWlwjOFPB/sHJY2NQ8.L00Jjm', 'BUSINESS', false, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
