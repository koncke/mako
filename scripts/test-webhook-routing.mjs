// =============================================================================
// test-webhook-routing — que un cliente NO pueda secuestrarle los webhooks a otro
// =============================================================================
//   node scripts/test-webhook-routing.mjs
//
// Corre contra la base REAL y es seguro: el fix consiste justamente en NO
// escribir. Las filas de prueba se limpian al final.
//
// webhook-routing.ts trae 'server-only' (no se importa fuera de Next), así que se
// replica EXACTO su SQL: INSERT ... ON CONFLICT DO NOTHING + leer quién quedó
// dueño. La garantía vive en la base, y es eso lo que se prueba.
//
// OJO: el driver crudo devuelve BIGINT como string; supabase-js lo da como
// número. Por eso el Number() de abajo y el del código.
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local'), quiet: true });

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 3 });

// Mismo algoritmo que upsertRouting: reclama, y después mira quién quedó.
async function reclamar(servicio, ident, ws) {
  await sql`insert into webhook_routing (servicio, identificador, workspace_id, created_at)
            values (${servicio}, ${ident}, ${ws}, now())
            on conflict (servicio, identificador) do nothing`;
  const r = await sql`select workspace_id from webhook_routing
                      where servicio = ${servicio} and identificador = ${ident}`;
  const dueno = r[0]?.workspace_id == null ? null : Number(r[0].workspace_id); // el driver crudo da BIGINT como string
  return dueno === ws ? 'ok' : 'ocupado';
}

let n = 0;
const ok = (t) => { n++; console.log(`  ✓ ${t}`); };
const IDENT = 'prueba-162-' + process.pid;

try {
  // ── EL ATAQUE: ws3 intenta secuestrar el META_PAGE_ID real de ws1 ──────────
  const real = await sql`select identificador, workspace_id from webhook_routing
                         where servicio = 'meta' limit 1`;
  if (real.length) {
    const { identificador, workspace_id } = real[0];
    console.log(`  (usando el identificador real de meta, hoy del ws ${workspace_id})`);
    const r = await reclamar('meta', identificador, 999);
    if (r !== 'ocupado') throw new Error('¡SECUESTRO EXITOSO! el fix no funciona');
    ok('un ws ajeno NO puede reclamar el identificador de meta de otro');

    const despues = await sql`select workspace_id from webhook_routing
                              where servicio = 'meta' and identificador = ${identificador}`;
    if (despues[0].workspace_id !== workspace_id) throw new Error('¡lo pisó igual!');
    ok(`el dueño sigue siendo el ws ${workspace_id} — no se tocó nada`);
  } else {
    console.log('  (no hay filas de meta; se salta el caso real)');
  }

  // ── primer reclamante gana ────────────────────────────────────────────────
  const a = await reclamar('meta', IDENT, 1);
  if (a !== 'ok') throw new Error('el primero debería poder reclamar');
  ok('el primero en reclamar un identificador libre lo obtiene');

  const b = await reclamar('meta', IDENT, 2);
  if (b !== 'ocupado') throw new Error('el segundo NO debería poder');
  ok('el segundo recibe "ocupado" y no lo pisa');

  const c = await reclamar('meta', IDENT, 1);
  if (c !== 'ok') throw new Error('el dueño debería poder re-guardar lo suyo');
  ok('el dueño puede re-guardar su propio identificador (idempotente)');

  // ── carrera: 5 workspaces a la vez sobre un identificador libre ───────────
  const IDENT2 = IDENT + '-carrera';
  const res = await Promise.all([1, 2, 3, 4, 5].map((ws) => reclamar('meta', IDENT2, ws)));
  const ganadores = res.filter((x) => x === 'ok').length;
  if (ganadores !== 1) throw new Error(`ganaron ${ganadores}, tiene que ganar exactamente 1`);
  ok('en una carrera de 5 simultáneos gana EXACTAMENTE uno');

  console.log(`\n${n}/${n} OK — la tarea #162 está cerrada`);
} finally {
  await sql`delete from webhook_routing where identificador like ${'prueba-162-%'}`;
  console.log('(limpiadas las filas de prueba)');
  await sql.end({ timeout: 5 });
}
