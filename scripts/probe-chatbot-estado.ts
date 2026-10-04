// =============================================================================
// probe-chatbot-estado — qué tiene el Chatbot HOY, de verdad
// =============================================================================
// SOLO LEE. La llamada con Leila del 01/10 dejó el Chatbot como P1 al 7/10, y antes
// de diseñar nada hay que saber qué hay: cuántas secuencias existen, si alguna vez
// salió un mensaje, qué disparadores se usan de verdad y si la línea de WhatsApp está
// conectada. Es la regla de la casa: el estado se mira, no se recuerda.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-chatbot-estado.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
const titulo = (t: string) => console.log(`\n${'─'.repeat(78)}\n${t}\n${'─'.repeat(78)}`);
const fecha = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 16) : '—');

async function tabla(nombre: string): Promise<boolean> {
  const r = await sql`select 1 from information_schema.tables where table_name = ${nombre} limit 1`;
  return r.length > 0;
}

async function main() {
  titulo('1. SECUENCIAS por workspace (y si están prendidas)');
  const sec = await sql`
    select workspace_id, count(*)::int as n,
           count(*) filter (where activa)::int as activas,
           min(created_at) as desde, max(updated_at) as tocada
      from nutricion_secuencias group by workspace_id order by workspace_id`;
  if (!sec.length) console.log('  (ninguna)');
  for (const s of sec) console.log(`  ws${String(s.workspace_id).padStart(3)}  ${String(s.n).padStart(3)} secuencias · ${s.activas} activas · desde ${fecha(s.desde)} · última ${fecha(s.tocada)}`);

  titulo('2. ¿SALIÓ ALGUNA VEZ UN MENSAJE? (nutricion_envios)');
  const env = await sql`
    select workspace_id, estado, count(*)::int as n, max(created_at) as ultimo
      from nutricion_envios group by workspace_id, estado order by workspace_id, count(*) desc`;
  if (!env.length) console.log('  ⛔ CERO filas en toda la tabla: el motor nunca mandó nada.');
  for (const e of env) console.log(`  ws${String(e.workspace_id).padStart(3)}  ${String(e.estado).padEnd(12)} ${String(e.n).padStart(5)}  último ${fecha(e.ultimo)}`);

  titulo('3. INSCRIPCIONES (quién está adentro de una secuencia)');
  const ins = await sql`
    select workspace_id, estado, count(*)::int as n, max(updated_at) as ultimo
      from nutricion_inscripciones group by workspace_id, estado order by workspace_id`;
  if (!ins.length) console.log('  (ninguna)');
  for (const i of ins) console.log(`  ws${String(i.workspace_id).padStart(3)}  ${String(i.estado).padEnd(12)} ${String(i.n).padStart(5)}  último ${fecha(i.ultimo)}`);

  titulo('4. LA LÍNEA DE WHATSAPP (evolution_instancias)');
  const ev = await sql`select * from evolution_instancias order by workspace_id`;
  if (!ev.length) console.log('  (ninguna)');
  for (const e of ev) console.log('  ' + JSON.stringify(e).slice(0, 320));

  titulo('5. ETIQUETAS DE WHATSAPP — ¿ya existen? (evolution_labels / stage_labels)');
  for (const t of ['evolution_labels', 'evolution_stage_labels']) {
    if (!(await tabla(t))) { console.log(`  ${t}: la tabla NO existe`); continue; }
    const r = await sql`select workspace_id, count(*)::int as n from ${sql(t)} group by workspace_id order by workspace_id`;
    if (!r.length) { console.log(`  ${t}: existe y está VACÍA`); continue; }
    for (const x of r) console.log(`  ${t.padEnd(24)} ws${String(x.workspace_id).padStart(3)}  ${x.n} filas`);
  }

  titulo('6. MENSAJES DE WHATSAPP que el producto registró (wa_mensajes)');
  const wa = await sql`
    select column_name from information_schema.columns where table_name = 'wa_mensajes' order by ordinal_position`;
  if (!wa.length) console.log('  (ninguno)');
  console.log('  columnas: ' + wa.map((w: any) => w.column_name).join(', '));
  const wa2 = await sql`select workspace_id, count(*)::int as n, max(created_at) as ultimo from wa_mensajes group by workspace_id order by workspace_id`;
  for (const w of wa2) console.log(`  ws${String(w.workspace_id).padStart(3)}  ${String(w.n).padStart(6)} mensajes  último ${fecha(w.ultimo)}`);

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
