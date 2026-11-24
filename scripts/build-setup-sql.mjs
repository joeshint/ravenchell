/**
 * Concatenates supabase/migrations/*.sql (in order) into supabase/setup_all.sql
 * so the whole schema can be pasted into the Supabase SQL editor in one go.
 * The migrations folder stays the source of truth — re-run after changing it:
 *   npm run build:sql
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const parts = [
  '-- =============================================================================',
  '-- setup_all.sql — GENERATED FILE, do not edit. Source: supabase/migrations/*.sql',
  '-- Regenerate with: npm run build:sql',
  '--',
  '-- Paste this whole file into Supabase → SQL Editor → New query → Run, on a NEW,',
  '-- EMPTY project. It is not meant to be run twice on the same database.',
  `-- Contains: ${files.join(', ')}`,
  '-- =============================================================================',
  '',
];
for (const f of files) {
  parts.push(`\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${f}\n`);
  parts.push(readFileSync(join(dir, f), 'utf8'));
}
writeFileSync(join(root, 'supabase', 'setup_all.sql'), parts.join('\n'));
console.log(`Wrote supabase/setup_all.sql from ${files.length} migrations.`);
