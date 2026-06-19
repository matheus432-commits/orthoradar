-- Migration 006: BC-00 Workflow (schema wf)

CREATE SCHEMA wf;

CREATE TYPE wf.event_status AS ENUM (
  'PENDING','PROCESSING','DELIVERED','FAILED','DEAD_LETTER'
);

CREATE TABLE wf.domain_events (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      TEXT              NOT NULL,
  aggregate_type  TEXT              NOT NULL,
  aggregate_id    UUID              NOT NULL,
  source_bc       TEXT              NOT NULL,
  payload         JSONB             NOT NULL,
  status          wf.event_status   NOT NULL DEFAULT 'PENDING',
  occurred_at     TIMESTAMPTZ       NOT NULL DEFAULT now(),
  dispatched_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,
  retry_count     SMALLINT          NOT NULL DEFAULT 0,
  last_error      TEXT,
  CONSTRAINT chk_retry_count CHECK (retry_count >= 0)
);

CREATE INDEX idx_de_status      ON wf.domain_events (status) WHERE status IN ('PENDING','FAILED');
CREATE INDEX idx_de_aggregate   ON wf.domain_events (aggregate_type, aggregate_id);
CREATE INDEX idx_de_occurred_at ON wf.domain_events (occurred_at);
CREATE INDEX idx_de_event_type  ON wf.domain_events (event_type);

CREATE TYPE wf.job_status AS ENUM ('QUEUED','RUNNING','DONE','FAILED');

CREATE TABLE wf.jobs (
  id           UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         TEXT            NOT NULL,
  payload      JSONB           NOT NULL DEFAULT '{}',
  status       wf.job_status   NOT NULL DEFAULT 'QUEUED',
  attempts     SMALLINT        NOT NULL DEFAULT 0,
  last_error   TEXT,
  enqueued_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_pending ON wf.jobs (enqueued_at) WHERE status IN ('QUEUED','FAILED');

CREATE TYPE wf.workflow_status AS ENUM (
  'NOT_STARTED','IN_PROGRESS','AWAITING_INPUT','COMPLETED','FAILED','CANCELLED'
);

CREATE TABLE wf.workflow_states (
  id            UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID                NOT NULL,
  protocol_id   TEXT                NOT NULL,
  session_label session_label       NOT NULL,
  status        wf.workflow_status  NOT NULL DEFAULT 'NOT_STARTED',
  progress      JSONB               NOT NULL DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),
  CONSTRAINT uq_wf_case_protocol_session UNIQUE (case_id, protocol_id, session_label)
);

CREATE INDEX idx_wf_case   ON wf.workflow_states (case_id);
CREATE INDEX idx_wf_status ON wf.workflow_states (status);

CREATE TABLE wf.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID        NOT NULL,
  actor_type  TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  target_type TEXT        NOT NULL,
  target_id   UUID        NOT NULL,
  before_hash CHAR(64),
  after_hash  CHAR(64),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);

CREATE TABLE wf.audit_logs_2026_h1 PARTITION OF wf.audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-07-01');
CREATE TABLE wf.audit_logs_2026_h2 PARTITION OF wf.audit_logs FOR VALUES FROM ('2026-07-01') TO ('2027-01-01');

CREATE INDEX idx_audit_target   ON wf.audit_logs (target_type, target_id);
CREATE INDEX idx_audit_actor    ON wf.audit_logs (actor_id);
CREATE INDEX idx_audit_occurred ON wf.audit_logs (occurred_at);
