-- Row-Level Security is applied only to content tables the real data surface.
-- Tenant-management tables (organizations, organization_members, projects,
-- project_members, invites, rbac_audit_log) rely on explicit app-level filters
-- in the routes. This keeps /api/users/me and invite-accept flows simple
-- (they need to read across org boundaries) without weakening the content-leak
-- guarantee.
--
-- current_setting(name, true) returns NULL if the session variable is unset,
-- so an unconfigured connection fails the USING check and gets zero rows.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'test_suites','test_cases','tags','bugs','scheduled_test_suites',
    'scheduled_test_cases','ai_generation_sessions','bot_connections',
    'knowledge_sources'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY project_scope ON %I FOR ALL USING (project_id = current_setting(''app.project_id'', true)::uuid) WITH CHECK (project_id = current_setting(''app.project_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;
