// =============================================================================
// probe-seed-tmp-ws — corre el seed REAL en un workspace desechable y lo borra
// =============================================================================
// Crea un workspace temporal (capa completo), le setea un diagnóstico distinto al
// de los clientes reales (fase 4, canal carrito) para ver el recorte en acción,
// corre seedTodoBoardSiVacio() de verdad, imprime el board resultante y borra TODO
// lo que creó. No toca ningún workspace real.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-seed-tmp-ws.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { runWithWorkspace } from '../lib/workspace';
import { seedTodoBoardSiVacio } from '../lib/todo-seeds';
import { setDiagnosticoFase } from '../lib/fase-store';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
  const slug = `tmp-probe-seed-${Date.now()}`;
  const [ws] = await sql`insert into workspaces (nombre, slug, capa) values ('TMP probe seed', ${slug}, 'completo') returning id`;
  const id = Number(ws.id);
  console.log(`workspace temporal ws${id} (${slug})`);

  try {
    await runWithWorkspace(id, async () => {
      // Negocio de carrito en fase 4: no debería recibir ni Calendly, ni Fathom, ni
      // los guiones de R1/R2, ni "Cerrar los primeros 10 clientes".
      await setDiagnosticoFase([3, 3, 3, 3, 3, 3], 'carrito');
      const cats = await seedTodoBoardSiVacio();
      console.log(`seedTodoBoardSiVacio() devolvió ${cats.length} proyectos`);
    });

    const cats = await sql`select id, nombre, prioridad, score_razon from tarea_categorias where workspace_id=${id} order by prioridad desc`;
    const tars = await sql`select titulo, progreso, categorias, historial->0->>'text' h from experimento_tareas where workspace_id=${id} order by orden`;
    console.log(`\nBOARD: ${cats.length} proyectos · ${tars.length} tareas (${tars.filter((t) => t.progreso >= 100).length} hechas)`);
    for (const c of cats) {
      console.log(`\n  P${c.prioridad} · ${c.nombre}`);
      for (const t of tars.filter((x) => (x.categorias as number[]).includes(Number(c.id)))) {
        console.log(`     ${t.progreso >= 100 ? '✓' : '·'} ${t.titulo}`);
      }
    }
    const huerfanas = tars.filter((t) => !(t.categorias as number[]).length);
    console.log(`\ntareas sin proyecto: ${huerfanas.length}${huerfanas.length ? ' ← BUG' : ' ✓'}`);
  } finally {
    const t = await sql`delete from experimento_tareas where workspace_id=${id}`;
    const c = await sql`delete from tarea_categorias where workspace_id=${id}`;
    const s = await sql`delete from app_settings where workspace_id=${id}`;
    await sql`delete from workspaces where id=${id}`;
    console.log(`\nlimpieza: ${t.count} tareas, ${c.count} proyectos, ${s.count} settings y el workspace ws${id} borrados`);
  }
}

main().then(() => sql.end()).then(() => process.exit(0)).catch(async (e) => { console.error('ERROR:', e); await sql.end(); process.exit(1); });
