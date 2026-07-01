-- Migration 005: BC-04 Communication (schema comm)

CREATE SCHEMA comm;

CREATE TYPE comm.report_type AS ENUM (
  'INITIAL_ASSESSMENT','PROGRESS','COMPARATIVE',
  'TREATMENT_PLAN','REFERRAL','FULL_PROTOCOL'
);

CREATE TYPE comm.report_status AS ENUM (
  'DRAFT','GENERATING','READY','APPROVED','DELIVERED','ARCHIVED'
);

CREATE TYPE comm.version_status AS ENUM (
  'DRAFT','PENDING_APPROVAL','APPROVED','SUPERSEDED'
);

CREATE TABLE comm.reports (
  id          UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     UUID                NOT NULL,
  type        comm.report_type    NOT NULL,
  status      comm.report_status  NOT NULL DEFAULT 'DRAFT',
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_case   ON comm.reports (case_id);
CREATE INDEX idx_reports_status ON comm.reports (status);

CREATE TABLE comm.report_versions (
  id                UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id         UUID                    NOT NULL REFERENCES comm.reports(id),
  version_number    SMALLINT                NOT NULL,
  status            comm.version_status     NOT NULL DEFAULT 'DRAFT',
  content_snapshot  JSONB                   NOT NULL,
  content_hash      CHAR(64)                NOT NULL,
  pdf_storage_key   TEXT,
  pdf_generated_at  TIMESTAMPTZ,
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  CONSTRAINT uq_report_version   UNIQUE (report_id, version_number),
  CONSTRAINT chk_content_hash    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_approved_fields CHECK (approved_at IS NULL OR approved_by IS NOT NULL)
);

CREATE INDEX idx_rv_report ON comm.report_versions (report_id);
CREATE INDEX idx_rv_status ON comm.report_versions (status);

CREATE OR REPLACE FUNCTION comm.prevent_approved_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'APPROVED' THEN
    IF OLD.content_snapshot::text <> NEW.content_snapshot::text OR
       OLD.content_hash            <> NEW.content_hash THEN
      RAISE EXCEPTION 'report_versions: content of APPROVED version is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rv_immutable
  BEFORE UPDATE ON comm.report_versions
  FOR EACH ROW EXECUTE FUNCTION comm.prevent_approved_mutation();

CREATE TABLE comm.communicated_findings (
  id                        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_version_id         UUID        NOT NULL REFERENCES comm.report_versions(id),
  knw_finding_id            UUID        NOT NULL,
  section_key               TEXT        NOT NULL,
  display_order             SMALLINT    NOT NULL DEFAULT 0,
  template_text             TEXT        NOT NULL,
  final_text                TEXT        NOT NULL,
  knowledge_record_id       UUID        NOT NULL,
  knowledge_record_version  TEXT        NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cf_report_version ON comm.communicated_findings (report_version_id);
CREATE INDEX idx_cf_section        ON comm.communicated_findings (report_version_id, section_key);
