// =============================================================================
// EL RETO EN EL PLAN — las reglas, sin base (20/11/2026, auditoría d24-22)
// =============================================================================
// Lo acordado (la maqueta, EN_TU_PLAN): «Tu reto también está en tu Plan: cada día se cierra solo cuando leo que lo hiciste.». El reto
// es un proyecto del Plan («Reto de 7 días») con una tarea por día; la de un día se cierra cuando MaKo LEYÓ todas sus tareas (no
// cuando se dejaron para después: eso no es hacerlo).
// Se escribe por las funciones del Plan, nunca por fuera (lib/reto/plan.ts; el Cerebro, 20/11: «no cambies cómo se dibuja ni cómo
// funciona el Plan»). Una tarea es del reto por su `fuente` (tipo `reto-7-dias`), y su día va en el link (`dia=N`).
// =============================================================================
import { tareaHecha, type DiaReto, type EstadoReto } from './dias';

export const FUENTE_RETO = 'reto-7-dias';
export const PROYECTO_RETO = 'Reto de 7 días';
export const COLOR_RETO = '#F2B01E';
export const EMOJI_RETO = '🏁';
/** El mensaje del final del día 3 (la maqueta, EN_TU_PLAN). Sale sólo con el proyecto creado: si no, sería mentira. */
export const RETO_EN_TU_PLAN = 'Tu reto también está en tu Plan: cada día se cierra solo cuando leo que lo hiciste.';

/** El link de la tarea de un día: abre el chat del reto. El día va en el link: así se reconoce la tarea. */
export const urlDelDiaEnElPlan = (n: number) => `/second-brain?reto=1&dia=${n}`;
export function diaDeLaUrl(url: string | null | undefined): number | null {
  const m = /[?&]dia=([1-7])(?:&|$)/.exec(url ?? '');
  return m ? Number(m[1]) : null;
}

export type TareaRetoEnPlan = { dia: number; id: string; hecha: boolean };

/** Las 7 tareas: «Día N: su título», con lo que toca ese día en el detalle. */
export function tareasDelRetoParaElPlan(dias: readonly DiaReto[]): Array<{ dia: number; titulo: string; detalle: string; url: string }> {
  return dias.map((d) => ({
    dia: d.n,
    titulo: `Día ${d.n}: ${d.titulo}`,
    detalle: d.tareas.map((t) => `· ${t.titulo}`).join('\n'),
    url: urlDelDiaEnElPlan(d.n),
  }));
}

/** ¿MaKo leyó todo lo del día? (lo dejado para después no cuenta). */
export const diaHecho = (e: EstadoReto, d: DiaReto) => d.tareas.every((t) => tareaHecha(e, d.n, t.id));

/** Qué falta en el Plan: los días sin su tarea (a crear) y las tareas abiertas de días ya hechos (a cerrar). Nunca reabre. */
export function planDelReto(dias: readonly DiaReto[], e: EstadoReto, enPlan: readonly TareaRetoEnPlan[]): { crear: number[]; cerrar: string[] } {
  const tiene = new Set(enPlan.map((t) => t.dia));
  const hechos = new Set(dias.filter((d) => diaHecho(e, d)).map((d) => d.n));
  return {
    crear: dias.map((d) => d.n).filter((n) => !tiene.has(n)),
    cerrar: enPlan.filter((t) => !t.hecha && hechos.has(t.dia)).map((t) => t.id),
  };
}
