// =============================================================================
// barrido-dump — la foto del tablero antes de reescribir nada
// =============================================================================
// Vuelca a un JSON todo lo que hace falta para reescribir los detalles A MANO (desde
// Claude Code, sin gastar una llamada de IA): la tarea, su detalle actual, su proyecto,
// de qué origen vino, y —lo importante— EL MATERIAL del que salió.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/barrido-dump.ts <carpeta>
//
// El material sale de dos lados:
//   · plan_propuestas: el borrador del que se aplicó la tarea. Ahí está el detalle
//     ORIGINAL que escribió la extracción, que muchas veces es más rico que el que
//     quedó en el tablero, más el título de la reunión y su fecha.
//   · el historial de la tarea: quién la creó, cuándo y desde dónde.
//
// NO escribe nada. Es solo la foto.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { writeFileSync } from 'node:fs';
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { leerTodo } from '../lib/supabase-paginado';
import { evaluarDetalle } from '../lib/detalle-contrato';

const SALIDA = process.argv[2] || '.';
const WSS = [9, 1, 11];   // dueño, Mauricio, Leila

type Row = Record<string, unknown>;
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * PostgREST corta en 1000 filas pase lo que pase: hay que paginar
 * (lib/supabase-paginado.ts). El bucle que había acá lo hacía SIN ORDER BY, así
 * que en un tablero de más de 1000 tareas la foto podía traer tareas repetidas y
 * perder otras — y esta foto es justamente lo que se usa para reescribir los
 * detalles a mano: lo que no aparece acá, no se reescribe nunca.
 *
 * Las cuatro tablas (plan_tareas, experimento_tareas, plan_proyectos,
 * plan_propuestas) tienen `id` y es único DENTRO del workspace, que es el único
 * ámbito que ve el cliente de getTenantDb(). Alcanza como orden estable.
 */
async function todas(db: Awaited<ReturnType<typeof getTenantDb>>, tabla: string, cols: string): Promise<Row[]> {
  return leerTodo<Row>(db, tabla, cols);
}

async function main() {
  const todo: Record<string, unknown> = {};

  for (const ws of WSS) {
    await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const tabla = ws === 9 ? 'plan_tareas' : 'experimento_tareas';
      const tablaP = ws === 9 ? 'plan_proyectos' : null;

      const tareas = await todas(db, tabla, '*');
      const proys = tablaP ? await todas(db, tablaP, 'id, pid, name, emoji, detalle') : [];
      const props = await todas(db, 'plan_propuestas', 'id, estado, origen, ref, resumen, tareas, aplicadas, fuente_titulo, fuente_fecha, fuente_url, created_at');

      // El detalle ORIGINAL de cada tarea, por título normalizado: si la extracción
      // escribió algo rico y el tablero se quedó con la versión pobre, acá está.
      const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const material = new Map<string, Array<Record<string, unknown>>>();
      for (const p of props) {
        for (const t of arr<Record<string, unknown>>(p.tareas)) {
          const k = norm(str(t.titulo));
          if (!k) continue;
          const l = material.get(k) ?? [];
          l.push({
            detalle: str(t.detalle),
            proyecto: str(t.proyecto),
            origen: str(p.origen),
            fuente: str(p.fuente_titulo),
            fecha: str(p.fuente_fecha) || str(p.created_at).slice(0, 10),
            url: str(p.fuente_url),
            ref: str(p.ref),
            resumen: str(p.resumen),
          });
          material.set(k, l);
        }
      }

      const filas = tareas.map((t) => {
        const titulo = str(t.titulo ?? t.title ?? t.texto);
        const detalle = str(t.detalle);
        const ev = evaluarDetalle(detalle);
        const mat = material.get(norm(titulo)) ?? [];
        const labels = arr<string>(t.labels).map(String);
        return {
          id: str(t.id),
          pid: str(t.pid),
          titulo,
          detalle,
          chars: ev.chars,
          partes: ev.partes.length,
          conForma: ev.conForma,
          proyectoIds: labels,
          proyecto: labels.map((l) => str((proys.find((p) => str(p.id) === l) ?? {}).name)).filter(Boolean).join(' + '),
          // OJO: los dos tableros marcan lo hecho distinto. El del dueño usa `done`;
          // el de los clientes usa `progreso` y el del dueño la columna `progress`. Mirar solo `done`
          // contaba como ABIERTAS 30 tareas de Mauricio que ya estaban al 100%.
          hecha: !!t.done || str(t.estado) === 'hecha' || Number(t.progreso ?? t.progress ?? 0) >= 100,
          fuente: t.fuente ?? null,
          historial: arr<Record<string, unknown>>(t.historial).map((h) => str(h.text)).slice(0, 4),
          material: mat,
        };
      });

      const conMat = filas.filter((f) => f.material.some((m) => str(m.detalle).length > f.chars + 100));
      todo[`ws${ws}`] = {
        proyectos: proys.map((p) => ({ id: str(p.id), pid: str(p.pid), name: str(p.name), emoji: str(p.emoji), detalle: str(p.detalle) })),
        tareas: filas,
      };
      console.log(`  ws ${ws}: ${filas.length} tareas · ${filas.filter((f) => f.conForma).length} ya con forma · ${conMat.length} con material más rico en un borrador · ${filas.filter((f) => f.chars < 120).length} con detalle casi vacío`);
    });
  }

  const ruta = `${SALIDA}/barrido.json`;
  writeFileSync(ruta, JSON.stringify(todo, null, 1));
  console.log(`\n  → ${ruta}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
