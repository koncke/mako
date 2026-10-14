// =============================================================================
// calendario-google — la cuenta de Google conectada, vista y editada desde la tab Calendario
// =============================================================================
// Lo pidió Martín el 14/10/2026: una copia fiel de Google Calendar que refleje todo lo que hay en Google. Lee TODOS
// los calendarios de la cuenta (`calendarList`) y sus eventos; escribe (crear, cambiar, mover, borrar y deshacer el
// borrado) en los calendarios donde la cuenta puede editar. Lo puro —qué se dibuja, cómo se arma el cuerpo— vive en
// lib/calendario-google-modelo.ts, con test.
//
// ⚠️ LA AGENDA NO PASA POR LA IA: lo que devuelve este módulo lo dibuja la pantalla y nada más.
// ⚠️ «NO PUDE LEER» NO ES «NO HAY NADA»: un calendario que falla se nombra (`fallaron`) en vez de dibujarse vacío.
// ⚠️ EL TOKEN SE REFRESCA EN UN SOLO LUGAR (`tokenDelCalendario`, lib/google-calendar.ts).
// ⚠️ DESHACER UN BORRADO DEVUELVE LA MISMA IDENTIDAD: Google deja un evento borrado como `cancelled` y se restaura con
//    un PATCH a `confirmed` sobre el MISMO id (AGENTS.md, «Deshacer una acción destructiva…»). Recrearlo le daría otro
//    id y cortaría el hilo con los invitados.
// =============================================================================

import 'server-only';
import { tokenDelCalendario } from './google-calendar';
import { instanteDe } from './cron-aviso';
import {
  calendarioDeGoogle, cuerpoEventoGoogle, eventoDeGoogle, ordenarCalendarios,
  type CalendarioCrudoGoogle, type CalendarioGoogle, type EntradaEventoGoogle, type EventoCrudoGoogle, type EventoGoogle,
} from './calendario-google-modelo';

const API = 'https://www.googleapis.com/calendar/v3';
/** Cuántos eventos se leen por calendario y rango. Más es un rango que no se dibuja de una vez. */
const TOPE_POR_CALENDARIO = 250;
/** Cuántos calendarios se leen a la vez (la cuota de Google es por usuario y por segundo). */
const EN_PARALELO = 4;

export type AgendaGoogle =
  | { ok: true; calendarios: CalendarioGoogle[]; eventos: EventoGoogle[]; puedeEscribir: boolean; fallaron: string[]; recortado: boolean }
  | { ok: false; codigo: 'sin-conexion' | 'api'; motivo: string };

const sinConexion = (): AgendaGoogle => ({ ok: false, codigo: 'sin-conexion', motivo: 'No hay una cuenta de Google conectada.' });

async function pedir(access: string, url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
}

/** Los calendarios de la cuenta (los ocultos no). null = Google no los dio. */
async function listarCalendarios(access: string): Promise<CalendarioGoogle[] | null> {
  const url = new URL(`${API}/users/me/calendarList`);
  url.searchParams.set('maxResults', '250');
  url.searchParams.set('fields', 'items(id,summary,summaryOverride,backgroundColor,primary,accessRole,selected,hidden,deleted)');
  const res = await pedir(access, url.toString());
  if (!res.ok) return null;
  const j = (await res.json()) as { items?: CalendarioCrudoGoogle[] };
  return ordenarCalendarios((j.items ?? []).map(calendarioDeGoogle).filter((c): c is CalendarioGoogle => !!c));
}

async function eventosDe(access: string, cal: CalendarioGoogle, desdeIso: string, hastaIso: string, inicioDeDia: (f: string) => string): Promise<EventoGoogle[] | null> {
  const url = new URL(`${API}/calendars/${encodeURIComponent(cal.id)}/events`);
  url.searchParams.set('timeMin', desdeIso);
  url.searchParams.set('timeMax', hastaIso);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', String(TOPE_POR_CALENDARIO));
  url.searchParams.set('fields', 'items(id,summary,status,start,end,colorId,location,description,htmlLink,hangoutLink,conferenceData(entryPoints(entryPointType,uri)),attendees(email,self,responseStatus,resource),organizer(email,displayName,self),recurringEventId,eventType)');
  const res = await pedir(access, url.toString());
  if (!res.ok) return null;
  const j = (await res.json()) as { items?: EventoCrudoGoogle[] };
  return (j.items ?? []).map((e) => eventoDeGoogle(e, cal, inicioDeDia)).filter((e): e is EventoGoogle => !!e);
}

/** El instante en que empieza un día ('YYYY-MM-DD') en la zona del negocio. */
function inicioDeDiaEn(tz: string): (fecha: string) => string {
  return (fecha) => {
    const [y, m, d] = fecha.split('-').map(Number);
    return instanteDe(tz, y, m, d, 0, 0).toISOString();
  };
}

/**
 * Todo lo de Google en el rango [desde, hasta): los calendarios y los eventos de los que estén en `ids` ('todos' =
 * todos; null = los que la persona tiene tildados en Google). Nunca lanza.
 */
export async function leerAgendaGoogle(desdeIso: string, hastaIso: string, tz: string, ids: readonly string[] | 'todos' | null = null): Promise<AgendaGoogle> {
  try {
    const tk = await tokenDelCalendario();
    if (!tk) return sinConexion();
    const calendarios = await listarCalendarios(tk.access);
    if (!calendarios) return { ok: false, codigo: 'api', motivo: 'Google no devolvió tus calendarios.' };
    const aLeer = calendarios.filter((c) => (ids === 'todos' ? true : ids ? ids.includes(c.id) : c.seleccionado));
    const inicioDeDia = inicioDeDiaEn(tz);
    const eventos: EventoGoogle[] = [];
    const fallaron: string[] = [];
    let recortado = false;
    for (let i = 0; i < aLeer.length; i += EN_PARALELO) {
      const tanda = aLeer.slice(i, i + EN_PARALELO);
      const leidos = await Promise.all(tanda.map((c) => eventosDe(tk.access, c, desdeIso, hastaIso, inicioDeDia).catch(() => null)));
      leidos.forEach((lista, k) => {
        if (!lista) { fallaron.push(tanda[k].nombre); return; }
        if (lista.length >= TOPE_POR_CALENDARIO) recortado = true;
        eventos.push(...lista);
      });
    }
    return { ok: true, calendarios, eventos, puedeEscribir: tk.puedeEscribir, fallaron, recortado };
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    return { ok: false, codigo: 'api', motivo: timeout ? 'Google no respondió a tiempo.' : 'No se pudo contactar a Google Calendar.' };
  }
}

export type ResultadoEscrituraGoogle = { ok: true; id: string } | { ok: false; error: string };

/** El calendario existe en la cuenta y se puede escribir en él. */
async function calendarioEditable(access: string, calendarioId: string): Promise<CalendarioGoogle | string> {
  const cals = await listarCalendarios(access);
  if (!cals) return 'Google no devolvió tus calendarios.';
  // 'primary' es el principal (lo usa la API de MaKo, que no lista calendarios: la agenda no pasa por la IA).
  const cal = calendarioId === 'primary' ? cals.find((c) => c.primario) : cals.find((c) => c.id === calendarioId);
  if (!cal) return 'Ese calendario ya no está en tu cuenta de Google.';
  if (!cal.editable) return 'En ese calendario no tienes permiso para editar.';
  return cal;
}

async function conToken<T extends { ok: boolean }>(fn: (access: string) => Promise<T>, err: (m: string) => T): Promise<T> {
  try {
    const tk = await tokenDelCalendario();
    if (!tk) return err('No hay una cuenta de Google conectada.');
    if (!tk.puedeEscribir) return err('El permiso de Google es de solo lectura: vuelve a conectar la cuenta para editar.');
    return await fn(tk.access);
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError';
    return err(timeout ? 'Google no respondió a tiempo.' : 'No se pudo contactar a Google Calendar.');
  }
}

async function motivoDeGoogle(res: Response): Promise<string> {
  if (res.status === 403) return 'Google no dejó hacer el cambio (permiso).';
  if (res.status === 404 || res.status === 410) return 'Ese evento ya no está en Google.';
  return `Google no aceptó el cambio (${res.status}).`;
}

const fallo = (error: string): ResultadoEscrituraGoogle => ({ ok: false, error });

/** Crea un evento en un calendario de Google (sin invitados: no se agregan desde acá). */
export async function crearEventoGoogle(calendarioId: string, entrada: EntradaEventoGoogle, tz: string): Promise<ResultadoEscrituraGoogle> {
  const c = cuerpoEventoGoogle(entrada, tz);
  if (!c.ok) return fallo(c.error);
  return conToken(async (access) => {
    const cal = await calendarioEditable(access, calendarioId);
    if (typeof cal === 'string') return fallo(cal);
    const res = await pedir(access, `${API}/calendars/${encodeURIComponent(cal.id)}/events`, { method: 'POST', body: JSON.stringify(c.cuerpo) });
    if (!res.ok) return fallo(await motivoDeGoogle(res));
    const j = (await res.json()) as { id?: string };
    return j.id ? { ok: true, id: j.id } : fallo('Google no devolvió el evento.');
  }, fallo);
}

/** Cambia un evento (lo que venga en `entrada`). `avisar` = Google le avisa el cambio a los invitados. */
export async function cambiarEventoGoogle(calendarioId: string, eventoId: string, entrada: EntradaEventoGoogle, tz: string, avisar: boolean): Promise<ResultadoEscrituraGoogle> {
  const c = cuerpoEventoGoogle(entrada, tz);
  if (!c.ok) return fallo(c.error);
  return conToken(async (access) => {
    const cal = await calendarioEditable(access, calendarioId);
    if (typeof cal === 'string') return fallo(cal);
    const url = new URL(`${API}/calendars/${encodeURIComponent(cal.id)}/events/${encodeURIComponent(eventoId)}`);
    url.searchParams.set('sendUpdates', avisar ? 'all' : 'none');
    const res = await pedir(access, url.toString(), { method: 'PATCH', body: JSON.stringify(c.cuerpo) });
    if (!res.ok) return fallo(await motivoDeGoogle(res));
    return { ok: true, id: eventoId };
  }, fallo);
}

/** Borra un evento. Se deshace con `restaurarEventoGoogle` (el MISMO id). */
export async function borrarEventoGoogle(calendarioId: string, eventoId: string, avisar: boolean): Promise<ResultadoEscrituraGoogle> {
  return conToken(async (access) => {
    const cal = await calendarioEditable(access, calendarioId);
    if (typeof cal === 'string') return fallo(cal);
    const url = new URL(`${API}/calendars/${encodeURIComponent(cal.id)}/events/${encodeURIComponent(eventoId)}`);
    url.searchParams.set('sendUpdates', avisar ? 'all' : 'none');
    const res = await pedir(access, url.toString(), { method: 'DELETE' });
    // 410 = ya estaba borrado: el resultado que se pidió.
    if (!res.ok && res.status !== 410) return fallo(await motivoDeGoogle(res));
    return { ok: true, id: eventoId };
  }, fallo);
}

/** Deshace un borrado: el evento vuelve a `confirmed` con su mismo id. */
export async function restaurarEventoGoogle(calendarioId: string, eventoId: string): Promise<ResultadoEscrituraGoogle> {
  return conToken(async (access) => {
    const cal = await calendarioEditable(access, calendarioId);
    if (typeof cal === 'string') return fallo(cal);
    const url = new URL(`${API}/calendars/${encodeURIComponent(cal.id)}/events/${encodeURIComponent(eventoId)}`);
    url.searchParams.set('sendUpdates', 'none');
    const res = await pedir(access, url.toString(), { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
    if (!res.ok) return fallo(await motivoDeGoogle(res));
    return { ok: true, id: eventoId };
  }, fallo);
}
