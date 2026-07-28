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

// 1) Binarios del Archivero en storage (path = "1/<fileId>").
let objs = { count: 0 };
try { objs = await sql`DELETE FROM storage.objects WHERE bucket_id = 'archivero' AND name LIKE ${WS + '/%'}`; }
catch (e) { console.warn('No pude borrar storage.objects (sigo): ' + (e?.message || e)); }

// 2) Filas de archivos.
const files = await sql`DELETE FROM archivero_files WHERE workspace_id = ${WS}`;

// 3) Settings de negocio (brief, panorama, avatares, ángulos, fase, manual).
const setts = await sql`DELETE FROM app_settings WHERE workspace_id = ${WS} AND key = ANY(${SETTINGS_KEYS})`;

await sql.end();

console.log(`OK — workspace ${WS} (Mauricio):`);
console.log(`  · archivos: ${files.count} filas (${filesAntes} antes) + ${objs.count} binarios en storage`);
console.log(`  · settings de negocio: ${setts.count} (${settsAntes} antes) → ${SETTINGS_KEYS.join(', ')}`);
console.log('Su cuenta e integraciones quedan intactas. Puede re-correr el onboarding desde el hub.');
