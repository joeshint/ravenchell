import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs every migration + rls_test.sql against an in-memory Postgres (PGlite)
// with a minimal Supabase stub. Usage: node supabase/tests/local/run.mjs
// Requires the dev dependency @electric-sql/pglite.
const root = process.argv[2] ?? fileURLToPath(new URL('../../../', import.meta.url));
const db = new PGlite({ extensions: { pg_trgm } });
const notices = [];
const run = async (label, sql) => {
  try {
    await db.exec(sql);
    console.log('applied', label);
  } catch (e) {
    console.error(`FAILED in ${label}: ${e.message}`);
    if (e.position) {
      const pos = Number(e.position);
      console.error('...' + sql.slice(Math.max(0, pos - 300), pos) + ' <<<HERE>>> ' + sql.slice(pos, pos + 120));
    }
    if (e.where) console.error('where:', e.where);
    process.exitCode = 1;
    throw e;
  }
};

await run('stub', readFileSync(new URL('./supabase_stub.sql', import.meta.url), 'utf8'));
const migDir = join(root, 'supabase', 'migrations');
for (const f of readdirSync(migDir).sort()) await run(f, readFileSync(join(migDir, f), 'utf8'));
// idempotency of reference data
await run('0007 again', readFileSync(join(migDir, '0007_reference_data.sql'), 'utf8'));

const counts = await db.query(`select (select count(*) from public.item_categories) cats,
  (select count(*) from public.campuses) campuses, (select count(*) from public.campus_locations) locs,
  (select count(*) from public.system_settings) settings`);
console.log('reference data:', counts.rows[0]);

db.onNotice?.((n) => notices.push(n.message));
const testSql = readFileSync(join(root, 'supabase', 'tests', 'rls_test.sql'), 'utf8');
try {
  const results = await db.exec(testSql, { onNotice: (n) => notices.push(n.message) });
  for (const n of notices) console.log('  ' + n);
  const last = results.filter((r) => r.rows?.length).at(-1);
  console.log('final:', last?.rows);
} catch (e) {
  for (const n of notices) console.log('  ' + n);
  console.error('TEST RUN ERROR:', e.message, e.where ?? '');
  process.exitCode = 1;
}
