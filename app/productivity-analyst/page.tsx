// =============================================================================
// /productivity-analyst — qué produjo el tablero
// =============================================================================
// Los gráficos del plan: cuántas tareas activas y hechas, el avance por proyecto,
// la pirámide de prioridades y los deadlines corridos.
//
// ⚠️ ERA LA QUINTA PESTAÑA DEL TABLERO Y SE MUDÓ ACÁ EL 26/09/2026, a pedido:
// «elimina la tab de graphics y llevala al desplegable de analysts como Productivity
// Analyst». Y encaja: las otras cuatro vistas del tablero son formas de TRABAJAR el
// plan —se filtran, se ordenan, se arrastra, se escribe— y ésta no escribe una sola
// fila. Es un análisis de lo que el plan produjo, que es lo que hacen los Analysts.
//
// ⚠️ LEE EL TABLERO QUE LE TOCA A QUIEN MIRA, por `tableroActual()` — la misma
// condición que usa `/plan` para decidir qué tablero mostrarte. Elegir una tabla a
// mano acá sería el bug que Customer Success pagó el mismo día: en el workspace del
// super-admin `experimento_tareas` tiene CERO filas y todo su trabajo vive en
// `plan_tareas`, así que la pantalla habría salido vacía sin un solo error.
//
// ⚠️ Y NO MONTA `useBoard`. `GraphicsView` sólo pide `tasks` y `labels`, así que las
// filas se leen en el server y bajan como props. Montar un `useBoard` para dibujar
// gráficos sería un SEGUNDO ESCRITOR: autoguarda por dirty-set y su `saveTask` hace
// upsert de la fila entera desde el estado del navegador, así que el que tuviera el
// estado viejo pisaría al otro sin un solo error.

import { requireCapa } from '@/lib/tab-access';
import { tableroActual } from '@/lib/tablero-actual';
import { listPlanBoard } from '@/lib/plan-board';
import { listTareas, listCategorias } from '@/lib/todo';
import { toBoard, toLabel } from '../plan/board/desde-todo';
import type { BoardTask, Label } from '../plan/board/types';
import { GraphicsView } from '../plan/board/Graphics';
import { Pagina, PageHeader, ErrorState } from '@/app/_ui';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Productivity Analyst' };

export default async function ProductivityAnalystPage() {
  await requireCapa('productivity-analyst');

  // ⚠️ SI EL TABLERO NO SE PUEDE LEER, NO SE DIBUJAN GRÁFICOS EN CERO. Un plan vacío y
  // una consulta que falló se ven idénticos en un gráfico de barras, y el primero es un
  // estado real: el segundo tiene que poder decirse.
  let tasks: BoardTask[];
  let labels: Label[];
  try {
    if ((await tableroActual()) === 'dueno') {
      const b = await listPlanBoard();
      tasks = b.tareas; labels = b.proyectos;
    } else {
      const [t, c] = await Promise.all([listTareas(), listCategorias()]);
      tasks = t.map(toBoard); labels = c.map(toLabel);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No pude leer tu tablero.';
    return (
      <Pagina>
        <PageHeader titulo="Productivity Analyst" />
        <ErrorState titulo="No pude leer tu tablero" detalle={msg} detalleTecnico={msg} />
      </Pagina>
    );
  }

  return (
    <Pagina ancho="completo">
      <PageHeader titulo="Productivity Analyst" />
      <GraphicsView tasks={tasks} labels={labels} />
    </Pagina>
  );
}
