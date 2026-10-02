// =============================================================================
// probe-cartel-frecuencia — ¿«cada 2 mensajes»? Cuántas veces salió el cartel
// =============================================================================
// SOLO LEE. Martín: «es un producto totalmente defectuoso que MaKo cada 2 mensajes
// te diga esto». Esto lo mide en vez de estimarlo.
//
// Se puede contestar porque hasta el 30/09/2026 el cartel de fallo se guardaba en
// `mako_doer_conv` como un turno `assistant` — que es el bug que se arregló ayer
// (de ahí salía el «Ya estoy de vuelta»). O sea que la tabla tiene la historia
// completa hasta ese día, y desde ayer deja de tenerla: este número es un PISO y
// no se va a poder volver a medir así.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-cartel-frecuencia.ts [dias]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';

const DIAS = Number(process.argv[2] || 60);
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

const titulo = (t: string) => console.log(`\n${'─'.repeat(78)}\n${t}\n${'─'.repeat(78)}`);

/** Las cuatro familias de cartel, por su primera frase (lib/fallo-ia-texto.ts). */
const CARTELES: Array<[string, string]> = [
  ['sin_cuota', '%sin cuota de IA%'],
  ['sin_cuota_varias', '%me rebotaron por límite%'],
  ['sin_keys', '%todavía no cargaste ninguna API key%'],
  ['sin_respaldo', '%proveedor de IA se cayó justo ahora%'],
  ['proveedor_caido', '%los proveedores de IA están con problemas%'],
  ['no_pude', '%No pude %'],
];

async function main() {
  console.log(`últimos ${DIAS} días · ahora UTC ${new Date().toISOString()}`);

  titulo('1. TURNOS DE MaKo QUE SON UN CARTEL DE FALLO (por familia)');
  for (const [nombre, patron] of CARTELES) {
    const r = await sql`
      select count(*)::int as n, count(distinct workspace_id)::int as ws, max(created_at) as ultimo
        from mako_doer_conv
       where role = 'assistant'
         and created_at > now() - (${DIAS} || ' days')::interval
         and content ilike ${patron}`;
    const f = r[0];
    console.log(`  ${nombre.padEnd(18)} n=${String(f.n).padStart(4)}  ws=${f.ws}  último ${f.ultimo ? new Date(f.ultimo as string).toISOString().slice(0, 16) : '—'}`);
  }

  titulo('2. LA TASA: de cada 100 turnos de MaKo, cuántos son un cartel');
  const tasa = await sql`
    select workspace_id,
           count(*) filter (where role = 'assistant')::int as dijo,
           count(*) filter (where role = 'assistant' and (
             content ilike '%sin cuota de IA%' or content ilike '%me rebotaron por límite%'
             or content ilike '%todavía no cargaste ninguna API key%'
             or content ilike '%proveedor de IA se cayó justo ahora%'
             or content ilike '%los proveedores de IA están con problemas%'))::int as carteles,
           count(*) filter (where role = 'user')::int as le_escribieron
      from mako_doer_conv
     where created_at > now() - (${DIAS} || ' days')::interval
     group by workspace_id
     order by workspace_id`;
  for (const t of tasa) {
    const pct = t.dijo ? Math.round((Number(t.carteles) / Number(t.dijo)) * 100) : 0;
    console.log(`  ws${String(t.workspace_id).padStart(3)}  le escribieron ${String(t.le_escribieron).padStart(4)} · contestó ${String(t.dijo).padStart(4)} · carteles ${String(t.carteles).padStart(3)}  (${String(pct).padStart(3)}%)`);
  }

  titulo('3. POR DÍA, el último mes (para ver si empeoró)');
  const dia = await sql`
    select date_trunc('day', created_at)::date as d,
           count(*) filter (where role = 'assistant')::int as dijo,
           count(*) filter (where role = 'assistant' and (
             content ilike '%sin cuota de IA%' or content ilike '%me rebotaron por límite%'
             or content ilike '%proveedor de IA se cayó justo ahora%'
             or content ilike '%los proveedores de IA están con problemas%'))::int as carteles
      from mako_doer_conv
     where created_at > now() - interval '30 days'
     group by 1 order by 1`;
  for (const d of dia) {
    const n = Number(d.carteles);
    console.log(`  ${String(d.d).slice(0, 10)}  contestó ${String(d.dijo).padStart(3)} · carteles ${String(n).padStart(2)} ${'▇'.repeat(n)}`);
  }

  titulo('4. QUÉ LE ESCRIBIERON JUSTO ANTES de cada cartel (la intención real)');
  const antes = await sql`
    with carteles as (
      select workspace_id, grupo_jid, created_at
        from mako_doer_conv
       where role = 'assistant'
         and created_at > now() - (${DIAS} || ' days')::interval
         and (content ilike '%sin cuota de IA%' or content ilike '%me rebotaron por límite%'
              or content ilike '%proveedor de IA se cayó justo ahora%'
              or content ilike '%los proveedores de IA están con problemas%')
    )
    select c.created_at, c.workspace_id, (
      select left(u.content, 90) from mako_doer_conv u
       where u.grupo_jid = c.grupo_jid and u.role = 'user' and u.created_at < c.created_at
       order by u.created_at desc limit 1) as pregunta
      from carteles c
     order by c.created_at desc
     limit 40`;
  for (const a of antes) {
    console.log(`  ${new Date(a.created_at as string).toISOString().slice(5, 16)} ws${String(a.workspace_id).padStart(3)}  ${String(a.pregunta ?? '(nada antes)').replace(/\n/g, ' ⏎ ')}`);
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
