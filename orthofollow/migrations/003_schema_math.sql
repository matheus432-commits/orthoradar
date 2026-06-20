-- Migration 003: BC-02 Mathematics (schema math)

CREATE SCHEMA math;

CREATE TYPE math.formula_status AS ENUM (
  'DRAFT','REVIEW','ACTIVE','DEPRECATED','SUPERSEDED'
);

CREATE TYPE math.formula_category AS ENUM (
  'LINEAR_MEASUREMENT','ANGULAR_MEASUREMENT','RATIO_INDEX',
  'CLASSIFICATION_RULE','COMPOSITE_SCORE','NORMATIVE_LOOKUP',
  'BOOLEAN_FLAG','DELTA_CHANGE','WEIGHTED_AGGREGATE','CONDITIONAL_BRANCH',
  'SET_OPERATION','THRESHOLD_COMPARISON','REGRESSION_MODEL','LOOKUP_TABLE'
);

CREATE TABLE math.formula_records (
  id              UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT                    UNIQUE NOT NULL,
  display_name    TEXT                    NOT NULL,
  category        math.formula_category   NOT NULL,
  status          math.formula_status     NOT NULL DEFAULT 'DRAFT',
  current_version TEXT                    NOT NULL DEFAULT '1.0.0',
  depends_on      JSONB                   NOT NULL DEFAULT '[]',
  math_spec       JSONB                   NOT NULL,
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),
  CONSTRAINT chk_slug_format CHECK (slug ~ '^[a-z][a-z0-9_\-]*$')
);

CREATE INDEX idx_formula_slug     ON math.formula_records (slug);
CREATE INDEX idx_formula_status   ON math.formula_records (status);
CREATE INDEX idx_formula_category ON math.formula_records (category);
CREATE INDEX idx_formula_depends  ON math.formula_records USING GIN (depends_on);

CREATE OR REPLACE FUNCTION math.prevent_slug_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.slug <> NEW.slug THEN
    RAISE EXCEPTION 'formula_records: slug is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_formula_slug_immutable
  BEFORE UPDATE ON math.formula_records
  FOR EACH ROW EXECUTE FUNCTION math.prevent_slug_change();

CREATE TABLE math.formula_versions (
  id                UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  formula_record_id UUID                  NOT NULL REFERENCES math.formula_records(id),
  version           TEXT                  NOT NULL,
  status            math.formula_status   NOT NULL DEFAULT 'DRAFT',
  changelog         TEXT,
  spec_snapshot     JSONB                 NOT NULL,
  golden_dataset    JSONB                 NOT NULL DEFAULT '[]',
  published_at      TIMESTAMPTZ,
  deprecated_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ           NOT NULL DEFAULT now(),
  CONSTRAINT uq_formula_version UNIQUE (formula_record_id, version)
);

CREATE INDEX idx_fversion_record ON math.formula_versions (formula_record_id);
CREATE INDEX idx_fversion_status ON math.formula_versions (status);

CREATE OR REPLACE FUNCTION math.prevent_active_version_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'ACTIVE' THEN
    IF OLD.spec_snapshot::text <> NEW.spec_snapshot::text OR
       OLD.golden_dataset::text <> NEW.golden_dataset::text THEN
      RAISE EXCEPTION 'formula_versions: spec of ACTIVE version is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fversion_immutable
  BEFORE UPDATE ON math.formula_versions
  FOR EACH ROW EXECUTE FUNCTION math.prevent_active_version_mutation();

CREATE TYPE math.execution_status AS ENUM (
  'SUCCESS','PARTIAL_SUCCESS','FAILURE','PRECONDITION_FAILED'
);

CREATE TABLE math.execution_logs (
  id                  UUID                    NOT NULL DEFAULT uuid_generate_v4(),
  formula_slug        TEXT                    NOT NULL,
  formula_version     TEXT                    NOT NULL,
  case_id             UUID                    NOT NULL,
  session_label       session_label           NOT NULL,
  inputs_hash         CHAR(64)                NOT NULL,
  output_hash         CHAR(64),
  status              math.execution_status   NOT NULL,
  numeric_result      NUMERIC(12,4),
  result_unit         measurement_unit,
  classification      TEXT,
  result_payload      JSONB                   NOT NULL,
  cache_hit           BOOLEAN                 NOT NULL DEFAULT FALSE,
  executed_at         TIMESTAMPTZ             NOT NULL DEFAULT now(),
  CONSTRAINT pk_execution_logs PRIMARY KEY (id, executed_at),
  CONSTRAINT chk_inputs_hash CHECK (inputs_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_output_hash CHECK (output_hash IS NULL OR output_hash ~ '^[0-9a-f]{64}$')
) PARTITION BY RANGE (executed_at);

CREATE TABLE math.execution_logs_2026_01 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE math.execution_logs_2026_02 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE math.execution_logs_2026_03 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE math.execution_logs_2026_04 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE math.execution_logs_2026_05 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE math.execution_logs_2026_06 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE math.execution_logs_2026_07 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE math.execution_logs_2026_08 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE math.execution_logs_2026_09 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE math.execution_logs_2026_10 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE math.execution_logs_2026_11 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE math.execution_logs_2026_12 PARTITION OF math.execution_logs FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX idx_execlog_case        ON math.execution_logs (case_id);
CREATE INDEX idx_execlog_inputs_hash ON math.execution_logs (inputs_hash);
CREATE INDEX idx_execlog_executed_at ON math.execution_logs (executed_at);

CREATE OR REPLACE FUNCTION math.deny_execlog_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'execution_logs is append-only: % is forbidden', TG_OP;
END;
$$;

CREATE TRIGGER trg_execlog_no_update BEFORE UPDATE ON math.execution_logs FOR EACH ROW EXECUTE FUNCTION math.deny_execlog_mutation();
CREATE TRIGGER trg_execlog_no_delete BEFORE DELETE ON math.execution_logs FOR EACH ROW EXECUTE FUNCTION math.deny_execlog_mutation();

CREATE TABLE math.execution_cache (
  inputs_hash     CHAR(64)          NOT NULL,
  formula_slug    TEXT              NOT NULL,
  formula_version TEXT              NOT NULL,
  numeric_result  NUMERIC(12,4),
  result_unit     measurement_unit,
  classification  TEXT,
  result_payload  JSONB             NOT NULL,
  cached_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  CONSTRAINT pk_exec_cache PRIMARY KEY (inputs_hash, formula_slug),
  CONSTRAINT chk_cache_hash CHECK (inputs_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_cache_slug    ON math.execution_cache (formula_slug);
CREATE INDEX idx_cache_expires ON math.execution_cache (expires_at) WHERE expires_at IS NOT NULL;
