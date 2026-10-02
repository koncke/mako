// =============================================================================
// probe-cuota-ws13 — qué pasó de VERDAD cuando MaKo dijo «te quedaste sin cuota»
// =============================================================================
// SOLO LEE. Contesta las cuatro preguntas que el cartel no contesta:
//   1. ¿Qué keys de IA tiene cargadas ese workspace? (nombres, nunca valores)
//   2. ¿Cuántas llamadas hizo hoy, con qué proveedor y con qué cuenta?
//   3. ¿Cuántas de esas son MARCAS DE REBOTE (429) y cuáles no?
//   4. ¿Qué quedó en el historial del grupo alrededor del cartel?
//
// Existe porque el diagnóstico del 30/09 hubo que hacerlo pegándole a la API de
// Google a mano: una fila en `anthropic_usage` ES un HTTP 200 (recordUsage corre
// después del throw), así que «cuántas veces contestó» y «cuántas veces rebotó»
// son dos preguntas distintas y sólo una se podía contestar.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-cuota-ws13.ts [ws] [horas]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const WS = Number(process.argv[2] || 13);
const HORAS = Number(process.argv[3] || 12);
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

const titulo = (t: string) => console.log(`\n${'─'.repeat(78)}\n${t}\n${'─'.repeat(78)}`);

async function main() {
  console.log(`workspace ${WS} · últimas ${HORAS} h · ahora UTC ${new Date().toISOString()}`);

  titulo('1. KEYS DE IA CARGADAS (nombres, no valores)');
  const creds = await sql`
    select clave, updated_at as created_at
      from credenciales
     where workspace_id = ${WS}
       and (clave like '%API_KEY%' or clave like '%_ACCOUNT')
     order by clave`;
  for (const c of creds) console.log(`  ${String(c.clave).padEnd(28)} ${new Date(c.created_at).toISOString().slice(0, 10)}`);
  console.log(`  → ${creds.filter((c) => !String(c.clave).endsWith('_ACCOUNT')).length} keys`);

  titulo('2. LLAMADAS DE HOY (una fila = un HTTP 200)');
  const uso = await sql`
    select provider, cuenta, feature, model, count(*) as n,
           min(created_at) as desde, max(created_at) as hasta
      from anthropic_usage
     where workspace_id = ${WS}
       and created_at > now() - (${HORAS} || ' hours')::interval
     group by provider, cuenta, feature, model
     order by max(created_at) desc`;
  if (!uso.length) console.log('  (ninguna)');
  for (const u of uso) {
    console.log(`  ${String(u.provider ?? '?').padEnd(12)} c${u.cuenta ?? '?'} ${String(u.feature).padEnd(26)} ${String(u.model).slice(0, 28).padEnd(30)} n=${String(u.n).padStart(3)}  ${new Date(u.hasta).toISOString().slice(11, 19)}`);
  }

  titulo('3. MARCAS DE REBOTE (429) — las que anota anotarRebote429');
  const rebotes = await sql`
    select provider, cuenta, model, motivo, created_at
      from anthropic_usage
     where workspace_id = ${WS}
       and created_at > now() - (${HORAS} || ' hours')::interval
       and (model like '%rebote%' or feature = 'cuota')
     order by created_at desc
     limit 40`;
  if (!rebotes.length) console.log('  (ninguna — ojo: eso NO prueba que no hubo 429)');
  for (const r of rebotes) {
    console.log(`  ${new Date(r.created_at).toISOString().slice(11, 19)} ${String(r.provider ?? '?').padEnd(12)} c${r.cuenta ?? '?'} ${String(r.motivo ?? '').slice(0, 150)}`);
  }

  titulo('4. EL TURNO EN EL GRUPO');
  const conv = await sql`
    select role, left(content, 220) as content, created_at
      from mako_doer_conv
     where workspace_id = ${WS}
       and created_at > now() - (${HORAS} || ' hours')::interval
     order by created_at desc
     limit 12`;
  for (const c of conv.reverse()) {
    console.log(`  ${new Date(c.created_at).toISOString().slice(11, 19)} ${String(c.role).padEnd(9)} ${String(c.content).replace(/\n/g, ' ⏎ ')}`);
  }

  titulo('5. TODO EL USO DE HOY, POR WORKSPACE (para comparar)');
  const todos = await sql`
    select workspace_id, provider, count(*) as n, max(created_at) as hasta
      from anthropic_usage
     where created_at > now() - (${HORAS} || ' hours')::interval
     group by workspace_id, provider
     order by workspace_id, count(*) desc`;
  for (const t of todos) {
    console.log(`  ws${String(t.workspace_id).padStart(3)} ${String(t.provider ?? '?').padEnd(12)} n=${String(t.n).padStart(4)}  último ${new Date(t.hasta).toISOString().slice(11, 19)}`);
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
