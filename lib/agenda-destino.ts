// =============================================================================
// agenda-destino — DÓNDE agenda MaKo lo que le piden: el Google Calendar del negocio o el Calendario de MaKo (puro)
// =============================================================================
// Ticket #112 (Joan, Código Inmobiliario, ws 13, 18/11/2026): «NO me agenda el evento en mi google calendar, solo en el calendario de
// Mako, cada vez que quiera agendar algo tiene que agendarlo en mi google calendar de una». Era el «Misa Fasta SAM» del #111: «agenda un
// evento en MI CALENDARIO…». El negocio tiene su Google conectado desde el 8/10, pero medido con el turno real:
//   · «mi calendario» trae sólo `crear_evento_calendario` (el Calendario de MaKo): el área `calendario` no sabe de Google;
//   · «mi Google Calendar» trae `proponer_agendar_agenda` (sin lead, un evento del negocio en Google), pero no `crear_evento_google`;
//   · sólo «el calendario de google» trae `crear_evento_google`.
// Lo que fija este módulo, sin leer nada (la preferencia guardada y el estado de la conexión los pasa quien llama):
//   · `destinoDeLaAgenda`: con Google conectado y con permiso de escribir, «mi calendario», «mi agenda», «Google» o la preferencia
//     guardada del negocio van a Google. «el calendario de MaKo» va a MaKo, aunque haya preferencia. Sin Google (o sin permiso), si lo
//     pidió por su nombre o lo tiene guardado: `sin-conexion`, que se dice con el link a Integraciones, nunca en silencio.
//   · `pidePreferenciaDeAgenda`: «cada vez que agende algo, que sea en mi Google Calendar» es una PREFERENCIA del negocio, que se
//     guarda con un «sí» (`elegir_google_o_mako`, lib/api-mako/areas/calendario.def.ts) en `KEY_DESTINO_AGENDA`.
// Lo de Google YA se ve en el Calendario de MaKo (lib/calendario.ts lo lee de donde vive): agendar en Google alcanza, no se copia.
// =============================================================================

import { nombraGoogleCalendar } from './mako-intencion';

/** El ajuste del negocio (app_settings): `google` o `mako`. Sin él, se decide por lo que dice cada pedido. */
export const KEY_DESTINO_AGENDA = 'mako.agenda.destino';
export type DestinoGuardado = 'google' | 'mako';
export const esDestinoGuardado = (x: unknown): x is DestinoGuardado => x === 'google' || x === 'mako';
export type DestinoDeLaAgenda = 'google' | 'mako' | 'sin-conexion';
/** Lo que se sabe de la conexión de Google del negocio (`permisoCalendarioGoogle`, lib/google-calendar.ts). */
export type ConexionGoogle = { conectado: boolean; puedeMover: boolean };

const sinTildes = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pide agendar ALGO: un evento, una reunión, ponerlo en el calendario. */
const RX_AGENDAR = /\b(?:agend(?:a|ar|ame|alo|ala|ale|arlo|arla|arle|en|es)|crea(?:r|me|lo)?\s+(?:un\s+|el\s+)?evento|eventos?|(?:pon|ponlo|ponme|ponelo|anota|anotalo|anotame|mete|metelo|carga|cargalo)\s+(?:\S+\s+){0,3}en\s+(?:mi|el|tu)\s+(?:calendario|agenda|calendar))\b/;
/** «mi calendario», «mi agenda»: la SUYA (el Calendario de MaKo a secas es «el calendario»). */
const RX_SU_AGENDA = /\b(?:mis?|nuestr[oa]s?)\s+(?:calendarios?|agendas?)\b/;
/** «en Google», «a mi Google» (además de lo que reconoce `nombraGoogleCalendar`). */
const RX_EN_GOOGLE = /\b(?:en|a|al)\s+(?:mi\s+|el\s+)?google\b/;
/** El Calendario de MaKo por su nombre: gana sobre cualquier preferencia. */
const RX_DE_MAKO = /\b(?:calendario|agenda)\s+de\s+mako\b/;
/** Lo que vale para SIEMPRE: «cada vez», «siempre», «de ahora en adelante». */
const RX_SIEMPRE = /\b(?:cada\s+vez|siempre|de\s+ahora\s+en\s+adelante|a\s+partir\s+de\s+ahora|en\s+adelante|todo\s+lo\s+que\s+(?:agend|te\s+pid))/;

export const nombraGoogle = (texto: string): boolean => nombraGoogleCalendar(texto) || RX_EN_GOOGLE.test(sinTildes(texto));
export const pideAgendarAlgo = (texto: string): boolean => RX_AGENDAR.test(sinTildes(texto).slice(0, 2000));

/** «no en Google»: lo de Google se descarta. */
const RX_NO_GOOGLE = /\bno\s+(?:lo\s+|la\s+)?(?:agendes\s+|pongas\s+)?(?:en\s+)?(?:mi\s+|el\s+)?(?:google|calendario\s+de\s+google)\b/;

/** Entre Google y MaKo cuando el texto nombra los dos: Google, salvo un «no en Google». ⚠️ «solo en el calendario de Mako» es una QUEJA
 *  (la de Joan, #112), no un pedido: por eso nombrar MaKo no le gana a Google. */
function cualNombra(t: string, texto: string): DestinoGuardado | null {
  const google = nombraGoogle(texto) && !RX_NO_GOOGLE.test(t);
  if (google) return 'google';
  return RX_DE_MAKO.test(t) ? 'mako' : null;
}

/**
 * «cada vez que quiera agendar algo tiene que agendarlo en mi google calendar» → `google`. null si no es una preferencia. Lo que vale
 * es lo que viene DESPUÉS del «cada vez» / «siempre»: lo de antes puede ser la queja («NO me agenda… solo en el calendario de Mako»).
 */
export function pidePreferenciaDeAgenda(texto: string): DestinoGuardado | null {
  const t = sinTildes(texto).slice(0, 2000);
  const m = RX_SIEMPRE.exec(t);
  if (!m || !/\bagend/.test(t)) return null;
  const despues = t.slice(m.index);
  return cualNombra(despues, despues);
}

/** ¿Hace falta mirar la conexión de Google para decidir? Sólo si el pedido (o la preferencia guardada) apunta a su agenda o a Google. */
export function necesitaLaConexion(p: { texto: string; guardado: DestinoGuardado | null }): boolean {
  const t = sinTildes(p.texto);
  if (!pideAgendarAlgo(p.texto)) return false;
  const dicha = pidePreferenciaDeAgenda(p.texto) ?? cualNombra(t, p.texto);
  if (dicha) return dicha === 'google';
  return RX_SU_AGENDA.test(t) || p.guardado === 'google';
}

/**
 * Dónde va lo que pide agendar este mensaje. null = no se decide acá (no pide agendar, o nada apunta a Google): el turno sigue como
 * siempre. «mi calendario» sin Google conectado y sin preferencia es el Calendario de MaKo, como hasta hoy: no es un error.
 */
export function destinoDeLaAgenda(p: { texto: string; guardado: DestinoGuardado | null; google: ConexionGoogle | null }): DestinoDeLaAgenda | null {
  const t = sinTildes(p.texto);
  if (!pideAgendarAlgo(p.texto)) return null;
  // Lo que dice ESTE mensaje gana sobre lo guardado: la preferencia que enuncia ahora, o el que nombra.
  const dicha = pidePreferenciaDeAgenda(p.texto) ?? cualNombra(t, p.texto);
  if (dicha === 'mako') return 'mako';
  const porSuNombre = dicha === 'google';
  const quiereGoogle = porSuNombre || RX_SU_AGENDA.test(t) || p.guardado === 'google';
  // `mako` guardado es lo de siempre: no hace falta decir nada (y una reunión con un lead sigue yendo por su invitación).
  if (!quiereGoogle) return null;
  if (p.google?.conectado && p.google.puedeMover) return 'google';
  return porSuNombre || p.guardado === 'google' ? 'sin-conexion' : null;
}

/** La línea del system de ESTE turno. `link`: el de Integraciones del negocio, armado por el código. */
export function instruccionDelDestino(destino: DestinoDeLaAgenda, p: { google: ConexionGoogle | null; link: string; guardado: DestinoGuardado | null }): string {
  if (destino === 'google') {
    return [
      `DÓNDE SE AGENDA: este negocio tiene su Google Calendar conectado${p.guardado === 'google' ? ' y eligió que TODO lo que pida agendar vaya ahí' : ', y lo que pide agendar va ahí'}.`,
      'Para un evento suyo usa crear_evento_google (título, fecha, hora y duración, como lo dijo). Para una reunión con un lead al que hay que invitar, proponer_agendar_agenda.',
      'No uses el Calendario de MaKo para esto: lo de Google ya se ve en él. En la propuesta di que queda en su Google Calendar.',
    ].join(' ');
  }
  if (destino === 'sin-conexion') {
    const falta = p.google?.conectado ? 'está conectado sólo para leer: hay que reconectarlo con permiso para crear eventos' : 'no tiene su Google Calendar conectado';
    return [
      `DÓNDE SE AGENDA: pide su Google Calendar${p.guardado === 'google' ? ' (lo eligió para todo lo que agenda)' : ''}, pero este negocio ${falta}.`,
      `Dilo en una línea, con el link para conectarlo en Configuración › Integraciones: ${p.link}`,
      '⛔ No lo agendes sólo en el Calendario de MaKo sin decirlo. Si quiere, ofrécele dejarlo ahí mientras tanto.',
    ].join(' ');
  }
  return 'DÓNDE SE AGENDA: pidió el Calendario de MaKo. Usa crear_evento_calendario, no Google.';
}

/** La línea de cuando la persona dice dónde quiere que se agende SIEMPRE. */
export function instruccionDeLaPreferencia(destino: DestinoGuardado): string {
  const donde = destino === 'google' ? 'su Google Calendar' : 'el Calendario de MaKo';
  return `TE DICE DÓNDE QUIERE QUE AGENDES SIEMPRE: en ${donde}. Propón elegir_google_o_mako con destino «${destino}»: con su «sí» queda guardado para el negocio, y lo que pida agendar después va ahí sin que lo repita. Si en el mismo mensaje pide agendar algo, propón también eso.`;
}
