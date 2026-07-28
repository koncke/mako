// =============================================================================
// wipe-negocio-mauricio — borra la DATA DE NEGOCIO del dueño (ws1) para re-correr
// =============================================================================
// Uso: node scripts/wipe-negocio-mauricio.mjs
// Borra SOLO lo del onboarding/negocio de Mauricio (workspace 1) para que pueda
// volver a cargar todo desde cero: documentos del Archivero (filas + binarios),
// brief extraído, panorama, avatares, ángulos y el diagnóstico de fase.
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
  'mako.angulos_venta',
  'negocio.fase.diagnostico',
];

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

// Antes: contar para el log.
const [{ count: filesAntes }] = await sql`SELECT count(*)::int FROM archivero_files WHERE workspace_id = ${WS}`;
const [{ count: settsAntes }] = await sql`SELECT count(*)::int FROM app_settings WHERE workspace_id = ${WS} AND key = ANY(${SETTINGS_KEYS})`;

// 1) Binarios del Archivero en storage (path = "1/<fileId>"). Supabase NO deja
//    borrar storage.objects por SQL directo → hay que usar la Storage API.
let borradosStorage = 0;
try {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: list } = await sb.storage.from('archivero').list(String(WS), { limit: 1000 });
  const paths = (list || []).filter((o) => o.name).map((o) => `${WS}/${o.name}`);
  if (paths.length) { const { data } = await sb.storage.from('archivero').remove(paths); borradosStorage = (data || []).length; }
} catch (e) { console.warn('No pude borrar binarios de storage (sigo): ' + (e?.message || e)); }

// 2) Filas de archivos.
const files = await sql`DELETE FROM archivero_files WHERE workspace_id = ${WS}`;

// 3) Settings de negocio (brief, panorama, avatares, ángulos, fase, manual).
const setts = await sql`DELETE FROM app_settings WHERE workspace_id = ${WS} AND key = ANY(${SETTINGS_KEYS})`;

await sql.end();

console.log(`OK — workspace ${WS} (Mauricio):`);
console.log(`  · archivos: ${files.count} filas (${filesAntes} antes) + ${borradosStorage} binarios en storage`);
console.log(`  · settings de negocio: ${setts.count} (${settsAntes} antes) → ${SETTINGS_KEYS.join(', ')}`);
console.log('Su cuenta e integraciones quedan intactas. Puede re-correr el onboarding desde el hub.');
