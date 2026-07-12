-- Migration 004: BC-03 Knowledge (schema knw)

CREATE SCHEMA knw;

CREATE TYPE knw.knowledge_category AS ENUM (
  'FINDING_RULE','TEXT_TEMPLATE','NORMATIVE_REFERENCE',
  'REFERRAL_CRITERIA','SEVERITY_RULE','PATIENT_COMMUNICATION_GUIDE'
);

CREATE TYPE knw.finding_severity AS ENUM (
  'NORMAL','BORDERLINE','MILD','MODERATE','SEVERE','CRITICAL'
);

CREATE TABLE knw.knowledge_records (
  id              UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT                    UNIQUE NOT NULL,
  category        knw.knowledge_category  NOT NULL,
  display_name    TEXT                    NOT NULL,
  current_version TEXT                    NOT NULL DEFAULT '1.0.0',
  formula_deps    JSONB                   NOT NULL DEFAULT '[]',
  content         JSONB                   NOT NULL,
  is_active       BOOLEAN                 NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ             NOT NULL DEFAULT now()
);

CREATE INDEX idx_kr_category    ON knw.knowledge_records (category);
CREATE INDEX idx_kr_active      ON knw.knowledge_records (is_active);
CREATE INDEX idx_kr_content_gin ON knw.knowledge_records USING GIN (content);

CREATE TABLE knw.findings (
  id                        UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                   UUID                  NOT NULL,
  session_label             session_label         NOT NULL,
  knowledge_record_id       UUID                  NOT NULL REFERENCES knw.knowledge_records(id),
  knowledge_record_version  TEXT                  NOT NULL,
  classification            TEXT                  NOT NULL,
  severity                  knw.finding_severity  NOT NULL,
  priority                  SMALLINT              NOT NULL DEFAULT 0,
  input_execution_ids       JSONB                 NOT NULL DEFAULT '[]',
  available_template_ids    JSONB                 NOT NULL DEFAULT '[]',
  referral_required         BOOLEAN               NOT NULL DEFAULT FALSE,
  referral_specialty        TEXT,
  referral_urgency          TEXT,
  resolved_at               TIMESTAMPTZ           NOT NULL DEFAULT now(),
  CONSTRAINT chk_referral CHECK (NOT referral_required OR referral_specialty IS NOT NULL)
);

CREATE INDEX idx_findings_case     ON knw.findings (case_id);
CREATE INDEX idx_findings_session  ON knw.findings (case_id, session_label);
CREATE INDEX idx_findings_severity ON knw.findings (severity);
CREATE INDEX idx_findings_kr       ON knw.findings (knowledge_record_id);
CREATE INDEX idx_findings_referral ON knw.findings (referral_required) WHERE referral_required = TRUE;
