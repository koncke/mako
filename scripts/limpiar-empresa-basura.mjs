// =============================================================================
// limpiar-empresa-basura — empresa "Nose"/"-"/"N/A"… → vacío + ignorada
// =============================================================================
// El dueño ponía "Nose"/"-"/"Sin empresa" para no dejar el campo vacío. Ahora eso
// se maneja con empresa_omitido: dejamos el campo VACÍO (sin el texto basura) y lo
// marcamos ignorado (deja de pedir "Empresa" en el CRM general).
//   node scripts/limpiar-empresa-basura.mjs            # DRY-RUN
//   node scripts/limpiar-empresa-basura.mjs --commit   # aplica
// =============================================================================
import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });
const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const WS = Number((argv.indexOf('--ws') >= 0 && argv[argv.indexOf('--ws') + 1]) || '1');
const JUNK = ['nose', 'no se', 'n/a', 'na', '-', '--', '.', 'x', 'xx', 'ninguna', 'ninguno', 'no', 'sin empresa', 'sinempresa', 'no aplica', 'no aplica.', '?', 's/n', 'sn'];

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
try { const u = new URL(process.env.DATABASE_URL); console.log(`DB destino: ${u.host}${u.pathname}`); } catch { /* noop */ }

const crit = (t) => t`workspace_id = ${WS} AND empresa IS NOT NULL AND lower(btrim(empresa)) = ANY(${JUNK})`;
const rows = await sql`SELECT empresa, count(*)::int n FROM leads WHERE ${crit(sql)} GROUP BY 1 ORDER BY n DESC`;
const total = rows.reduce((a, r) => a + r.n, 0);
console.log(`\n=== empresa basura → vacío + ignorada · ws=${WS} · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`);
console.log(`Leads a limpiar: ${total}`);
for (const r of rows) console.log(`  "${r.empresa}" · ${r.n}`);

if (!COMMIT) { console.log('\nDRY-RUN: no se escribió nada. --commit para aplicar.'); await sql.end(); process.exit(0); }

const [{ n }] = await sql`WITH u AS (UPDATE leads SET empresa = NULL, empresa_omitido = true WHERE ${crit(sql)} RETURNING 1) SELECT count(*)::int n FROM u`;
console.log(`\n✅ Limpiados + ignorados: ${n}`);
const [chk] = await sql`SELECT count(*)::int n FROM leads WHERE ${crit(sql)}`;
console.log(`Quedan con texto basura (debería ser 0): ${chk.n}`);
await sql.end();
