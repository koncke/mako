// =============================================================================
// reset-chatbot-leila — dejar el Chatbot de ws11 listo para probarlo de cero
// =============================================================================
// Sin --apply solo IMPRIME lo que haría. Con --apply escribe, y antes deja un
// backup completo en app_settings bajo `mako.backup.chatbot.2026-08-10` (el
// patrón que ya usa scripts/arreglar-leila.ts).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reset-chatbot-leila.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reset-chatbot-leila.ts --apply
//
// ⚠️ POR QUÉ ESTO NO ES `resetearWorkspace`. Ese vacía 50+ tablas y 4 buckets, y
// se niega —bien— a tocar cualquier workspace que no sea el de prueba (ws3):
// `exigirClienteDePrueba` en lib/auth-session.ts, con un test que itera
// [9,10,11,42] justamente para que nadie lo afloje. ws11 es una clienta REAL con
// 13.320 mensajes de WhatsApp, 4.064 contactos y una sesión de Evolution viva.
// Acá se toca lo mínimo: cuatro claves y tres audios.
//
// QUÉ ARREGLA, que es lo que importa:
//  1. El canal declarado dice 'llamadas' y es FALSO. Lidermente entrega en un
//     taller presencial semanal en Cancún; nadie agenda una llamada. Ese dato es
//     el que hace que el sistema le pida audios de agendamiento.
//  2. El funnel arranca en «Lead (Instant form)» — sus 27 leads tienen
//     meta_lead_id = 0 y origen_lead NULL: ninguno llegó de un formulario.
//  3. Los 3 audios grabados son inservibles con esa premisa. El #18 dice, con su
//     voz, «vi que dejaste tus datos en el anuncio».
//
// QUÉ NO TOCA, a propósito: `mako.voz_guia` (el análisis de su registro real, que
// está muy bien y costó plata), `mako.entregable`, sus leads, sus mensajes, la
// conexión de Evolution, y las 11 secuencias (ya archivadas desde el 02/08).
//
// Y NO le declara las `entradas`: eso es lo nuevo que ella tiene que ver y
// confirmar en /funnel. Declarárselo desde acá sería probar el flujo sin ella.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

const APLICAR = process.argv.includes('--apply');
const WS = 11;
const BACKUP_KEY = 'mako.backup.chatbot.2026-08-10';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
const log = (s = '') => console.log(s);

/** El pipeline de la plantilla `presencial` (lib/pipeline.ts), con su layout. */
const PIPELINE_PRESENCIAL = [
  { key: 'lead', label: 'Contacto nuevo', dot: '#2F6DDB', tone: 'info', kind: 'entrada', band: 'pipeline', col: 0 },
  { key: 'conversando', label: 'Conversación abierta', dot: '#1FA855', tone: 'teal', kind: 'paso', band: 'pipeline', col: 1 },
  { key: 'agenda', label: '1ª sesión sin costo', dot: '#E08A12', tone: 'accent', kind: 'reunion', band: 'pipeline', col: 2 },
  { key: 'facturando', label: 'Esperando la mensualidad', dot: '#C8870C', tone: 'teal', kind: 'pago', band: 'pipeline', col: 3 },
  { key: 'ganado', label: 'Miembro activo', dot: '#3B6D11', tone: 'good', kind: 'cierre', band: 'pipeline', col: 4, bg: '#EAF3DE', fg: '#27500A', border: '#3B6D11' },
];
const SUPPRESSED = ['nopaga>reunion_excepcional'];

async function main() {
  log(APLICAR ? '── APLICANDO ──\n' : '── DRY RUN (sin --apply no escribe nada) ──\n');

  // ── Lo que hay hoy ──
  const [fc] = await sql`select data from funnel_config where workspace_id = ${WS}`;
  const settings = await sql`select key, value from app_settings where workspace_id = ${WS} and key in ('negocio.fase.diagnostico', 'chat_agent.audios_clave', 'onboarding.tab.setting')`;
  const porKey = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  const audios = await sql`select id, titulo, media_path, duracion_s, transcript from setting_audios where workspace_id = ${WS} order by id`;

  const diag = typeof porKey['negocio.fase.diagnostico'] === 'string' ? JSON.parse(porKey['negocio.fase.diagnostico']) : porKey['negocio.fase.diagnostico'];
  const tab = typeof porKey['onboarding.tab.setting'] === 'string' ? JSON.parse(porKey['onboarding.tab.setting']) : porKey['onboarding.tab.setting'];

  log('ANTES:');
  log(`  canal declarado : ${diag?.canal}`);
  log(`  funnel          : ${(fc?.data?.pipeline ?? []).map((s: { label: string }) => s.label).join(' → ')}`);
  log(`  audios          : ${audios.map((a) => `#${a.id} «${a.titulo}»`).join(', ') || '(ninguno)'}`);
  log(`  paso voz        : ${tab?.steps?.voz?.done ? 'hecho' : 'pendiente'}`);
  log('');
  log('DESPUÉS:');
  log(`  canal declarado : presencial`);
  log(`  funnel          : ${PIPELINE_PRESENCIAL.map((s) => s.label).join(' → ')}`);
  log(`  audios          : (ninguno — los 3 se borran; sus transcripciones quedan en el backup)`);
  log(`  paso voz        : pendiente (lo vuelve a caminar)`);
  log(`  entradas        : SIN DECLARAR — las declara ella en /funnel, que es lo que hay que probar`);
  log('');
  log(`Los 3 audios que se borran (${audios.reduce((n, a) => n + (a.duracion_s ?? 0), 0)}s de su voz, hay que regrabar):`);
  for (const a of audios) log(`  #${a.id} «${a.titulo}» → ${String(a.transcript ?? '').slice(0, 90)}…`);

  if (!APLICAR) {
    log('\n(dry run: no se escribió nada. Repetí con --apply)');
    await sql.end();
    return;
  }

  // ── 1. Backup ANTES de tocar nada ──
  const backup = {
    at: new Date().toISOString(),
    funnel_config: fc?.data ?? null,
    diagnostico: diag ?? null,
    audios_clave: porKey['chat_agent.audios_clave'] ?? null,
    tab_setting: tab ?? null,
    audios: audios.map((a) => ({ id: a.id, titulo: a.titulo, media_path: a.media_path, duracion_s: a.duracion_s, transcript: a.transcript })),
  };
  await sql`
    insert into app_settings (workspace_id, key, value, updated_at)
    values (${WS}, ${BACKUP_KEY}, ${JSON.stringify(backup)}, now())
    on conflict (workspace_id, key) do update set value = excluded.value, updated_at = now()`;
  log(`\n✓ Backup en app_settings[${WS}].${BACKUP_KEY}`);

  // ── 2. El canal ──
  await sql`
    insert into app_settings (workspace_id, key, value, updated_at)
    values (${WS}, 'negocio.fase.diagnostico', ${JSON.stringify({ ...diag, canal: 'presencial' })}, now())
    on conflict (workspace_id, key) do update set value = excluded.value, updated_at = now()`;
  log('✓ canal: llamadas → presencial');

  // ── 3. El funnel. MERGE del jsonb: no se pisa ninguna otra clave ──
  //
  // ⚠️ `sql.json(...)`, NO `JSON.stringify(...)`. `funnel_config.data` es jsonb, y
  // un string plano entra como un jsonb de TIPO STRING — el objeto queda envuelto
  // en comillas y escapado. No falla nada: la fila se escribe, `getFunnel` lee un
  // string, `cfg.pipeline` da undefined y el cliente se queda con el funnel por
  // defecto sin que nada avise. Pasó en esta misma corrida.
  //
  // (`app_settings.value` es TEXT, así que ahí el JSON.stringify de los otros
  // pasos SÍ corresponde. No son intercambiables: hay que mirar la columna.)
  const dataNueva = { ...(fc?.data ?? {}), pipeline: PIPELINE_PRESENCIAL, suppressed: SUPPRESSED };
  await sql`update funnel_config set data = ${sql.json(dataNueva)}, updated_at = now() where workspace_id = ${WS}`;
  log('✓ funnel: plantilla presencial (la etapa de reunión conserva la clave `agenda`,');
  log('          así que sus 3 leads con fecha de sesión no se mueven de lugar)');

  // ── 4. Los audios: fila + binario + la clave del mapa ──
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const paths = audios.map((a) => a.media_path).filter((p): p is string => !!p && p.startsWith(`${WS}/`));
  if (paths.length) {
    const { error } = await sb.storage.from('wa-media').remove(paths);
    if (error) log(`  ⚠️ binarios: ${error.message} (las filas se borran igual)`);
    else log(`✓ ${paths.length} binarios borrados de wa-media`);
  }
  await sql`delete from setting_audios where workspace_id = ${WS}`;
  await sql`delete from app_settings where workspace_id = ${WS} and key = 'chat_agent.audios_clave'`;
  log('✓ 3 audios borrados + el mapa clave→id');

  // ── 5. Reabrir SOLO el paso de la voz ──
  // A mano y no con el endpoint `reabrir`, que resetea la tab ENTERA: eso le
  // haría recaminar la conexión de WhatsApp y el contexto, que están bien.
  const steps = { ...(tab?.steps ?? {}) };
  delete steps.voz;
  await sql`
    insert into app_settings (workspace_id, key, value, updated_at)
    values (${WS}, 'onboarding.tab.setting', ${JSON.stringify({ ...tab, status: 'pendiente', steps })}, now())
    on conflict (workspace_id, key) do update set value = excluded.value, updated_at = now()`;
  log('✓ paso `voz` reabierto (conectar WhatsApp y contexto quedan como estaban)');

  log('\nListo. Al entrar a /chatbot va a pedirle declarar cómo entra su gente,');
  log('con un link a /funnel. Después de declararlo, le va a pedir 3 audios nuevos:');
  log('  · Le escribes tú primero (en frío)');
  log('  · Te escribieron ellos primero');
  log('  · Quedó en ir a tu sesión');
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
