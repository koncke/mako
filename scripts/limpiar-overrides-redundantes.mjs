// =============================================================================
// Borra los overrides de plantilla que NO expresan una decisión de nadie
// =============================================================================
// Dos clases de basura en `mako.plantillas.store`:
//   · `{}`               — una entrada vacía, de editar y volver atrás.
//   · `{enabled: true}`  — un «prendido» explícito que nadie prendió: vino del
//                          clon de configuración al crear el workspace, o de una
//                          prueba. Y PISA el default del catálogo, así que
//                          mantenía saliendo avisos que el producto ya decidió
//                          apagar (el caso: «Reporte diario matutino»).
//
// ⚠️ NO TOCA `enabled: false` NI LOS FLUJOS. Un apagado SÍ es una decisión de un
// cliente —ws13 apagó cuatro— y borrarlo le vuelve a prender lo que silenció.
//
//   node scripts/limpiar-overrides-redundantes.mjs            (dry run)
//   node scripts/limpiar-overrides-redundantes.mjs --apply
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import postgres from 'postgres';

const APLICAR = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });
const rows = await sql`select workspace_id, value from app_settings where key = 'mako.plantillas.store'`;
let total = 0;

for (const fila of rows) {
  const ws = fila.workspace_id;
  let store;
  try { store = JSON.parse(fila.value); } catch { continue; }
  const fuera = Object.entries(store).filter(([, e]) => {
    const k = Object.keys(e);
    if (k.length === 0) return true;                               // {}
    return k.length === 1 && e.enabled === true;                   // sólo un prendido que nadie pidió
  }).map(([id]) => id);
  if (!fuera.length) continue;
  console.log(`ws${ws}: ${fuera.join(', ')}`);
  total += fuera.length;
  if (!APLICAR) continue;
  for (const id of fuera) delete store[id];
  await sql`update app_settings set value = ${JSON.stringify(store)}, updated_at = now()
            where workspace_id = ${ws} and key = 'mako.plantillas.store'`;
}
console.log(APLICAR ? `\n✓ ${total} borrados` : `\n(dry run: ${total}. Repetí con --apply)`);
await sql.end();
