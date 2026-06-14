/**
 * Seeds a project with enough volume to prove the at-scale UI paths:
 * test suites, test cases, and a large number of test runs spread over the
 * last 90 days. Connects via DATABASE_URL (no TLS required locally).
 *
 *   bun run scripts/seed-scale.ts --org <orgId> --project <projectId> \
 *     --runs 200000 --cases 2000 [--user <userId>]
 *
 * If --org/--project are omitted, the script picks the first organization and
 * its first project (and errors if none exist).
 */
import postgres from 'postgres';

const args = new Map<string, string>();
{
  // Skip the bare `--` separator bun/npm insert before forwarded args.
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  for (let i = 0; i < argv.length - 1; i += 2) {
    if (argv[i].startsWith('--')) args.set(argv[i].slice(2), argv[i + 1]);
  }
}

const RUNS = Number(args.get('runs') ?? 200_000);
const CASES = Number(args.get('cases') ?? 2_000);
const SUITES = Number(args.get('suites') ?? 25);
const BATCH = 5_000;

const STATES = ['passed', 'failed', 'errored'] as const;
const LANGS = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'hi-IN'];
const ENVS = ['quiet', 'office', 'street', 'cafe'];
const TYPES = ['web', 'mobile', 'chat', 'voice', 'agent'] as const;

function pickState(): string {
  const roll = Math.random();
  if (roll < 0.85) return STATES[0];
  if (roll < 0.95) return STATES[1];
  return STATES[2];
}

const sql = postgres(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/coglity',
  { max: 4, onnotice: () => {} },
);

async function main() {
  let orgId = args.get('org');
  let projectId = args.get('project');
  let userId = args.get('user') ?? null;

  if (!orgId) {
    const [org] = await sql`select id from organizations order by created_at limit 1`;
    if (!org) throw new Error('No organizations exist; create one through the app first.');
    orgId = org.id as string;
  }
  if (!projectId) {
    const [project] =
      await sql`select id from projects where organization_id = ${orgId} order by created_at limit 1`;
    if (!project) throw new Error(`No projects in org ${orgId}; create one through the app first.`);
    projectId = project.id as string;
  }
  if (!userId) {
    const [user] = await sql`select id from users order by created_at limit 1`;
    userId = (user?.id as string | undefined) ?? null;
  }

  console.log(`Seeding org=${orgId} project=${projectId}: ${SUITES} suites, ${CASES} cases, ${RUNS} runs`);

  // Suites
  const suiteRows = Array.from({ length: SUITES }, (_, i) => ({
    project_id: projectId!,
    name: `Suite ${String(i + 1).padStart(2, '0')} · ${['Billing', 'Onboarding', 'Payments', 'Support', 'Auth'][i % 5]}`,
    description: 'Seeded at-scale verification suite',
    created_by: userId,
  }));
  const suites = await sql`
    insert into test_suites ${sql(suiteRows, 'project_id', 'name', 'description', 'created_by')}
    returning id`;
  const suiteIds = suites.map((s) => s.id as string);

  // Cases (batched)
  const caseIds: string[] = [];
  for (let offset = 0; offset < CASES; offset += BATCH) {
    const n = Math.min(BATCH, CASES - offset);
    const rows = Array.from({ length: n }, (_, i) => ({
      project_id: projectId!,
      test_suite_id: suiteIds[(offset + i) % suiteIds.length],
      title: `TC-${String(offset + i + 1).padStart(6, '0')} · ${['confirm number', 'reset password', 'update payment', 'cancel order', 'escalate to agent'][(offset + i) % 5]}`,
      status: (offset + i) % 7 === 0 ? 'draft' : 'active',
      test_case_type: TYPES[(offset + i) % TYPES.length],
      created_by: userId,
    }));
    const inserted = await sql`
      insert into test_cases ${sql(rows, 'project_id', 'test_suite_id', 'title', 'status', 'test_case_type', 'created_by')}
      returning id`;
    for (const row of inserted) caseIds.push(row.id as string);
    process.stdout.write(`\rcases: ${caseIds.length}/${CASES}`);
  }
  console.log();

  // Runs (batched, spread over 90 days; ~10% share batch ids)
  const now = Date.now();
  const ninetyDays = 90 * 86_400_000;
  let inserted = 0;
  let activeBatch: string | null = null;
  let activeBatchLeft = 0;
  const started = Date.now();
  while (inserted < RUNS) {
    const n = Math.min(BATCH, RUNS - inserted);
    const rows = Array.from({ length: n }, () => {
      if (activeBatchLeft === 0 && Math.random() < 0.03) {
        activeBatch = crypto.randomUUID();
        activeBatchLeft = 3 + Math.floor(Math.random() * 5);
      }
      const batchId = activeBatchLeft > 0 ? activeBatch : null;
      if (activeBatchLeft > 0) activeBatchLeft--;
      const state = pickState();
      // Bias createdAt toward recent days so dashboards have fresh data.
      const age = Math.pow(Math.random(), 1.6) * ninetyDays;
      const createdAt = new Date(now - age);
      const durationMs = 20_000 + Math.floor(Math.random() * 160_000);
      return {
        project_id: projectId!,
        test_case_id: caseIds[Math.floor(Math.random() * caseIds.length)],
        state,
        verdict: state === 'passed' ? 'All checks passed' : 'Mismatch on expected utterance',
        recording_duration_ms: durationMs,
        properties: JSON.stringify({
          total_turns: 4 + Math.floor(Math.random() * 14),
          total_duration_ms: durationMs,
          overall_experience: state === 'passed' ? 7 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 5),
        }),
        language: LANGS[Math.floor(Math.random() * LANGS.length)],
        environment: ENVS[Math.floor(Math.random() * ENVS.length)],
        batch_id: batchId,
        started_at: createdAt,
        finished_at: new Date(createdAt.getTime() + durationMs),
        created_by: userId,
        created_at: createdAt,
      };
    });
    await sql`
      insert into test_runs ${sql(
        rows,
        'project_id',
        'test_case_id',
        'state',
        'verdict',
        'recording_duration_ms',
        'properties',
        'language',
        'environment',
        'batch_id',
        'started_at',
        'finished_at',
        'created_by',
        'created_at',
      )}`;
    inserted += n;
    process.stdout.write(`\rruns: ${inserted}/${RUNS}`);
  }
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await sql`analyze test_runs`;
  await sql`analyze test_cases`;
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
