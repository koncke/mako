// =============================================================================
// El tablero de OTRO workspace, para el panel de la plataforma
// =============================================================================
// «Aun no veo el plan, las tareas y proyectos de cada cliente» (28/09/2026), sobre el
// detalle de un cliente en la vista del super admin. Sus «clientes» SON workspaces
// (Mauricio = ws1, Leila = ws11, Juanfran = ws13), así que esto cruza de inquilino.
//
// ⚠️ ES SÓLO LECTURA, Y NO ES UNA LIMITACIÓN TEMPORAL: es lo que el relevo midió. El
// tablero escribe por `fetch` DEL NAVEGADOR, y el workspace de esos fetch no sale del
// componente sino de la URL de la PESTAÑA (`WsFetch` + `proxy.ts`). Montar el tablero
// de otro workspace adentro de /customer-success deja **24 `fetch` en 11 archivos**
// —los 2 de los Repos más 22 que BoardShell dispara solo: el buscador, el dictado, la
// extracción de reuniones, las tres subidas de imagen…— apuntando al workspace del que
// MIRA. Y no fallan: `/api/plan-board` hace upsert con `onConflict: 'workspace_id,id'`,
// así que arrastrar una tarjeta del cliente le CLONA la fila al tablero del super
// admin. 200, sin error, y con la tarea duplicada en el inquilino equivocado.
//
// Por eso lo que se lee acá se dibuja sin controles de escritura, y editar es entrar al
// cliente («Inspeccionar», que ya pone el `?ws=` y hace coherentes lectura y escritura).
//
// ⚠️ Y NO ALCANZA CON ENVOLVER `filasDeTodos()` EN `runWithWorkspace`. Ése es el error
// que se escribe solo: `runWithWorkspace` mueve de qué workspace se LEE, pero no mueve
// la SESIÓN, así que el `tableroActual()` de adentro sigue contestando por quien mira
// —'dueno'— y se termina leyendo `plan_tareas` del ws13, que tiene CERO filas. Sin
// error, y con la ficha diciendo «no tiene trabajo». Acá el tablero se decide por la
// CAPA del workspace leído (`tableroDeWorkspace`).

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { tableroDeWorkspace } from './tablero-actual';
import { tablasDe } from './tablero-de-capa';
import { rowToTask, rowToLabel, type Row } from './plan-board';
import { rowTo, catRow } from './todo';
import { toBoard, toLabel } from '@/app/plan/board/desde-todo';
import type { BoardTask, Label } from '@/app/plan/board/types';

/**
 * TODO el tablero de ese workspace, EN EL MODELO DEL BOARD.
 *
 * ⚠️ LAS DOS MITADES DEVUELVEN LA MISMA FORMA, y es distinto de lo que hace Customer
 * Success. Allá el tablero del cliente viaja como FILAS (`Tarea`/`Categoria`) porque lo
 * monta `TodoBoard`, que hace la segunda conversión él mismo. Acá se montan las TABLAS
 * directo (`TablaTareas`/`TablaProyectos`), que sólo entienden `BoardTask`/`Label` — así
 * que la conversión se hace acá, para las dos.
 *
 * Costó un crash medido en el navegador: castear la fila a `BoardTask` compila
 * perfecto —los dos son objetos— y revienta al dibujar con «Cannot read properties of
 * undefined (reading 'includes')», porque una fila no tiene `labels`. Un `as` sobre dos
 * tipos que no se parecen es una afirmación, no una conversión.
 *
 * ⚠️ MAPEADO ACÁ Y NO EN LA PANTALLA, por lo mismo que en Customer Success: los mappers
 * viven en módulos con `server-only`, e importarlos desde un componente de navegador
 * arrastra su grafo entero al bundle y rompe el build.
 *
 * ⚠️ Y SIN TOPE DE FILAS A PROPÓSITO. El workspace más grande tiene 212 tareas (medido
 * el 28/09), que es una lectura chica; lo que NO se puede hacer es cortar en 1000 sin
 * decirlo, porque un tablero recortado en silencio se lee como un tablero completo.
 * Si algún día una de estas tablas pasa las 1000 filas, esto va por `leerTodo`.
 */
export type TableroAjeno = { dueno: boolean; tareas: BoardTask[]; proyectos: Label[] };

export async function tableroDeOtroWorkspace(ws: number): Promise<TableroAjeno> {
  const que = await tableroDeWorkspace(ws);
  const t = tablasDe(que);

  return runWithWorkspace(ws, async () => {
    // `getTenantDb()` adentro del `runWithWorkspace` le clava el `workspace_id` a las
    // cuatro tablas del tablero, que están en TENANT_TABLES. O sea que el corte por
    // inquilino lo sigue haciendo el mismo mecanismo de siempre: lo único que cambia es
    // cuál es el inquilino.
    const db = await getTenantDb();
    const [ps, ts] = await Promise.all([
      db.from(t.proyectos).select('*'),
      db.from(t.tareas).select('*'),
    ]);
    if (ps.error) throw new Error(`${t.proyectos}: ${ps.error.message}`);
    if (ts.error) throw new Error(`${t.tareas}: ${ts.error.message}`);

    const proyectos = (ps.data ?? []) as Record<string, unknown>[];
    const tareas = (ts.data ?? []) as Record<string, unknown>[];

    // Los dos pares de mappers, encadenados donde hace falta: el tablero del dueño va
    // de fila a modelo en un paso (`rowToTask`), y el del cliente en dos — de fila a
    // `Tarea` (`rowTo`, lib/todo.ts) y de `Tarea` al modelo (`toBoard`, desde-todo.ts).
    return que === 'dueno'
      ? { dueno: true, tareas: tareas.map((f) => rowToTask(f as Row)), proyectos: proyectos.map((p) => rowToLabel(p as Row)) }
      : { dueno: false, tareas: tareas.map((f) => toBoard(rowTo(f as never))), proyectos: proyectos.map((p) => toLabel(catRow(p as never))) };
  });
}
