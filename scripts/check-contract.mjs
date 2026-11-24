/**
 * Frontend ↔ database contract check (no Supabase project needed).
 *
 * 1. Loads the real migrations into an in-memory Postgres (PGlite + Supabase stub).
 * 2. Loads every service module through Vite with `@/lib/supabase` swapped for a
 *    recorder, then calls each service function so every query is recorded.
 * 3. Validates each recorded call against the live catalog:
 *    - tables / columns exist, and the `authenticated` or `anon` role may read them
 *    - embedded relations (`alias:table!fk_name(...)`) use real foreign keys
 *    - filter / order columns exist
 *    - insert / update payload columns exist AND are granted to `authenticated`
 *    - RPCs exist, every argument name matches, and `authenticated` may execute them
 *    - storage buckets exist
 *
 * Usage: npm run test:contract
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const root = fileURLToPath(new URL('..', import.meta.url));

// ----------------------------------------------------------------------------- recorder
const calls = [];
function builder(kind, target) {
  const call = { kind, target, ops: [] };
  calls.push(call);
  const result = { data: [], error: null, count: 0 };
  const proxy = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej);
        return (...args) => {
          call.ops.push({ op: prop, args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}
globalThis.__recorder = {
  from: (table) => builder('table', table),
  rpc: (name, params) => {
    calls.push({ kind: 'rpc', target: name, params: params ?? {} });
    return Promise.resolve({ data: {}, error: null });
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
  storage: {
    from: (bucket) => {
      calls.push({ kind: 'storage', target: bucket });
      return {
        upload: async () => ({ data: {}, error: null }),
        remove: async () => ({ data: {}, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: 'x' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'x' } }),
      };
    },
  },
  auth: new Proxy({}, { get: () => async () => ({ data: { session: null, user: null }, error: null }) }),
};
globalThis.window = { location: { origin: 'http://localhost:5173' } };

const vite = await createServer({
  root,
  configFile: join(root, 'vite.config.js'),
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  plugins: [
    {
      name: 'record-supabase',
      enforce: 'pre',
      load(id) {
        if (id.replace(/\\/g, '/').endsWith('/src/lib/supabase.js')) {
          return 'export const supabase = globalThis.__recorder; export const isSupabaseConfigured = true;';
        }
        return null;
      },
    },
  ],
});
const load = (p) => vite.ssrLoadModule(p);

const items = await load('/src/services/items.service.js');
const claims = await load('/src/services/claims.service.js');
const admin = await load('/src/services/admin.service.js');
const auth = await load('/src/services/auth.service.js');
const lookups = await load('/src/services/lookups.service.js');
const notifications = await load('/src/services/notifications.service.js');
const profile = await load('/src/services/profile.service.js');
const stats = await load('/src/services/stats.service.js');
const storage = await load('/src/services/storage.service.js');

const lostValues = {
  itemName: 'x', categoryId: 'c', description: 'd', date: '2026-01-01', time: '10:00', campusId: 'k', locationId: 'l',
  locationDetails: 'x', identifyingDetails: 'x', contactName: 'x', contactPhone: '0917', contactEmail: 'a@b.c',
};
const foundValues = { ...lostValues, custodyLocationId: 'l', additionalInfo: 'x', custodyNotes: 'x' };
const png = { type: 'image/png', size: 10, name: 'a.png' };

const exercise = [
  () => items.listItems('lost', { q: 'phone', category: 'c', campus: 'k', status: 'approved', from: '2026-01-01', to: '2026-02-01', sort: 'date' }),
  () => items.listItems('found', { q: 'FND-2026-000001', sort: 'oldest' }),
  () => items.getRecentFoundItems(),
  () => items.getRecentLostItems(),
  () => items.getItem('lost', 'id'),
  () => items.getItem('found', 'id'),
  () => items.getItemPrivate('lost', 'id'),
  () => items.getItemPrivate('found', 'id'),
  () => items.getMyReports('lost', 'u'),
  () => items.getMyReports('found', 'u'),
  () => items.getStatusHistory('claim', 'id'),
  () => items.saveReport({ type: 'lost', values: lostValues, image: { file: png }, userId: 'u' }),
  () => items.saveReport({ type: 'lost', id: 'i', values: lostValues, image: { keepExisting: true }, existingPath: 'u/a.png', userId: 'u' }),
  () => items.saveReport({ type: 'found', values: foundValues, image: {}, userId: 'u' }),
  () => items.saveReport({ type: 'found', id: 'i', values: foundValues, image: {}, userId: 'u' }),
  () => items.deleteReport('lost', { id: 'i', image_path: 'u/a.png' }),
  () => items.markLostItemRecovered('i'),
  () => claims.submitClaim({ userId: 'u', foundItemId: 'f', values: { ownershipDescription: 'x', answers: ['a'], lostItemId: 'l', contactPhone: 'p' }, questions: ['q'], evidenceFile: png }),
  () => claims.getMyClaims('u'),
  () => claims.getClaim('c'),
  () => claims.getMyActiveClaimForItem('f', 'u'),
  () => claims.cancelClaim('c'),
  () => admin.listAdminItems('lost', { q: 'LST-2026', status: 'pending', campus: 'k', category: 'c' }),
  () => admin.listAdminItems('found', { q: 'wallet' }),
  () => admin.getAdminItem('found', 'i'),
  () => admin.reviewLostItem('i', 'approve', 'n'),
  () => admin.reviewFoundItem('i', 'verify', { notes: 'n', questions: ['q'], custodyLocationId: 'l' }),
  () => admin.listClaims({ q: 'CLM', status: 'pending' }),
  () => admin.getAdminClaim('c'),
  () => admin.getCompetingClaims('f', 'c'),
  () => admin.updateClaim('c', 'approve', 'n'),
  () => admin.releaseClaim('c', 'Name', 'n'),
  () => admin.listUsers({ q: 'juan', role: 'admin', active: 'active', userType: 'student' }),
  () => admin.setUserRole('u', 'admin'),
  () => admin.setUserActive('u', false),
  () => admin.adminUpdateProfile('u', { full_name: 'x', student_employee_id: 'x', department: 'x', user_type: 'student' }),
  () => admin.saveRow('item_categories', { name: 'x', slug: 'x', description: null, icon: 'Package', sort_order: 1, is_active: true }),
  () => admin.saveRow('item_categories', { is_active: false }, 'id'),
  () => admin.saveRow('campuses', { name: 'x', code: 'X', address: null, sort_order: 1, is_active: true }),
  () => admin.saveRow('campus_locations', { campus_id: 'k', name: 'x', description: null, is_custody_point: true, is_active: true }),
  () => admin.saveRow('campus_locations', { name: 'x', description: null, is_custody_point: true, is_active: true }, 'id'),
  () => admin.deleteRow('item_categories', 'id'),
  () => admin.deleteRow('campuses', 'id'),
  () => admin.deleteRow('campus_locations', 'id'),
  () => admin.countUsage('category_id', 'id'),
  () => admin.countUsage('campus_id', 'id'),
  () => admin.countUsage('location_id', 'id'),
  () => admin.getAnalytics('2026-01-01', '2026-02-01'),
  () => admin.listActivityLogs({ action: 'claim.', entityType: 'claim', from: '2026-01-01', to: '2026-02-01' }),
  () => admin.getAllSettings(),
  () => admin.updateSetting('claim_office', 'x'),
  () => admin.exportRows('lost', { from: '2026-01-01', to: '2026-02-01' }),
  () => admin.exportRows('found'),
  () => admin.exportRows('claims'),
  () => auth.checkRegistrationAvailability('a@cvsu.edu.ph', 'id'),
  () => auth.fetchProfile('u'),
  () => lookups.getCategories(),
  () => lookups.getCampuses(),
  () => lookups.getLocations('k'),
  () => lookups.getPublicSettings(),
  () => notifications.getNotifications({ userId: 'u', unreadOnly: true }),
  () => notifications.getUnreadCount('u'),
  () => notifications.markNotificationRead('n'),
  () => notifications.markAllNotificationsRead('u'),
  () => notifications.deleteNotification('n'),
  () => profile.updateProfile('u', { fullName: 'x', department: 'x', userType: 'student', phone: '', studentEmployeeId: 'x' }),
  () => profile.updateAvatar('u', png, 'u/old.png'),
  () => profile.removeAvatar('u', 'u/old.png'),
  () => profile.getUserDashboard(),
  () => stats.getPublicStats(),
  () => storage.getSignedUrl('claim-evidence', 'u/a.pdf'),
];
for (const fn of exercise) {
  try {
    await fn();
  } catch {
    // Mock results are empty; we only need the recorded calls.
  }
}

// `--self-test`: inject known-bad calls; the run must report every one of them.
const SELF_TEST = process.argv.includes('--self-test');
if (SELF_TEST) {
  const r = globalThis.__recorder;
  r.from('lost_items').select('id, no_such_column');
  r.from('lost_items').select('id, reporter:profiles!not_a_real_fkey(id)');
  r.from('claim_requests').select('id, claimant:profiles(id)'); // ambiguous: three FKs to profiles
  r.from('lost_items').update({ status: 'approved' }); // column not granted
  r.from('profiles').update({ role: 'super_admin' }); // column not granted
  r.from('activity_logs').insert({ action: 'x' }); // no insert grant
  r.from('lost_items').select('id').eq('nope', 1);
  r.rpc('admin_update_claim', { p_claim: 'x' }); // wrong argument name + 2 missing required
  r.rpc('admin_release_claim', { p_claim_id: 'x' }); // missing p_released_to_name
  r.rpc('notify_admins', {}); // internal, not executable + 2 missing required
  r.rpc('does_not_exist', {});
  r.storage.from('no-bucket');
}
const EXPECTED_SELF_TEST_PROBLEMS = 16;
await vite.close();
// PGlite detects a browser via `window`; remove the stub before starting it.
delete globalThis.window;

// ----------------------------------------------------------------------------- database
const db = new PGlite({ extensions: { pg_trgm } });
await db.exec(readFileSync(join(root, 'supabase/tests/local/supabase_stub.sql'), 'utf8'));
const migDir = join(root, 'supabase/migrations');
for (const f of readdirSync(migDir).sort()) await db.exec(readFileSync(join(migDir, f), 'utf8'));

const columns = new Map(); // table -> Set(columns)
for (const r of (await db.query(`select table_name, column_name from information_schema.columns where table_schema = 'public'`)).rows) {
  if (!columns.has(r.table_name)) columns.set(r.table_name, new Set());
  columns.get(r.table_name).add(r.column_name);
}
const fks = (
  await db.query(`
    select c.conname, src.relname as src, dst.relname as dst
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_class dst on dst.oid = c.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    where c.contype = 'f' and n.nspname = 'public'`)
).rows;
const funcs = new Map(
  (
    await db.query(`
      select p.proname, coalesce(p.proargnames, '{}') as args, p.pronargs as nargs, p.pronargdefaults as ndefaults,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`)
  ).rows.map((r) => [r.proname, r]),
);
const buckets = new Set((await db.query('select id from storage.buckets')).rows.map((r) => r.id));

async function colPriv(role, table, column, priv) {
  const { rows } = await db.query(`select has_column_privilege($1, $2, $3, $4) as ok`, [role, `public.${table}`, column, priv]);
  return rows[0].ok;
}

// ----------------------------------------------------------------------------- validation
const problems = [];
const checked = { selects: 0, embeds: 0, filters: 0, writes: 0, rpcs: 0 };
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

/** Split a PostgREST select list on top-level commas. */
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function checkSelect(table, select, where) {
  if (!columns.has(table)) return fail(where, `unknown table "${table}"`);
  for (const part of splitTop(select)) {
    const embed = part.match(/^(?:([a-z_]+):)?([a-z_]+)(?:!([a-z_]+))?\((.*)\)$/s);
    if (embed) {
      const [, , rel, hint, inner] = embed;
      checked.embeds++;
      const candidates = fks.filter(
        (f) => (f.src === table && f.dst === rel) || (f.src === rel && f.dst === table),
      );
      if (!candidates.length) fail(where, `no foreign key between "${table}" and "${rel}"`);
      else if (hint && !candidates.some((f) => f.conname === hint)) fail(where, `FK hint "${hint}" does not link ${table} ↔ ${rel}`);
      else if (!hint && candidates.length > 1) fail(where, `ambiguous embed ${table} → ${rel} (${candidates.map((c) => c.conname).join(', ')}); add a !fk hint`);
      await checkSelect(rel, inner, `${where} → ${rel}`);
      continue;
    }
    const col = part.trim();
    if (col === '*') continue;
    checked.selects++;
    if (!columns.get(table).has(col)) fail(where, `unknown column ${table}.${col}`);
    else if (!(await colPriv('authenticated', table, col, 'SELECT')) && !(await colPriv('anon', table, col, 'SELECT'))) {
      fail(where, `column ${table}.${col} is not readable by clients`);
    }
  }
}

const FILTER_OPS = new Set(['eq', 'neq', 'in', 'ilike', 'gte', 'lte', 'is', 'order']);
for (const call of calls) {
  if (call.kind === 'rpc') {
    checked.rpcs++;
    const f = funcs.get(call.target);
    const where = `rpc ${call.target}`;
    if (!f) {
      fail(where, 'function does not exist');
      continue;
    }
    if (!f.auth_exec && !f.anon_exec) fail(where, 'not executable by clients');
    for (const key of Object.keys(call.params)) if (!f.args.includes(key)) fail(where, `unknown argument "${key}" (has: ${f.args.join(', ')})`);
    // Arguments without defaults must always be sent, or PostgREST cannot resolve the function.
    for (const req of f.args.slice(0, f.nargs - f.ndefaults)) {
      if (!(req in call.params)) fail(where, `missing required argument "${req}"`);
    }
    continue;
  }
  if (call.kind === 'storage') {
    if (!buckets.has(call.target)) fail(`storage`, `unknown bucket "${call.target}"`);
    continue;
  }
  const table = call.target;
  const where = `table ${table}`;
  if (!columns.has(table)) {
    fail(where, 'unknown table');
    continue;
  }
  let writeKind = null;
  for (const { op, args } of call.ops) {
    if (op === 'select' && typeof args[0] === 'string') await checkSelect(table, args[0], `${where} select`);
    if (FILTER_OPS.has(op) && typeof args[0] === 'string') {
      checked.filters++;
      if (!columns.get(table).has(args[0])) fail(where, `${op}() on unknown column "${args[0]}"`);
    }
    if (op === 'or') {
      for (const cond of args[0].split(',')) {
        const col = cond.split('.')[0];
        checked.filters++;
        if (!columns.get(table).has(col)) fail(where, `or() on unknown column "${col}"`);
      }
    }
    if (op === 'insert' || op === 'update') {
      writeKind = op;
      checked.writes++;
      for (const col of Object.keys(args[0])) {
        if (!columns.get(table).has(col)) fail(where, `${op} of unknown column "${col}"`);
        else if (!(await colPriv('authenticated', table, col, op.toUpperCase()))) fail(where, `${op} of "${col}" is not granted to authenticated`);
      }
    }
    if (op === 'delete') {
      writeKind = 'delete';
      checked.writes++;
      const { rows } = await db.query(`select has_table_privilege('authenticated', $1, 'DELETE') as ok`, [`public.${table}`]);
      if (!rows[0].ok) fail(where, 'delete is not granted to authenticated');
    }
  }
  void writeKind;
}

console.log(`Recorded ${calls.length} calls from ${exercise.length} service functions.`);
console.log(
  `Checked ${checked.selects} selected columns, ${checked.embeds} embeds, ${checked.filters} filters, ${checked.writes} writes, ${checked.rpcs} RPC calls.`,
);
if (SELF_TEST) {
  const unique = [...new Set(problems)];
  unique.forEach((p) => console.log(`  caught: ${p}`));
  const ok = unique.length === EXPECTED_SELF_TEST_PROBLEMS;
  console.log(ok ? `SELF-TEST OK — all ${EXPECTED_SELF_TEST_PROBLEMS} injected faults were detected.` : `SELF-TEST FAILED — expected ${EXPECTED_SELF_TEST_PROBLEMS}, got ${unique.length}.`);
  process.exit(ok ? 0 : 1);
}
if (problems.length) {
  console.error(`\n${problems.length} contract problem(s):`);
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('CONTRACT OK — every frontend query matches the database schema and grants.');
process.exit(0);
