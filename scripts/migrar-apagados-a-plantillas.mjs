// =============================================================================
// Un solo interruptor por mensaje: pasa los apagados de prefs al store
// =============================================================================
// Había DOS campos que apagaban lo mismo y el usuario los leía como uno:
//   · notification_prefs.avisos[id] === false  → el toggle de la lista de Avisos
//   · mako.plantillas.store[id].enabled false  → el punto de «Los mensajes»
// Los dos se consultan en cadena, así que apagar cualquiera silenciaba el aviso.
// Al quedar UNA pantalla (la de los mensajes), la verdad pasa a ser `enabled`.
//
// ⚠️ ESTE SCRIPT VA ANTES DEL CAMBIO DE CÓDIGO. Si el código empieza a leer el
// store mientras los apagados siguen en prefs, esos avisos se PRENDEN solos y le
// llegan a un cliente mensajes que había silenciado. Migrar primero deja el aviso
// apagado por los dos lados durante un rato, que no le hace mal a nadie.
//
//   node scripts/migrar-apagados-a-plantillas.mjs            (dry run)
//   node scripts/migrar-apagados-a-plantillas.mjs --apply
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import postgres from 'postgres';

const APLICAR = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

const prefs = await sql`select workspace_id, value from app_settings where key = 'notification_prefs'`;
let total = 0;

for (const fila of prefs) {
  const ws = fila.workspace_id;
  let p;
  try { p = JSON.parse(fila.value); } catch { continue; }
  const off = Object.entries(p.avisos ?? {}).filter(([, v]) => v === false).map(([k]) => k);
  if (!off.length) continue;

  const [row] = await sql`select value from app_settings where workspace_id = ${ws} and key = 'mako.plantillas.store'`;
  let store = {};
  try { store = row ? JSON.parse(row.value) : {}; } catch { store = {}; }

  const yaOff = off.filter((id) => store[id]?.enabled === false);
  const faltan = off.filter((id) => store[id]?.enabled !== false);
  console.log(`ws${ws}: ${off.length} apagado(s) — ${faltan.length} a migrar${yaOff.length ? `, ${yaOff.length} ya estaban` : ''}`);
  for (const id of faltan) console.log(`    · ${id}`);
  total += faltan.length;
  if (!APLICAR || !faltan.length) continue;

  for (const id of faltan) store[id] = { ...(store[id] ?? {}), enabled: false };
  await sql`
    insert into app_settings (workspace_id, key, value, updated_at)
    values (${ws}, 'mako.plantillas.store', ${JSON.stringify(store)}, now())
    on conflict (workspace_id, key) do update set value = excluded.value, updated_at = now()`;

  // Y se limpia `avisos` en prefs: un apagado que ninguna pantalla muestra es un
  // aviso mudo que nadie puede volver a prender.
  await sql`
    update app_settings set value = ${JSON.stringify({ ...p, avisos: {} })}, updated_at = now()
    where workspace_id = ${ws} and key = 'notification_prefs'`;
}

console.log(APLICAR ? `\n✓ ${total} migrado(s)` : `\n(dry run: ${total} se migrarían. Repetí con --apply)`);
await sql.end();
