// =============================================================================
// reclasificar-reactivacion — mueve leads FRÍOS (sin agendar nunca hace >= N días)
// de "Nutrición - No Agenda" (o del Instant form) a "Nutrición - Reactivación".
// =============================================================================
// One-off para corregir la clasificación histórica del CRM automático (T2): antes
// TODO lead estancado caía en No Agenda; ahora los viejos van a Reactivación.
// Replica lo que haría setPipelineStage(lead,'reactivacion') + logLeadEvent, en
// crudo (los libs son server-only y no se pueden importar desde un script).
//
// Uso:
//   node scripts/reclasificar-reactivacion.mjs            # DRY-RUN (no escribe)
//   node scripts/reclasificar-reactivacion.mjs --commit   # aplica
//   node scripts/reclasificar-reactivacion.mjs --dias 7 --ws 1 [--commit]
// =============================================================================
import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve(process.cwd(), '.env.local') });

const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const COMMIT = argv.includes('--commit');
const DIAS = Number(flag('dias', '7'));
const WS = Number(flag('ws', '1'));

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

// Salvaguarda: mostrar a qué DB estamos por escribir (host, sin credenciales).
try {
  const u = new URL(process.env.DATABASE_URL);
  console.log(`DB destino: ${u.host}${u.pathname}`);
} catch { /* noop */ }

// Días transcurridos = mismo cómputo que el planificador (diasEntre): día-calendario
// de HOY en Tijuana menos la fecha (UTC) de created_at. Evita el desfase de ~1 día
// que daría el epoch continuo en el borde del umbral.
const DIAS_EXPR = (t) => t`((now() AT TIME ZONE 'America/Tijuana')::date - (created_at AT TIME ZONE 'UTC')::date)`;

// Criterio = rama de Reactivación por antigüedad del planificador (lib/crm-auto-plan.ts):
// estado_lead 'abierto', nunca agendó (ninguna reunión), etapa lead/nutri, >= DIAS.
// Las condiciones asistio_* IS NULL son una red de seguridad (no tocar No-Agenda con
// asistencia marcada, estado patológico); lo que el script no levante lo levanta el cron.
const criterio = (t) => t`
  workspace_id = ${WS}
  AND estado_lead = 'abierto'
  AND (pipeline_stage IN ('nutri','lead') OR pipeline_stage IS NULL)
  AND fecha_agenda IS NULL AND fecha_junta_1 IS NULL AND fecha_junta_2 IS NULL
  AND asistio_j1 IS NULL AND asistio_j2 IS NULL
  AND ${DIAS_EXPR(t)} >= ${DIAS}`;

const objetivo = await sql`
  SELECT id, nombre, pipeline_stage, ${DIAS_EXPR(sql)}::int AS dias
  FROM leads
  WHERE ${criterio(sql)}
  ORDER BY dias DESC`;

console.log(`\n=== Reclasificar a Reactivación · ws=${WS} · umbral=${DIAS} días · ${COMMIT ? 'COMMIT' : 'DRY-RUN'} ===`);
console.log(`Leads que califican: ${objetivo.length}`);
const porOrigen = objetivo.reduce((a, r) => { const k = r.pipeline_stage ?? '(null)'; a[k] = (a[k] ?? 0) + 1; return a; }, {});
console.log('Por etapa de origen:', porOrigen);
console.log('Muestra (5 más viejos / 5 más nuevos):');
for (const r of objetivo.slice(0, 5)) console.log(`  #${r.id} ${r.nombre ?? '—'} · ${r.dias}d · ${r.pipeline_stage ?? '(null)'}`);
if (objetivo.length > 10) console.log('  …');
for (const r of objetivo.slice(-5)) console.log(`  #${r.id} ${r.nombre ?? '—'} · ${r.dias}d · ${r.pipeline_stage ?? '(null)'}`);

if (!COMMIT) {
  console.log('\nDRY-RUN: no se escribió nada. Corré con --commit para aplicar.');
  await sql.end();
  process.exit(0);
}

// lead_audit: incluir workspace_id solo si la columna existe.
const auditCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='lead_audit'`;
const auditHasWs = auditCols.some((c) => c.column_name === 'workspace_id');

let movidos = 0;
await sql.begin(async (tx) => {
  // Mover: pipeline_stage='reactivacion', marcar nutrición, limpiar deadline manual,
  // bump updated_at. estado_lead ya es 'abierto' (terminalEstadoFor('reactivacion')).
  const upd = await tx`
    UPDATE leads
    SET pipeline_stage = 'reactivacion',
        nutricion_realizada = true,
        nutricion_manual_deadline = NULL,
        updated_at = now()
    WHERE ${criterio(tx)}
    RETURNING id, ${DIAS_EXPR(tx)}::int AS dias`;
  movidos = upd.length;

  // Historial (lead_audit) por lead movido.
  if (upd.length) {
    const rows = upd.map((r) => {
      const valor = `T2: → Nutrición - Reactivación (Lead sin agendar hace ${r.dias} días (frío) — reclasificado)`;
      return auditHasWs
        ? { lead_id: r.id, campo: 'CRM automático', valor_anterior: null, valor_nuevo: valor, autor: 'MaKo', workspace_id: WS }
        : { lead_id: r.id, campo: 'CRM automático', valor_anterior: null, valor_nuevo: valor, autor: 'MaKo' };
    });
    await tx`INSERT INTO lead_audit ${tx(rows)}`;
  }
});

console.log(`\n✅ Movidos a Reactivación: ${movidos}`);
const [check] = await sql`SELECT count(*)::int n FROM leads WHERE pipeline_stage='reactivacion' AND workspace_id=${WS}`;
console.log(`Total ahora en reactivacion (ws${WS}): ${check.n}`);
await sql.end();
