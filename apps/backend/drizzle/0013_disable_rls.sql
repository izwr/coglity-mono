-- RLS proved operationally heavy once we needed multi-project reads (filter UI
-- across N projects at once). The app-level filters in every route plus the
-- explicit WHERE project_id = :pid / project_id IN (:pids) remain the source
-- of scoping truth. Drop RLS here so future single-app-user queries aren't
-- fighting policies.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'test_suites','test_cases','tags','bugs','scheduled_test_suites',
    'scheduled_test_cases','ai_generation_sessions','bot_connections',
    'knowledge_sources'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS project_scope ON %I', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
