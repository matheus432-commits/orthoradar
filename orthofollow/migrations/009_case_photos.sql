-- Migration 009: persist uploaded case photos and landmark points so an
-- evaluation in progress survives navigating away / reopening the case,
-- instead of requiring the photos and points to be re-marked from scratch.

CREATE TABLE ca.case_photos (
  case_id       UUID          NOT NULL REFERENCES ca.clinical_cases(id),
  session_label session_label NOT NULL,
  photo_key     TEXT          NOT NULL CHECK (photo_key IN ('frontal','perfil','sorriso','intrabucal')),
  image_data    TEXT          NOT NULL,
  points        JSONB         NOT NULL DEFAULT '{}',
  nat_width     INTEGER,
  nat_height    INTEGER,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, session_label, photo_key)
);

CREATE INDEX idx_case_photos_case ON ca.case_photos (case_id, session_label);
