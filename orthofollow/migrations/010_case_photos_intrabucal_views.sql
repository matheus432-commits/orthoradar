-- Migration 010: allow the 4 additional intrabucal photo views (maxila,
-- mandíbula, mordida lateral direita/esquerda) alongside the existing
-- frontal/perfil/sorriso/intrabucal keys.

ALTER TABLE ca.case_photos DROP CONSTRAINT case_photos_photo_key_check;

ALTER TABLE ca.case_photos ADD CONSTRAINT case_photos_photo_key_check
  CHECK (photo_key IN (
    'frontal','perfil','sorriso','intrabucal',
    'intrabucalMaxila','intrabucalMandibula','intrabucalLatD','intrabucalLatE'
  ));
