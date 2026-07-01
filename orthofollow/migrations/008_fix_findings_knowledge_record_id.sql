-- Migration 008: knowledge_record_id stores the in-code knowledge registry slug
-- (e.g. 'kr-facial-vertical-symmetry'), not a row id from knw.knowledge_records
-- (that table is never seeded/used by the current CKL engine). The UUID type +
-- FK made every finding insert fail with "invalid input syntax for type uuid".

ALTER TABLE knw.findings
  DROP CONSTRAINT IF EXISTS findings_knowledge_record_id_fkey;

ALTER TABLE knw.findings
  ALTER COLUMN knowledge_record_id TYPE TEXT;

ALTER TABLE comm.communicated_findings
  ALTER COLUMN knowledge_record_id TYPE TEXT;
