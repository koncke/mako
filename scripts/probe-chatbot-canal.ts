// =============================================================================
// probe-chatbot-canal — por dónde SALE hoy el Chatbot, medido
// =============================================================================
// SOLO LEE. Leila pidió el 01/10 que el Chatbot del 7/10 se dispare desde el CRM
// (etapa o tag) y que maneje las etiquetas de WhatsApp; y dejó abierto que «el
// número recién comprado no tiene historial». Antes de diseñar, hay que saber qué
// líneas hay, de quién son y cuál contestó alguna vez.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-chatbot-canal.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
const titulo = (t: string) => console.log(`\n${'─'.repeat(74)}\n${t}\n${'─'.repeat(74)}`);

async function existe(t: string) {
  const r = await sql`select 1 from information_schema.tables where table_name = ${t} limit 1`;
  return r.length > 0;
}

async function main() {
  titulo('A. TELÉFONOS declarados por workspace');
  for (const t of ['workspace_telefonos', 'telefonos_workspace', 'wa_numeros']) {
    if (!(await existe(t))) { console.log(`  ${t}: no existe`); continue; }
    const r = await sql`select * from ${sql(t)} order by workspace_id limit 30`;
    console.log(`  ${t}: ${r.length} filas`);
    for (const x of r) console.log('    ' + JSON.stringify(x).slice(0, 240));
  }

  titulo('B. ¿Qué workspaces tienen el CHATBOT configurado? (app_settings)');
  const st = await sql`
    select workspace_id, key, length(value::text) as largo, updated_at
      from app_settings
     where key like '%chatbot%' or key like '%setting%' or key like '%agente%'
     order by workspace_id, key`;
  if (!st.length) console.log('  (ninguna clave)');
  for (const s of st) console.log(`  ws${String(s.workspace_id).padStart(3)}  ${String(s.key).padEnd(34)} ${String(s.largo).padStart(6)} chars  ${String(s.updated_at).slice(0, 16)}`);

  titulo('C. ETIQUETAS de WhatsApp que ya existen (evolution_labels)');
  const cols = await sql`select column_name from information_schema.columns where table_name = 'evolution_labels' order by ordinal_position`;
  console.log('  columnas: ' + cols.map((c: any) => c.column_name).join(', '));
  const lb = await sql`select * from evolution_labels order by workspace_id limit 40`;
  for (const l of lb) console.log('    ' + JSON.stringify(l).slice(0, 200));

  titulo('D. ETAPAS del CRM por workspace — los disparadores que pidió Leila');
  const tablas = await sql`select table_name from information_schema.tables where table_name like '%etapa%' or table_name like '%funnel%' order by table_name`;
  console.log('  tablas: ' + tablas.map((t: any) => t.table_name).join(', '));
  const lead = await sql`select workspace_id, etapa, count(*)::int as n from leads group by workspace_id, etapa order by workspace_id, count(*) desc`;
  for (const l of lead) console.log(`  ws${String(l.workspace_id).padStart(3)}  ${String(l.etapa ?? '—').padEnd(26)} ${String(l.n).padStart(5)} leads`);

  await sql.end();
}

main().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
