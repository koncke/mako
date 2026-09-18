// =============================================================================
// limpiar-seed-clientes — sacar del tablero de un cliente lo que nunca le tocaba
// =============================================================================
// Sin --apply solo IMPRIME. Con --apply borra, y antes guarda TODO lo borrado en
// app_settings (mako.backup.borradas.<fecha>), fila entera, para poder reponerlo.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/limpiar-seed-clientes.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/limpiar-seed-clientes.ts --apply
//
// EL PORQUÉ, que no es «el template estaba mal» sino un bug concreto:
// `seedRelevante` (lib/todo-seeds-data.ts:159) filtra los proyectos con
// `fase >= (faseMin ?? 1)`. Con **fase 0** ningún proyecto pasa el filtro, y la línea 164
// tiene un fallback que en ese caso devuelve TODO el seed: los 40. O sea que el cliente
// que todavía no arrancó —el que MENOS tareas debería ver— recibe la lista completa,
// incluidas las de escalar una campaña ganadora que no tiene.
//
// Leila está en fase 0 y por eso arrancó con 31 tareas de plantilla.
//
// QUÉ SE BORRA, y nada más que esto:
//  1. Tareas del SEED (título exacto del catálogo), ABIERTAS, cuyo proyecto NO
//     corresponde a la fase del cliente. Nunca una tarea que él escribió o que salió de
//     una reunión: esas no son del template aunque estén abiertas hace meses.
//  2. Proyectos VACÍOS del seed: sin una sola tarea, ni hecha ni abierta.
//
// QUÉ NO SE BORRA:
//  · Nada que esté hecho. El historial es del cliente, no nuestro.
//  · Nada con `origen` distinto de 'mako'.
//  · Los proyectos «Cliente: X» aunque estén vacíos SI tienen tareas hechas — son
//     cuentas reales del cliente. Los vacíos del todo se listan aparte para decidir.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { setSetting } from '../lib/settings';
import { getDiagnosticoFase } from '../lib/fase-store';
import { SEED_TAREAS, SEED_CATEGORIAS } from '../lib/todo-seeds-data';
import { leerTodo } from '../lib/supabase-paginado';

const APLICAR = process.argv.includes('--apply');
const WSS = [1, 11];

type Row = Record<string, unknown>;
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const num = (v: unknown): number => Number(v ?? 0);

/** Qué categorías del seed corresponden a una fase. Es la MISMA regla que `seedRelevante`
 *  pero SIN el fallback que rompe con fase 0 — acá una fase temprana significa MENOS
 *  proyectos, que es lo que el fallback invierte. */
const catsDeFase = (fase: number): Set<string> => new Set(
  SEED_CATEGORIAS.filter((c) => {
    const min = c.faseMin ?? 1;
    const max = c.faseMax ?? 5;
    // fase 0 = todavía no arrancó: le corresponde lo mismo que a la fase 1.
    const f = Math.max(1, fase);
    return f >= min && f <= max;
  }).map((c) => c.key),
);

async function main() {
  const backup: Array<{ ws: number; tipo: 'tarea' | 'proyecto'; fila: Row }> = [];
  let borradas = 0, borrados = 0;

  for (const ws of WSS) {
    await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const f = await getDiagnosticoFase().catch(() => null) as Record<string, unknown> | null;
      const fase = Number(f?.fase ?? 1);
      const cats = catsDeFase(fase);

      // Paginado: era `.range(0, 999)` sin orden. Este script BORRA según lo que lee, y
      // una tarea que cae del corte no entra en `usados` → su proyecto se toma por vacío
      // y se borra teniendo tareas. Hoy son 212 en ws1; el techo no avisa cuando llega.
      const tareas = await leerTodo<Row>(db, 'experimento_tareas', '*', { orden: 'id' });
      const { data: cRows } = await db.from('tarea_categorias').select('*');
      const proys = (cRows ?? []) as Row[];

      const seedPorTitulo = new Map(SEED_TAREAS.map((t) => [t.titulo, t] as const));

      console.log(`\n═══ ws ${ws} · fase ${fase} · le corresponden: ${[...cats].join(', ')}`);

      // ── 1. Tareas del seed fuera de fase, abiertas
      const fuera = tareas.filter((t) => {
        if (num(t.progreso) >= 100) return false;                    // hecho no se toca
        if (str(t.origen) !== 'mako') return false;                   // no es del template
        const seed = seedPorTitulo.get(str(t.titulo));
        return !!seed && !cats.has(seed.cat);
      });
      console.log(`  ${fuera.length} tareas de plantilla que no corresponden a su fase:`);
      for (const t of fuera) console.log(`     [${seedPorTitulo.get(str(t.titulo))!.cat}] ${str(t.titulo)}`);

      // ── 2. Proyectos vacíos
      const usados = new Set<number>();
      for (const t of tareas) for (const c of (Array.isArray(t.categorias) ? t.categorias : [])) usados.add(Number(c));
      const vacios = proys.filter((p) => !usados.has(Number(p.id)));
      console.log(`  ${vacios.length} proyectos sin una sola tarea:`);
      for (const p of vacios) console.log(`     ${str(p.nombre)}`);

      if (!APLICAR) return;

      for (const t of fuera) { backup.push({ ws, tipo: 'tarea', fila: t }); }
      for (const p of vacios) { backup.push({ ws, tipo: 'proyecto', fila: p }); }

      if (fuera.length) {
        const { error } = await db.from('experimento_tareas').delete().in('id', fuera.map((t) => str(t.id)));
        if (error) console.error(`  ✗ tareas: ${error.message}`); else borradas += fuera.length;
      }
      if (vacios.length) {
        const { error } = await db.from('tarea_categorias').delete().in('id', vacios.map((p) => Number(p.id)));
        if (error) console.error(`  ✗ proyectos: ${error.message}`); else borrados += vacios.length;
      }
    });
  }

  if (APLICAR && backup.length) {
    // La fila ENTERA, no solo el id: reponer una tarea necesita su detalle, su checklist
    // y su historial. Un backup de ids es un backup que no sirve.
    const key = `mako.backup.borradas.${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;
    await runWithWorkspace(9, () => setSetting(key, JSON.stringify(backup)));
    console.log(`\n  ✓ backup COMPLETO de ${backup.length} filas → app_settings/${key}`);
  }
  console.log(`\n  ${borradas} tareas · ${borrados} proyectos ${APLICAR ? 'borrados' : 'a borrar (dry-run: agregá --apply)'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
