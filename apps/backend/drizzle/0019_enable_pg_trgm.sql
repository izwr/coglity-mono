-- Trigram extension so ILIKE '%term%' searches on titles can use GIN indexes.
-- Must run before 0020 which creates the *_title_trgm_idx indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
