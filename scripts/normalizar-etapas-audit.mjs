// Las filas campo='Etapa' del historial DEBEN guardar la KEY de la etapa, no su
// etiqueta: la ficha resuelve key→label contra el funnel del workspace, y ante un
// valor desconocido stageMeta cae a la 1ª etapa (pintaba todo "Lead (Instant form)").
// El backfill de historial escribió etiquetas. Esto las normaliza a keys.
// Uso: node scripts/normalizar-etapas-audit.mjs [--apply]
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
const APPLY = process.argv.includes('--apply');
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\(derivada\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// El mapa sale del funnel REAL de cada workspace (no de una tabla hardcodeada que
// se queda vieja). Se suman las etiquetas legacy que el funnel ya no genera.
const keys = new Set();
const porLabel = new Map();
for (const f of await sql`select data from funnel_config`) {
  for (const s of f.data?.pipeline ?? []) {
    if (!s?.key) continue;
    keys.add(s.key);
    if (s.label) porLabel.set(norm(s.label), s.key);
  }
}
const LEGACY = { 'lead instant form': 'lead', 'agenda r1': 'agenda', 'agenda r2': 'agendaj2',
  'nutricion no show r1': 'noshow_r1', 'nutricion no show': 'noshow_r1', 'nutricion no show r2': 'noshow_r2',
  'nutricion no agenda': 'nutri', ganado: 'ganado', perdido: 'perdido', descalificado: 'descal' };
for (const [l, k] of Object.entries(LEGACY)) if (!porLabel.has(l)) porLabel.set(l, k);
console.log(`funnel: ${keys.size} keys · ${porLabel.size} etiquetas mapeadas`);

// Una KEY es siempre [a-z0-9_] (lead, agenda, noshow_r1, facturando…); una ETIQUETA
// trae mayúsculas o espacios ("Agenda R1"). No se depende de leer el funnel entero:
// keys.has() solo confirma; el patrón es el que decide qué NO se toca.
const esKey = (v) => keys.has(v) || /^[a-z0-9_]+$/.test(v);
const aKey = (v) => (v == null || v === '' || esKey(v) ? null : porLabel.get(norm(v)) ?? undefined);
const filas = await sql`select id, valor_anterior, valor_nuevo from lead_audit where campo='Etapa'`;
const cambios = []; const sinMapear = new Map();
for (const r of filas) {
  const a = aKey(r.valor_anterior); const n = aKey(r.valor_nuevo);
  if (a === undefined) sinMapear.set(r.valor_anterior, (sinMapear.get(r.valor_anterior) ?? 0) + 1);
  if (n === undefined) sinMapear.set(r.valor_nuevo, (sinMapear.get(r.valor_nuevo) ?? 0) + 1);
  if (a || n) cambios.push({ id: r.id, ant: a ?? r.valor_anterior, nue: n ?? r.valor_nuevo });
}
console.log(`filas Etapa: ${filas.length} · a normalizar: ${cambios.length}`);
if (sinMapear.size) console.log('SIN MAPEAR:', [...sinMapear].map(([v, n]) => `"${v}"=${n}`).join(' | '));
if (!APPLY) { console.log('\n(dry-run) ejemplos:', cambios.slice(0, 4).map((c) => `#${c.id} ${c.ant}→${c.nue}`).join(' | ')); await sql.end(); process.exit(0); }

for (const c of cambios) await sql`update lead_audit set valor_anterior=${c.ant}, valor_nuevo=${c.nue} where id=${c.id}`;
// Una transición a la MISMA etapa no es un cambio: no debe figurar en el historial.
const [{ count: mudas }] = await sql`with d as (delete from lead_audit where campo='Etapa' and valor_anterior is not distinct from valor_nuevo returning 1) select count(*)::int from d`;
console.log(`✓ ${cambios.length} filas normalizadas · ${mudas} filas mudas (misma etapa → misma etapa) borradas`);
console.log('valores finales:', (await sql`select valor_nuevo, count(*)::int n from lead_audit where campo='Etapa' group by 1 order by n desc`).map((r) => `${r.valor_nuevo}=${r.n}`).join(' | '));
await sql.end();
