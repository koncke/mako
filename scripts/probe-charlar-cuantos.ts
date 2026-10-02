// =============================================================================
// probe-charlar-cuantos — cuántos mensajes reales caen en la intención SIN tools
// =============================================================================
// SOLO LEE. `charlar` es la ÚNICA intención del CONTRATO con `tools: []`
// (lib/mako-intencion.ts), y el doer llama igual a `chatCheapTools` con esa lista
// vacía. Esto mide cuántos mensajes de verdad pasan por ahí — o sea el radio del
// bug, en vez de estimarlo.
//
// La intención no se guarda en ninguna tabla, así que se vuelve a clasificar el
// texto con el MISMO clasificador que corre en producción. Es una aproximación en
// un punto: `ctx.hayPendientes` no se puede reconstruir, y sin él «sí, dale» cae
// en `charlar` en vez de `confirmar` — así que el número de `charlar` es un TECHO.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-charlar-cuantos.ts [dias]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { clasificarIntencion, CONTRATO } from '../lib/mako-intencion';

const DIAS = Number(process.argv[2] || 60);
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
  const filas = await sql`
    select workspace_id, content, created_at
      from mako_doer_conv
     where role = 'user'
       and created_at > now() - (${DIAS} || ' days')::interval
     order by created_at`;

  console.log(`${filas.length} mensajes de personas en ${DIAS} días\n`);

  const porIntencion = new Map<string, number>();
  const charlar: Array<{ ws: number; txt: string; cuando: string }> = [];
  for (const f of filas) {
    const v = clasificarIntencion(String(f.content ?? ''));
    const k = v.dudosa ? `${v.intencion} (dudosa)` : v.intencion;
    porIntencion.set(k, (porIntencion.get(k) ?? 0) + 1);
    if (v.intencion === 'charlar') {
      charlar.push({ ws: Number(f.workspace_id), txt: String(f.content ?? '').slice(0, 70), cuando: new Date(f.created_at as string).toISOString().slice(5, 16) });
    }
  }

  console.log('─'.repeat(78));
  console.log('INTENCIÓN · cuántas tools ve el modelo · cuántos mensajes');
  console.log('─'.repeat(78));
  for (const [k, n] of [...porIntencion].sort((a, b) => b[1] - a[1])) {
    const base = k.replace(' (dudosa)', '') as keyof typeof CONTRATO;
    const t = CONTRATO[base]?.tools;
    const cuantas = t === null ? 'TODAS' : t.length === 0 ? '⚠️ NINGUNA' : String(t.length);
    const pct = Math.round((n / filas.length) * 100);
    console.log(`  ${k.padEnd(22)} ${cuantas.padStart(11)}   ${String(n).padStart(4)}  (${String(pct).padStart(2)}%)`);
  }

  console.log(`\n${'─'.repeat(78)}`);
  console.log(`LOS QUE VAN CON LA LISTA VACÍA (${charlar.length} de ${filas.length})`);
  console.log('─'.repeat(78));
  for (const c of charlar.slice(-45)) {
    console.log(`  ${c.cuando} ws${String(c.ws).padStart(3)}  ${c.txt.replace(/\n/g, ' ⏎ ')}`);
  }

  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
