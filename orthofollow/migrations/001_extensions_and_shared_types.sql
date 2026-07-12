-- Migration 001: Extensions e tipos compartilhados (Shared Kernel)
-- Deve ser executada uma única vez antes de todas as outras

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shared Kernel enums
CREATE TYPE session_label AS ENUM ('T0','T1','T2','T3','T4','T5','TN');

CREATE TYPE measurement_unit AS ENUM (
  'MM','DEGREES','PERCENT','RATIO','INDEX','COUNT','BOOLEAN','NONE'
);

CREATE TYPE biological_sex AS ENUM ('M','F','UNSPECIFIED');
