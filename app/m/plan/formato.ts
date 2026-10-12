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
import type { TonoPildora } from '@/app/m/_ui';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function diaUTC(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

/** Los días entre `hoy` y el plazo (negativo = ya pasó), y el plazo como fecha UTC. */
function distancia(deadline: string | null | undefined, hoy: string): { dias: number; fecha: Date } | null {
  if (!deadline) return null;
  const d = diaUTC(deadline);
  const h = diaUTC(hoy);
  if (d == null || h == null) return null;
  return { dias: d - h, fecha: new Date(d * 86_400_000) };
}

/** El plazo en palabras, contado contra `hoy` (la fecha del negocio). null = sin fecha. */
export function textoVence(deadline: string | null | undefined, hoy: string): string | null {
  const x = distancia(deadline, hoy);
  if (!x) return null;
  const { dias, fecha } = x;
  if (dias === -1) return 'venció ayer';
  if (dias < 0) return `venció hace ${-dias} días`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias <= 6) return `vence el ${DIAS[fecha.getUTCDay()]}`;
  return `vence el ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
}

/**
 * El plazo en el RIEL de la fila, corto como el prototipo: «Hoy», «Mañana», «Mié», «30 oct».
 * Lo vencido dice cuándo venció («Ayer», «8 oct»); que está vencido lo dice el punto rojo de
 * la pantalla, no el texto (el rojo como texto no pasa AA a 13 px).
 */
export function plazoCorto(deadline: string | null | undefined, hoy: string): string | null {
  const x = distancia(deadline, hoy);
  if (!x) return null;
  const { dias, fecha } = x;
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  if (dias >= 2 && dias <= 6) return DIAS_CORTOS[fecha.getUTCDay()];
  return `${fecha.getUTCDate()} ${MESES_CORTOS[fecha.getUTCMonth()]}`;
}

/** La columna del Kanban, con el nombre que ya tiene en el escritorio. */
export const ROTULO_BANDA: Record<Prio, string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };

/**
 * El tono de la píldora (el punto). Baja va en neutro y no en verde como en el Kanban: en el
 * producto el verde dice «completado» (app/_ui/tokens.ts), y una tarea abierta no lo está.
 */
export const TONO_BANDA: Record<Prio, TonoPildora> = { alta: 'bad', media: 'warn', baja: 'neutro', futuro: 'neutro' };

/** Cuántos de algo, con el plural a mano: «1 tarea», «3 tareas». */
export function contar(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

type ConPlazo = { id: string; cuando: string; deadline: string | null };

/**
 * La lista «Hoy» del segmentado: lo vencido y lo de hoy, CON las que además son prioridad.
 *
 * ⚠️ `PlanHoy.hoy` VIENE SIN LAS DE PRIORIDADES (lib/plan-hoy.ts): Today pinta las dos listas
 * juntas y una tarea no puede salir dos veces. Acá las listas son pestañas, una a la vez: sin
 * esto, la tarea más importante que vence hoy NO aparecería en «Hoy». Se devuelven las de
 * prioridades que caen hoy (`cuando === 'hoy'`, la misma cuenta del tablero) y se ordena todo
 * por plazo, lo vencido arriba y sin fecha al final; empatado el día, la prioridad primero
 * (el orden de `hoy` ya es por score, y el sort es estable).
 */
export function listaHoy<T extends ConPlazo>(prioridades: readonly T[], hoy: readonly T[]): T[] {
  const vistos = new Set<string>();
  const todas = [...prioridades.filter((t) => t.cuando === 'hoy'), ...hoy].filter((t) => {
    if (vistos.has(t.id)) return false;
    vistos.add(t.id);
    return true;
  });
  return todas.sort((a, b) => {
    if (!a.deadline !== !b.deadline) return a.deadline ? -1 : 1;
    return (a.deadline ?? '').localeCompare(b.deadline ?? '');
  });
}

/**
 * La lista con las filas que se están yendo AUNQUE el server ya no las mande.
 *
 * ⚠️ MARCAR HECHA REFRESCA LA PÁGINA (`refresh()` en la action) y la tarea ya no viene: si la
 * respuesta llega antes de que la fila termine de irse, la fila desaparecería de golpe a mitad
 * de la animación. Cada fila en tránsito se vuelve a poner donde estaba (después de la que
 * tenía arriba al tocarla; si esa tampoco está, arriba de todo), en el orden en que se tocaron.
 */
export function conEnTransito<T extends { id: string }>(lista: readonly T[], transito: readonly { item: T; antes: string | null }[]): T[] {
  const out = [...lista];
  for (const t of transito) {
    if (out.some((x) => x.id === t.item.id)) continue;
    const i = t.antes == null ? 0 : out.findIndex((x) => x.id === t.antes) + 1;
    out.splice(i, 0, t.item);
  }
  return out;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * El color del proyecto para su punto, o null (el punto va gris).
 *
 * `ItemPlan.proyecto` trae el color del tablero (app/plan/board/hoy.ts, desde el 11/10/2026). Sólo
 * un hex: el valor sale de la base y va a un `style`; cualquier otra cosa deja el punto gris.
 */
export function colorProyecto(p: { nombre: string; color?: unknown } | null | undefined): string | null {
  const c = p?.color;
  return typeof c === 'string' && HEX.test(c.trim()) ? c.trim() : null;
}
