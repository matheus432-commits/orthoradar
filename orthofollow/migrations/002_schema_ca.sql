-- Migration 002: BC-01 Clinical Assessment (schema ca)

CREATE SCHEMA ca;

CREATE TABLE ca.orthodontists (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name   TEXT        NOT NULL,
  cro         TEXT        UNIQUE,
  email       TEXT        UNIQUE NOT NULL,
  tenant_id   UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orthodontists_tenant ON ca.orthodontists (tenant_id);

CREATE TABLE ca.patients (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  given_name      TEXT          NOT NULL,
  family_name     TEXT          NOT NULL,
  birth_date      DATE          NOT NULL,
  biological_sex  biological_sex NOT NULL,
  ethnicity       TEXT,
  tenant_id       UUID          NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_tenant      ON ca.patients (tenant_id);
CREATE INDEX idx_patients_family_name ON ca.patients (family_name);
CREATE INDEX idx_patients_birth_date  ON ca.patients (birth_date);

CREATE TYPE ca.case_status AS ENUM (
  'ACTIVE','TREATMENT','RETENTION','COMPLETED','ARCHIVED','SUSPENDED'
);

CREATE TABLE ca.clinical_cases (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID            NOT NULL REFERENCES ca.patients(id),
  orthodontist_id   UUID            NOT NULL REFERENCES ca.orthodontists(id),
  status            ca.case_status  NOT NULL DEFAULT 'ACTIVE',
  chief_complaint   TEXT,
  metadata          JSONB           NOT NULL DEFAULT '{}',
  opened_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT chk_closed_after_opened CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

CREATE INDEX idx_cases_patient      ON ca.clinical_cases (patient_id);
CREATE INDEX idx_cases_orthodontist ON ca.clinical_cases (orthodontist_id);
CREATE INDEX idx_cases_status       ON ca.clinical_cases (status);

CREATE TABLE ca.session_snapshots (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id      UUID          NOT NULL REFERENCES ca.clinical_cases(id),
  label        session_label NOT NULL,
  session_date DATE          NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_case_label UNIQUE (case_id, label)
);

CREATE INDEX idx_sessions_case ON ca.session_snapshots (case_id);

CREATE TYPE ca.measurement_value_type AS ENUM (
  'SCALAR_MM','SCALAR_DEGREES','SCALAR_PERCENT','SCALAR_RATIO',
  'SCALAR_INDEX','CLASSIFICATION','FLAG_SET','ODONTOGRAM_MAP','FORM_ENTRY'
);

CREATE TABLE ca.measurements (
  id                  UUID                        PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID                        NOT NULL REFERENCES ca.clinical_cases(id),
  session_snapshot_id UUID                        REFERENCES ca.session_snapshots(id),
  analysis_id         TEXT                        NOT NULL,
  protocol_id         TEXT                        NOT NULL,
  value_type          ca.measurement_value_type   NOT NULL,
  numeric_value       NUMERIC(12,4),
  unit                measurement_unit,
  value_payload       JSONB                       NOT NULL,
  recorded_at         TIMESTAMPTZ                 NOT NULL DEFAULT now(),
  recorded_by         UUID                        NOT NULL REFERENCES ca.orthodontists(id),
  superseded_by       UUID                        REFERENCES ca.measurements(id),
  superseded_at       TIMESTAMPTZ,
  supersedes_id       UUID                        REFERENCES ca.measurements(id),
  is_current          BOOLEAN                     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_superseded_consistency CHECK ((superseded_by IS NULL) = (superseded_at IS NULL)),
  CONSTRAINT chk_numeric_has_unit CHECK (numeric_value IS NULL OR unit IS NOT NULL)
);

CREATE INDEX idx_measurements_case     ON ca.measurements (case_id);
CREATE INDEX idx_measurements_analysis ON ca.measurements (analysis_id);
CREATE INDEX idx_measurements_protocol ON ca.measurements (protocol_id);
CREATE INDEX idx_measurements_current  ON ca.measurements (case_id, analysis_id) WHERE is_current = TRUE;
CREATE INDEX idx_measurements_session  ON ca.measurements (session_snapshot_id);
CREATE INDEX idx_measurements_payload  ON ca.measurements USING GIN (value_payload);

CREATE OR REPLACE FUNCTION ca.prevent_measurement_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.case_id       <> NEW.case_id       OR
     OLD.analysis_id   <> NEW.analysis_id   OR
     OLD.value_type    <> NEW.value_type    OR
     OLD.numeric_value IS DISTINCT FROM NEW.numeric_value OR
     OLD.value_payload <> NEW.value_payload OR
     OLD.recorded_at   <> NEW.recorded_at   OR
     OLD.recorded_by   <> NEW.recorded_by
  THEN
    RAISE EXCEPTION 'measurements: clinical fields are immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_measurements_immutable
  BEFORE UPDATE ON ca.measurements
  FOR EACH ROW EXECUTE FUNCTION ca.prevent_measurement_mutation();

CREATE TYPE ca.protocol_exec_status AS ENUM (
  'PENDING','IN_PROGRESS','COMPLETED','FAILED','CANCELLED'
);

CREATE TABLE ca.protocol_execution_refs (
  id                  UUID                      PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID                      NOT NULL REFERENCES ca.clinical_cases(id),
  protocol_id         TEXT                      NOT NULL,
  session_label       session_label             NOT NULL,
  status              ca.protocol_exec_status   NOT NULL DEFAULT 'PENDING',
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  execution_log_ids   JSONB                     NOT NULL DEFAULT '[]',
  CONSTRAINT uq_case_protocol_session UNIQUE (case_id, protocol_id, session_label)
);

CREATE INDEX idx_proto_refs_case ON ca.protocol_execution_refs (case_id);
