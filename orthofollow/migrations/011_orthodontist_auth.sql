-- Migration 011: allow orthodontists to log in with their own account, so multiple
-- dentists in the clinic can use the app and reports show who actually performed
-- the evaluation, instead of everything being recorded under one fixed name.

ALTER TABLE ca.orthodontists ADD COLUMN password_hash TEXT;

-- Bootstrap: give the clinic's existing fixed account a default password so it can log
-- in right after this migration and use "Cadastrar Dentista" in the app to add
-- colleagues with their own credentials. Works whether or not this row already exists
-- (it's normally created the first time a case is registered).
UPDATE ca.orthodontists SET password_hash = crypt('orthofollow2024', gen_salt('bf'))
WHERE id = '00000000-0000-4000-8000-000000000099';

INSERT INTO ca.orthodontists (id, full_name, email, tenant_id, password_hash)
SELECT '00000000-0000-4000-8000-000000000099', 'Dr. Matheus Tadao Wakasugui',
       '00000000-0000-4000-8000-000000000099@intranet.local',
       '00000000-0000-0000-0000-000000000001', crypt('orthofollow2024', gen_salt('bf'))
WHERE NOT EXISTS (SELECT 1 FROM ca.orthodontists WHERE id = '00000000-0000-4000-8000-000000000099');
