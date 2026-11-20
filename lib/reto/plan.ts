// =============================================================================
// EL RETO EN EL PLAN — lo que toca la base (20/11/2026, auditoría d24-22)
// =============================================================================
// Las reglas viven en ./plan-reglas.ts. Acá, el proyecto y sus tareas, por las MISMAS funciones del Plan que usa el Marketing CoPilot
// (lib/copiloto/tareas-plan.ts): `crearCategoria` (el proyecto), `crearTarea` (una por día, con su `fuente`) y `moverTarea(id, 'hecho')`
// para cerrarlas, que respeta las reglas del kanban. El Plan no se toca (el Cerebro, 20/11).
// Sólo el tablero de los clientes (`experimento_tareas`, lib/todo.ts): el reto es de quien prueba MaKo, no del dueño de la plataforma.
// =============================================================================
import 'server-only';
import { getWorkspace, runWithWorkspace } from '@/lib/workspace';
import { tableroDeCapa } from '@/lib/tablero-de-capa';
import { crearCategoria, crearTarea, listCategorias, listTareas, moverTarea } from '@/lib/todo';
import { DIAS_RETO, type DiaReto, type EstadoReto } from './dias';
import { COLOR_RETO, EMOJI_RETO, FUENTE_RETO, PROYECTO_RETO, diaDeLaUrl, planDelReto, tareasDelRetoParaElPlan, type TareaRetoEnPlan } from './plan-reglas';

/** ¿El reto de este negocio va a su Plan? Sólo con el tablero de los clientes (el del dueño es el de la plataforma). */
export async function elRetoVaAlPlan(ws: number): Promise<boolean> {
  return tableroDeCapa((await getWorkspace(ws))?.capa) !== 'dueno';
}

/**
 * Deja el reto al día en el Plan: crea lo que falta (el proyecto y la tarea de cada día) y cierra los días que MaKo ya leyó hechos.
 * Devuelve si el reto está en el Plan (false: el tablero del dueño, o no se pudo).
 */
export async function sincronizarRetoConElPlan(ws: number, e: EstadoReto, dias: readonly DiaReto[] = DIAS_RETO): Promise<boolean> {
  return runWithWorkspace(ws, async () => {
    if (!(await elRetoVaAlPlan(ws))) return false;
    const enPlan: TareaRetoEnPlan[] = [];
    for (const t of await listTareas()) {
      if (t.fuente?.tipo !== FUENTE_RETO) continue;
      const dia = diaDeLaUrl(t.fuente.url);
      if (dia != null) enPlan.push({ dia, id: String(t.id), hecha: t.estado === 'hecho' });
    }
    const { crear, cerrar } = planDelReto(dias, e, enPlan);
    if (crear.length) {
      const cat = (await listCategorias()).find((c) => c.nombre === PROYECTO_RETO) ?? (await crearCategoria(PROYECTO_RETO, COLOR_RETO, EMOJI_RETO));
      // Cada tarea nueva nace arriba de su columna: se crean del 7 al 1, así el día 1 queda primero.
      for (const x of tareasDelRetoParaElPlan(dias).filter((x) => crear.includes(x.dia)).reverse()) {
        await crearTarea({ titulo: x.titulo, detalle: x.detalle, categorias: [cat.id], origen: 'mako', fuente: { tipo: FUENTE_RETO, etiqueta: PROYECTO_RETO, url: x.url } });
      }
    }
    for (const id of cerrar) await moverTarea(Number(id), 'hecho');
    return true;
  });
}
