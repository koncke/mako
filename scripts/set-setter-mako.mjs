// =============================================================================
// set-setter-mako — pone setter='MaKo' a los leads en nutrición AUTOMÁTICA
// =============================================================================
// Regla: ningún setter vacío. Las nutriciones automáticas (No Agenda, No Show,
// Reactivación…) las corre MaKo, así que su setter es 'MaKo'. 'manual' NO se toca
// (la maneja un humano). One-off para corregir lo existente; el motor ya lo hace
// solo de acá en adelante (lib/crm-auto.ts).
//
//   node scripts/set-setter-mako.mjs            # DRY-RUN
//   node scripts/set-setter-mako.mjs --commit   # aplica
//   node scripts/set-setter-mako.mjs --ws 1 [--commit]
// =============================================================================
import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';
config({ path: resolve(process.cwd(), '.env.local') });

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const COMMIT = argv.includes('--commit');
const WS = Number(flag('ws', '1'));
const MAKO = 'MaKo';
// Nutriciones AUTOMÁTICAS (sin 'manual'). Igual a NUTRI_AUTO_KEYS de lib/pipeline.ts.
const NUTRI = ['nutri', 'noshow', 'noshow_r1', 'noshow_r2', 'noshow_r3', 'postagenda', 'postreunion', 'nopaga', 'nocompro', 'nutridiaria', 'reunion_excepcional', 'reactivacion'];

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
try { const u = new URL(process.env.DATABASE_URL); console.log(`DB destino: ${u.host}${u.pathname}`); } catch { /* noop */ }

const criterio = (t) => t`workspace_id = ${WS} AND pipeline_stage = ANY(${NUTRI}) AND COALESCE(setter,'') <> ${MAKO}`;

const objetivo = await sql`SELECT id, pipeline_stage, COALESCE(NULLIF(btrim(setter),''),'(vacío)') AS setter_prev FROM leads WHERE ${criterio(sql)} ORDER BY pipeline_stage`;
console.log(`\n=== setter → 'MaKo' · ws=${WS} · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`);
console.log(`Leads a tocar: ${objetivo.length}`);
const porStage = objetivo.reduce((a, r) => { a[r.pipeline_stage] = (a[r.pipeline_stage] ?? 0) + 1; return a; }, {});
console.log('Por etapa:', porStage);
const porPrev = objetivo.reduce((a, r) => { a[r.setter_prev] = (a[r.setter_prev] ?? 0) + 1; return a; }, {});
console.log('Setter anterior:', porPrev);

if (!COMMIT) { console.log('\nDRY-RUN: no se escribió nada. --commit para aplicar.'); await sql.end(); process.exit(0); }

const auditCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='lead_audit'`;
const hasWs = auditCols.some((c) => c.column_name === 'workspace_id');

let n = 0;
await sql.begin(async (tx) => {
  const upd = await tx`UPDATE leads SET setter = ${MAKO} WHERE ${criterio(tx)} RETURNING id`;
  n = upd.length;
  if (upd.length) {
    const rows = upd.map((r) => hasWs
      ? { lead_id: r.id, campo: 'Setter', valor_anterior: null, valor_nuevo: MAKO, autor: MAKO, workspace_id: WS }
      : { lead_id: r.id, campo: 'Setter', valor_anterior: null, valor_nuevo: MAKO, autor: MAKO });
    await tx`INSERT INTO lead_audit ${tx(rows)}`;
  }
});
console.log(`\n✅ setter='MaKo' seteado en ${n} leads.`);
const [chk] = await sql`SELECT count(*)::int nn FROM leads WHERE workspace_id=${WS} AND pipeline_stage = ANY(${NUTRI}) AND COALESCE(setter,'') <> ${MAKO}`;
console.log(`Nutrición-auto sin 'MaKo' que quedan (debería ser 0): ${chk.nn}`);
await sql.end();
