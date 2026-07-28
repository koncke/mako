// =============================================================================
// wipe-negocio-mauricio — borra la DATA DE NEGOCIO del dueño (ws1) para re-correr
// =============================================================================
// Uso: node scripts/wipe-negocio-mauricio.mjs
// Borra SOLO lo del onboarding/negocio de Mauricio (workspace 1) para que pueda
// volver a hacer todo desde cero: documentos del Archivero (filas + binarios), fotos
// de la persona, brief extraído, panorama, avatares, razones, entregable, formatos,
// diagnóstico de fase, y RESETEA el estado del onboarding (para que salga el wizard).
// NO toca: su cuenta/usuario, sus integraciones/credenciales, ni nada de otros ws.

import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const WS = 1; // OWNER_WS (Mauricio)
const SETTINGS_KEYS = [
  'mako.archivero.manual',
  'mako.archivero.panorama',
  'mako.onboarding.answers',
  'mako.avatares',
  'mako.avatares.contexto',
  'mako.razones',
  'mako.angulos_venta', // legacy (por si quedó data vieja)
  'mako.entregable',
  'mako.gancho',        // legacy
  'mako.formatos_recom',
  'mako.persona',
  'negocio.fase.diagnostico',
  'onboarding.state',   // reset → al entrar a /onboarding vuelve a salir el wizard
];

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

// Info: la capa del workspace (el wizard SOLO aparece si la capa tiene pasos).
let capa = '(desconocida)';
try { const r = await sql`SELECT capa FROM workspaces WHERE id = ${WS}`; capa = r[0]?.capa ?? '(sin fila)'; } catch { /* tabla puede variar */ }

const [{ count: filesAntes }] = await sql`SELECT count(*)::int FROM archivero_files WHERE workspace_id = ${WS}`;
const [{ count: settsAntes }] = await sql`SELECT count(*)::int FROM app_settings WHERE workspace_id = ${WS} AND key = ANY(${SETTINGS_KEYS})`;

// 1) Binarios en storage: archivos del Archivero (`1/<id>`) + fotos de persona (`1/persona/<id>`).
//    Supabase NO deja borrar storage.objects por SQL → Storage API (list + remove).
let borradosStorage = 0;
try {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const prefijo of [String(WS), `${WS}/persona`]) {
    const { data: list } = await sb.storage.from('archivero').list(prefijo, { limit: 1000 });
    const paths = (list || []).filter((o) => o.name && o.id).map((o) => `${prefijo}/${o.name}`);
    if (paths.length) { const { data } = await sb.storage.from('archivero').remove(paths); borradosStorage += (data || []).length; }
  }
} catch (e) { console.warn('No pude borrar binarios de storage (sigo): ' + (e?.message || e)); }

// 2) Filas de archivos.
const files = await sql`DELETE FROM archivero_files WHERE workspace_id = ${WS}`;

// 3) Settings de negocio + estado del onboarding.
const setts = await sql`DELETE FROM app_settings WHERE workspace_id = ${WS} AND key = ANY(${SETTINGS_KEYS})`;

await sql.end();

console.log(`OK — workspace ${WS} (Mauricio) · capa = ${capa}:`);
console.log(`  · archivos: ${files.count} filas (${filesAntes} antes) + ${borradosStorage} binarios en storage`);
console.log(`  · settings de negocio: ${setts.count} (${settsAntes} antes)`);
console.log('Su cuenta e integraciones quedan intactas.');
console.log('→ Al entrar a /onboarding le sale el WIZARD secuencial (onboarding.state reseteado); al terminarlo, el hub de tabs.');
