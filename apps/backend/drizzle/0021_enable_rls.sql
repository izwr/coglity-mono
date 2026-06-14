-- Custom SQL migration file, put your code below! --

-- Enable RLS
ALTER TABLE "ai_generation_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bot_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bugs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_test_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_test_suites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_suites" ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY project_isolation_policy ON "ai_generation_sessions" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "bot_connections" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "bugs" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "knowledge_sources" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "scheduled_test_cases" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "scheduled_test_suites" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "tags" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "test_cases" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "test_runs" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);
CREATE POLICY project_isolation_policy ON "test_suites" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.bypass_rls', true) = 'on' OR project_id = current_setting('app.current_project_id', true)::uuid);