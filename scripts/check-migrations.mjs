// Solo-lectura: verifica qué migraciones están aplicadas inspeccionando el
// catálogo de Postgres + algunos conteos. NO ejecuta DDL ni escribe nada.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });
const conn = process.env.DATABASE_URL;
if (!conn) { console.error('Falta DATABASE_URL'); process.exit(1); }

const sql = postgres(conn, { ssl: 'require', connect_timeout: 10, max: 1 });

const out = {};
try {
  // Columnas existentes por tabla
  const cols = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'`;
  const colset = new Set(cols.map(c => `${c.table_name}.${c.column_name}`));
  const has = (t, c) => colset.has(`${t}.${c}`);

  // Tablas y vistas
  const rels = await sql`
    SELECT table_name, table_type FROM information_schema.tables
    WHERE table_schema = 'public'`;
  const tables = new Set(rels.filter(r => r.table_type === 'BASE TABLE').map(r => r.table_name));
  const views  = new Set(rels.filter(r => r.table_type === 'VIEW').map(r => r.table_name));

  // Definiciones de CHECK constraints relevantes
  const cons = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid IN ('leads'::regclass, 'marketing_metrics_daily'::regclass)`;
  const condef = Object.fromEntries(cons.map(c => [c.conname, c.def]));

  // Definición de la vista semanal (para ver si trae dias_promedio_ciclo)
  let vistaSemanalDef = '';
  if (views.has('v_cohortes_semanales')) {
    const [v] = await sql`SELECT pg_get_viewdef('v_cohortes_semanales'::regclass) AS def`;
    vistaSemanalDef = v.def;
  }

  // Índice único de mmd (para ver columnas que incluye)
  let idxUniqueDef = '';
  const idx = await sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_mmd_unique'`;
  if (idx.length) idxUniqueDef = idx[0].indexdef;

  // Conteos de datos (solo si las tablas existen)
  const count = async (q) => { try { const [r] = await q; return Number(r.n); } catch { return null; } };
  const ytHist     = tables.has('marketing_metrics_daily') ? await count(sql`SELECT count(*)::int n FROM marketing_metrics_daily WHERE plataforma='youtube' AND youtube_video_id='bdhLgtC_Z0s'`) : null;
  const ytHistV2   = tables.has('marketing_metrics_daily') ? await count(sql`SELECT count(*)::int n FROM marketing_metrics_daily WHERE raw_payload->>'source'='youtube-history-seed-v2'`) : null;
  const ytHistV1   = tables.has('marketing_metrics_daily') ? await count(sql`SELECT count(*)::int n FROM marketing_metrics_daily WHERE raw_payload->>'source'='youtube-history-seed'`) : null;
  const appKeys    = tables.has('app_settings') ? await count(sql`SELECT count(*)::int n FROM app_settings WHERE key IN ('objetivo_cierres','objetivo_cash_usd','objetivo_desde')`) : null;
  const stagesSeed = tables.has('pipeline_stages') ? await count(sql`SELECT count(*)::int n FROM pipeline_stages`) : null;
  const leadsN     = tables.has('leads') ? await count(sql`SELECT count(*)::int n FROM leads`) : null;

  const checks = [
    ['0001 initial_schema', tables.has('marketing_metrics_daily') && tables.has('leads') && views.has('v_cohortes_semanales') && views.has('v_cohortes_mensuales')],
    ['0002 extend_video_types', (condef['marketing_metrics_daily_youtube_video_type_check']||'').includes('thanks_prep')],
    ['0003 add_utm_columns', has('leads','utm_source') && has('leads','utm_campaign')],
    ['0004 add_fecha_confirmacion', has('leads','fecha_confirmacion')],
    ['0005 add_cobranza_columns', has('leads','fecha_primer_pago') && has('leads','total_cobrado_usd')],
    ['0006 add_calendly_respuestas', has('leads','respuesta_facturacion') && has('leads','respuesta_objetivo')],
    ['0007 add_meta_lead_ads', has('leads','meta_lead_id') && has('leads','telefono_normalizado')],
    ['0008 add_vsl_tracking', tables.has('vsl_events') && has('leads','visitor_id')],
    ['0009 meta_ad_level', has('marketing_metrics_daily','ad_id') && tables.has('adset_budget_daily') && idxUniqueDef.includes('ad_id')],
    ['0010 panda_video', (condef['marketing_metrics_daily_plataforma_check']||'').includes('panda') && has('marketing_metrics_daily','video_variant') && has('marketing_metrics_daily','video_id')],
    ['0011 youtube_vsl_history (seed v1)', ytHistV1 !== null && ytHistV1 > 0],
    ['0012 youtube_vsl_history_fix (seed v2)', ytHistV2 !== null && ytHistV2 > 0],
    ['0013 estado_lead', has('leads','estado_lead') && has('leads','motivo_perdida') && vistaSemanalDef.includes('dias_promedio_ciclo')],
    ['0014 pagos_cuotas', has('leads','cobro_inicial_usd') && tables.has('pagos')],
    ['0015 review_queue', tables.has('review_queue')],
    ['0016 app_settings', tables.has('app_settings')],
    ['0017 vsl_engagement', has('vsl_events','tipo_evento') && has('vsl_events','porcentaje')],
    ['0018 respuestas_calendly_v3', has('leads','respuesta_inversion') && has('leads','respuesta_decisor')],
    ['0019 nutricion_no_responde', has('leads','nutricion_realizada') && (condef['leads_estado_lead_check']||'').includes('no_responde')],
    ['0020 pipeline_stages_closer_setter', has('leads','pipeline_stage') && has('leads','fathom_links') && tables.has('pipeline_stages')],
    ['0021 landing_visits', tables.has('landing_visits')],
    ['0022 ad_creative_preview', has('marketing_metrics_daily','ad_thumbnail_url') && has('marketing_metrics_daily','ad_permalink')],
  ];

  console.log('\n=== ESTADO DE MIGRACIONES ===');
  for (const [name, ok] of checks) console.log(`${ok ? '✅ APLICADA ' : '❌ FALTA    '} ${name}`);

  console.log('\n=== DATOS / DIAGNÓSTICO ===');
  console.log(`leads (filas): ${leadsN}`);
  console.log(`VSL YouTube hist (video bdhLgtC_Z0s): ${ytHist} filas | seed v1=${ytHistV1} | seed v2=${ytHistV2}`);
  console.log(`app_settings claves objetivo: ${appKeys}/3`);
  console.log(`pipeline_stages filas: ${stagesSeed}`);
  console.log(`idx_mmd_unique: ${idxUniqueDef || '(no existe)'}`);
  console.log(`plataforma CHECK: ${condef['marketing_metrics_daily_plataforma_check'] || '(sin check)'}`);
  console.log(`estado_lead CHECK: ${condef['leads_estado_lead_check'] || '(sin check)'}`);
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
