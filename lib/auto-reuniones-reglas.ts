// =============================================================================
// auto-reuniones-reglas — lo puro de la búsqueda de reuniones (lib/auto-reuniones.ts), con test (27/10/2026)
// =============================================================================
// Dos cosas que contó Mauricio (ws1) y que la búsqueda hacía distinto que el webhook de Calendly:
//
//   1. «Fechas de Google Calendar guardadas en UTC que aparecen un día antes en el CRM». La búsqueda armaba el DÍA de la
//      reunión con `.slice(0, 10)` del instante: el de Calendly y Fathom viene en UTC («…T02:00:00Z»), así que el día era el
//      de Greenwich, no el del CRM. La CLAVE del día que guarda el CRM (`fecha_junta_N`) es la de Tijuana
//      (`isoToFechaTijuana`, lib/calendly.ts: el webhook escribe así y los lectores comparan con `hoyEnTijuana`); un día
//      armado en UTC queda corrido un día, para atrás o para adelante según la hora y la zona. Y un evento de DÍA COMPLETO
//      de Google trae sólo «2026-10-28»: ése ES el día, y pasarlo por un `Date` lo vuelve la medianoche UTC (el 27 a la
//      tarde en México). `diaDeReunion` hace las dos cosas bien.
//   2. «El filtro de Calendly no bloquea». El webhook sólo toma los tipos de evento del CRM (R1/R2 configurados y los
//      vinculados a una etapa), pero la búsqueda traía TODAS las reuniones del invitado en la organización, de cualquier
//      tipo (un onboarding, un webinar), y la más vieja pasaba por la R1. `esEventoDelCrm` aplica el mismo filtro.
// =============================================================================

import { clasificarJunta, isoToFechaTijuana, mismoEventType } from './calendly';

/** El filtro de los eventos de Calendly que son del CRM: el de la R1, el de la R2 y los vinculados a una etapa. */
export type FiltroCalendly = { j1: string | null; j2: string | null; vinculados: readonly string[] };

/** ¿Hay algo configurado contra qué filtrar? Sin nada, no se filtra (un negocio que no eligió tipos ve todo, como antes). */
export function hayFiltroCalendly(f: FiltroCalendly): boolean {
  return !!(f.j1?.trim() || f.j2?.trim() || f.vinculados.some((v) => v.trim()));
}

type EventoComoLlega = { event_type?: string; name?: string; uri?: string };

/** ¿Este evento de Calendly es una reunión del CRM? La misma regla que el webhook (`clasificarJunta` y los vínculos). */
export function esEventoDelCrm(ev: EventoComoLlega, f: FiltroCalendly): boolean {
  if (!hayFiltroCalendly(f)) return true;
  if (clasificarJunta(ev, f) !== 'desconocido') return true;
  const tipo = ev.event_type?.trim() ?? '';
  return !!tipo && f.vinculados.some((v) => !!v.trim() && mismoEventType(tipo, v));
}

const ES_R2_POR_NOMBRE = /r2|reuni[oó]n 2|junta 2|seguimiento/i;

/** ¿Es la R2? Con el tipo de la R2 configurado, por el tipo (como el webhook); sin él, por el nombre del evento. */
export function esR2(ev: EventoComoLlega, f: FiltroCalendly): boolean {
  if (f.j2?.trim()) return clasificarJunta(ev, f) === 'j2';
  return ES_R2_POR_NOMBRE.test(ev.name ?? '');
}

/**
 * EL DÍA DE UNA REUNIÓN COMO LO GUARDA EL CRM (AAAA-MM-DD, la clave de Tijuana del webhook), o null. Un día suelto
 * («2026-10-28», un evento de día completo de Google) se queda como está: no es un instante. Un instante (con hora, en UTC o
 * con su desfase) se pasa al día de Tijuana.
 */
export function diaDeReunion(valor: string | null | undefined): string | null {
  const s = String(valor ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (Number.isNaN(Date.parse(s))) return null;
  return isoToFechaTijuana(s);
}
