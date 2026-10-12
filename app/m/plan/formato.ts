// =============================================================================
// /m/plan — cómo se DICE una tarea en el teléfono (puro: lo usan la pantalla y los tests)
// =============================================================================
// ⚠️ «HOY» ES EL DEL NEGOCIO, NO EL DEL TELÉFONO. La fecha contra la que se cuenta viene
// del server (`PlanHoy.fecha`, `hoyEnWorkspace`): es la misma con la que se armaron las
// listas. Si esto usara `new Date()` del teléfono, cerca de la medianoche una tarea de la
// lista «Hoy» podría decir «vence mañana».
//
// ⚠️ LAS FECHAS SON DÍAS, NO INSTANTES. `YYYY-MM-DD` se cuenta en UTC a propósito: un
// `new Date('2026-10-11')` local corre el día en zonas con horario de verano.
// =============================================================================

import type { Prio } from '@/app/plan/board/types';
import type { Tono } from '@/app/_ui/tokens';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function diaUTC(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

/** El plazo en palabras, contado contra `hoy` (la fecha del negocio). null = sin fecha. */
export function textoVence(deadline: string | null | undefined, hoy: string): string | null {
  if (!deadline) return null;
  const d = diaUTC(deadline);
  const h = diaUTC(hoy);
  if (d == null || h == null) return null;
  const dias = d - h;
  if (dias === -1) return 'venció ayer';
  if (dias < 0) return `venció hace ${-dias} días`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  const fecha = new Date(d * 86_400_000);
  if (dias <= 6) return `vence el ${DIAS[fecha.getUTCDay()]}`;
  return `vence el ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
}

/** La columna del Kanban, con el nombre que ya tiene en el escritorio. */
export const ROTULO_BANDA: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };

/**
 * El tono de la pill. Baja va en neutro y no en verde como en el Kanban: en el producto el
 * verde dice «completado» (app/_ui/tokens.ts), y una tarea abierta no lo está.
 */
export const TONO_BANDA: Record<Prio, Tono> = { alta: 'bad', media: 'warn', baja: 'neutral', futuro: 'neutral' };

/** Cuántos de algo, con el plural a mano: «1 proyecto atrasado», «3 proyectos atrasados». */
export function contar(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
