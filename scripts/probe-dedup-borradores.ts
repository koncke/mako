// =============================================================================
// probe-dedup-borradores — cuánto caza cada criterio contra los borradores reales
// =============================================================================
// SOLO LEE. Compara los borradores pendientes de un workspace contra su tablero y
// contra los OTROS borradores, con los dos criterios: `mismaTarea` (el que
// DESCARTA) y `pareceLaMisma` (el que solo MARCA).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-dedup-borradores.ts <ws>
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { mismaTarea, pareceLaMisma } from '../lib/tareas-dedup';

const WS = Number(process.argv[2] || 1);
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

type T = { titulo: string; esDeOtro?: boolean; dueno?: string };

async function main() {
  const props = await sql`select id, fuente_titulo, ref, tareas from plan_propuestas where workspace_id=${WS} and estado='pendiente' order by created_at`;
  const abiertas = WS === 9
    ? (await sql`select title as t from plan_tareas where workspace_id=${WS} and progress < 100`).map((r) => String(r.t))
    : (await sql`select titulo as t from experimento_tareas where workspace_id=${WS} and progreso < 100`).map((r) => String(r.t));
  console.log(`ws${WS}: ${props.length} borrador(es) pendiente(s) · ${abiertas.length} tareas abiertas en el tablero\n`);

  const vistas: string[] = [];
  for (const p of props) {
    const tareas = (typeof p.tareas === 'string' ? JSON.parse(p.tareas) : p.tareas) as T[];
    const mias = tareas.filter((t) => !t.esDeOtro);
    let descarta = 0, marca = 0, marcaPorOtro = 0;
    const ejemplos: string[] = [];
    for (const t of mias) {
      const enBoard = abiertas.find((x) => mismaTarea(x, t.titulo));
      if (enBoard) { descarta++; continue; }
      const parecida = abiertas.find((x) => pareceLaMisma(x, t.titulo).si);
      if (parecida) { marca++; if (ejemplos.length < 3) ejemplos.push(`«${t.titulo.slice(0, 52)}» ≈ «${parecida.slice(0, 52)}»`); continue; }
      const enOtro = vistas.find((x) => pareceLaMisma(x, t.titulo).si);
      if (enOtro) { marcaPorOtro++; if (ejemplos.length < 3) ejemplos.push(`«${t.titulo.slice(0, 52)}» ≈ (otro borrador) «${enOtro.slice(0, 52)}»`); }
    }
    console.log(`«${p.fuente_titulo}» (${p.ref}) — ${tareas.length} tareas, ${mias.length} tuyas`);
    console.log(`   descarta el server: ${descarta} · marca contra el tablero: ${marca} · marca contra otro borrador: ${marcaPorOtro}`);
    for (const e of ejemplos) console.log(`     · ${e}`);
    vistas.push(...mias.map((t) => t.titulo));
  }
}

main().then(() => sql.end()).then(() => process.exit(0)).catch(async (e) => { console.error('ERROR:', e); await sql.end(); process.exit(1); });
