// =============================================================================
// retro-seguimiento — la rendición de cuentas de la Retro, PURA (sin IO, testeable)
// =============================================================================
// Mismo split que crm-auto / crm-auto-plan: el pipeline (server-only) trae los
// datos y esta lib decide. Vive aparte para que la regla se pueda testear sin
// base ni red — y esta regla merece test, porque es la que Martín pidió que sea
// verdad y era mentira.
//
// LA REGLA, EN UNA LÍNEA: aceptar no es hacer.
//
// Antes, una tarea con status 'aceptada' devolvía {st:'done', estado:'Aceptada',
// fx:'en To-do', fxT:'good'} sin mirar jamás la tabla de tareas: tocar "Aceptar"
// en el wizard contaba como trabajo hecho. Eso no era solo un cartel optimista —
// la fase Memoria alimenta al cerebro que arma el plan siguiente, así que la Retro
// se autoengañaba cada semana. Los experimentos nunca mintieron (miran
// estado==='cerrado'); la mentira estaba concentrada en las tareas.
// =============================================================================

import type { RetroPlanItem, RetroSeguimientoItem } from './retro-reporte';

/** Lo mínimo que hace falta saber de un experimento para juzgarlo. */
export type ExpSeguimiento = { id: number; estado?: string; veredicto?: string | null };
/** Lo mínimo que hace falta saber de una tarea del tablero para juzgarla. */
export type TareaSeguimiento = { id: number; titulo: string; estado: string; progreso: number };

/**
 * Qué pasó DE VERDAD con un item del plan de la retro anterior.
 * `tareasPrev` son las tareas nacidas de esa retro (experimento_tareas.retro_id).
 */
export function seguimientoDeItem(
  item: RetroPlanItem,
  exps: ExpSeguimiento[],
  tareasPrev: TareaSeguimiento[],
): RetroSeguimientoItem {
  const st = item.status?.estado;

  if (st === 'pospuesta') return { st: 'no', title: item.titulo, estado: 'Pospuesta', fx: 'sin efecto', fxT: 'gris' };
  if (st === 'descartada') return { st: 'no', title: item.titulo, estado: `Descartada${item.status?.motivo ? ' · ' + item.status.motivo : ''}`, fx: 'sin efecto', fxT: 'gris' };
  if (st !== 'aceptada') return { st: 'no', title: item.titulo, estado: 'Sin tocar', fx: 'sin efecto', fxT: 'gris' };

  // Experimento cerrado: ya tiene veredicto, es el único "hecho" indiscutible.
  const exp = item.status?.experimento_id != null ? exps.find((e) => e.id === item.status?.experimento_id) : null;
  if (exp?.estado === 'cerrado') {
    const v = exp.veredicto;
    return {
      st: 'done', title: item.titulo, estado: 'Hecho',
      fx: v === 'validada' ? 'validada' : v === 'refutada' ? 'refutada' : 'no concluyente',
      fxT: v === 'validada' ? 'good' : v === 'refutada' ? 'bad' : 'warn',
    };
  }

  if (item.kind === 'tarea') {
    // Por id si aplicarPlan lo guardó; si no, por título (con eso se creó).
    const t = (item.status?.tarea_id != null ? tareasPrev.find((x) => x.id === item.status?.tarea_id) : undefined)
      ?? tareasPrev.find((x) => x.titulo.trim() === item.titulo.trim());
    if (!t) return { st: 'no', title: item.titulo, estado: 'Aceptada, pero no está en el tablero', fx: 'se perdió', fxT: 'bad' };
    if (t.estado === 'hecho' || t.progreso >= 100) return { st: 'done', title: item.titulo, estado: 'Hecha', fx: 'completada', fxT: 'good' };
    if (t.progreso > 0 || t.estado === 'en_curso') return { st: 'curso', title: item.titulo, estado: 'Empezada', fx: `${t.progreso}%`, fxT: 'warn' };
    return { st: 'no', title: item.titulo, estado: 'Aceptada y sin tocar', fx: 'sigue en 0%', fxT: 'bad' };
  }

  return { st: 'curso', title: item.titulo, estado: 'En curso', fx: 'midiendo', fxT: 'warn' };
}

/**
 * El resumen que necesita el gate del punto 7: de lo que la Retro anterior propuso
 * y vos aceptaste, ¿cuánto se hizo? Solo cuenta lo ACEPTADO — lo que pospusiste o
 * descartaste ya lo decidiste, no es deuda. Si no aceptaste nada, no hay deuda que
 * reclamar (`total: 0`), que es el caso de una cuenta nueva.
 */
export function deudaDeLaRetro(items: RetroSeguimientoItem[]): { total: number; hechas: number; enCurso: number; sinTocar: number; pendientes: number } {
  const relevantes = items.filter((i) => i.estado !== 'Pospuesta' && !i.estado.startsWith('Descartada') && i.estado !== 'Sin tocar');
  const hechas = relevantes.filter((i) => i.st === 'done').length;
  const enCurso = relevantes.filter((i) => i.st === 'curso').length;
  return { total: relevantes.length, hechas, enCurso, sinTocar: relevantes.length - hechas - enCurso, pendientes: relevantes.length - hechas };
}
