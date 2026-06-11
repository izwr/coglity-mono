-- entity_tags is polymorphic (entity_id points at test_suites/test_cases/bugs/
-- scheduled_test_suites depending on entity_type) so it cannot carry a foreign key on
-- entity_id. Without one, deleting an entity especially via a CASCADE (e.g. dropping a
-- project cascades to its suites/cases) leaves orphan tag-link rows behind. These AFTER
-- DELETE triggers clean them up for both direct and cascaded deletes. Idempotent.
CREATE OR REPLACE FUNCTION delete_entity_tags() RETURNS trigger AS $$
BEGIN
  DELETE FROM entity_tags WHERE entity_id = OLD.id AND entity_type = TG_ARGV[0];
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_test_suites_entity_tags ON test_suites;--> statement-breakpoint
CREATE TRIGGER trg_test_suites_entity_tags AFTER DELETE ON test_suites
  FOR EACH ROW EXECUTE FUNCTION delete_entity_tags('test_suite');--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_test_cases_entity_tags ON test_cases;--> statement-breakpoint
CREATE TRIGGER trg_test_cases_entity_tags AFTER DELETE ON test_cases
  FOR EACH ROW EXECUTE FUNCTION delete_entity_tags('test_case');--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_bugs_entity_tags ON bugs;--> statement-breakpoint
CREATE TRIGGER trg_bugs_entity_tags AFTER DELETE ON bugs
  FOR EACH ROW EXECUTE FUNCTION delete_entity_tags('bug');--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_scheduled_test_suites_entity_tags ON scheduled_test_suites;--> statement-breakpoint
CREATE TRIGGER trg_scheduled_test_suites_entity_tags AFTER DELETE ON scheduled_test_suites
  FOR EACH ROW EXECUTE FUNCTION delete_entity_tags('scheduled_test_suite');
