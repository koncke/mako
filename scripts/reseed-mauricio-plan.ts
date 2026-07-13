// =============================================================================
// reseed-mauricio-plan — reemplaza el board /plan de Mauricio (ws1) por los
// PROYECTOS FINITOS + tareas, marcando hechas las que ya tiene. One-off.
//   node --import tsx scripts/reseed-mauricio-plan.ts
// Usa el cliente postgres directo (no getTenantDb) para no arrastrar server-only.
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import { SEED_CATEGORIAS, buildCatRows, buildTarRows } from '../lib/todo-seeds-data';

const WS = 1; // Mauricio

const conn = process.env.DATABASE_URL;
if (!conn) { console.error('Falta DATABASE_URL'); process.exit(1); }
const sql = postgres(conn, { ssl: 'require', max: 1 });

async function main() {
  const [{ n }] = await sql`select count(*)::int as n from leads`;
  if (n < 50) { console.error(`leads<50 (${n}) — proyecto sospechoso, aborto`); process.exit(1); }

  // 1) Borrar el board viejo de ws1 (tareas primero por si hubiera FKs).
  const delT = await sql`delete from experimento_tareas where workspace_id = ${WS}`;
  const delC = await sql`delete from tarea_categorias where workspace_id = ${WS}`;
  console.log(`✓ Limpiado ws${WS}: ${delC.count} proyectos, ${delT.count} tareas borradas`);

  // 2) Insertar los proyectos finitos y mapear key → id.
  const now = Date.now();
  const { filas: filasCat, deadlinePorKey } = buildCatRows(now);
  const idPorKey = new Map<string, number>();
  for (let i = 0; i < filasCat.length; i++) {
    const f = filasCat[i];
    const [row] = await sql`
      insert into tarea_categorias (workspace_id, nombre, color, emoji, prioridad, score_razon, deadline, detalle, historial)
      values (${WS}, ${f.nombre}, ${f.color}, ${f.emoji}, ${f.prioridad}, ${f.score_razon}, ${f.deadline}, ${f.detalle}, ${sql.json(f.historial)})
      returning id`;
    idPorKey.set(SEED_CATEGORIAS[i].key, Number(row.id));
  }
  console.log(`✓ ${filasCat.length} proyectos finitos insertados`);

  // 3) Insertar las tareas (con lo hecho de Mauricio marcado).
  const filasTar = buildTarRows(now, true, idPorKey, deadlinePorKey);
  let hechas = 0;
  for (const t of filasTar) {
    if (t.progreso >= 100) hechas++;
    await sql`
      insert into experimento_tareas
        (workspace_id, titulo, detalle, estado, prioridad, progreso, deadline, categorias, checklist, historial, en_prioridad, score, score_razon, origen, experimento_id, retro_id, orden, hecho_at, updated_at)
      values
        (${WS}, ${t.titulo}, ${t.detalle}, ${t.estado}, ${t.prioridad}, ${t.progreso}, ${t.deadline}, ${sql.json(t.categorias)}, ${sql.json(t.checklist)}, ${sql.json(t.historial)}, ${t.en_prioridad}, ${t.score}, ${t.score_razon}, ${t.origen}, ${t.experimento_id}, ${t.retro_id}, ${t.orden}, ${t.hecho_at}, ${t.updated_at})`;
  }
  console.log(`✓ ${filasTar.length} tareas insertadas (${hechas} marcadas hechas)`);

  // 4) Verificar.
  const cats = await sql`select nombre, prioridad, deadline from tarea_categorias where workspace_id = ${WS} order by prioridad desc`;
  console.log('Proyectos:', cats.map((c) => `${c.nombre} (P${c.prioridad}, ${c.deadline})`).join(' · '));
}

main().then(() => sql.end()).then(() => { console.log('LISTO'); process.exit(0); })
  .catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
