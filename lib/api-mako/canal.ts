// =============================================================================
// api-mako/canal — la clave de scope de una pendiente, y de qué canal vino
// =============================================================================
// `mako_acciones_pendientes.grupo_jid` (mig 0085) es la clave por la que un «sí»
// encuentra lo que se propuso en ESE canal. Nació para WhatsApp (el jid del grupo)
// y se reusa para los otros dos canales con un prefijo: la columna es texto sin
// CHECK y el índice `(workspace_id, grupo_jid, estado, created_at)` es exactamente
// la consulta. Sin migración.
//
// La no-colisión no es una suposición: un jid de WhatsApp es `<dígitos>@g.us` o
// `<dígitos>@s.whatsapp.net` y nunca empieza con `api:` ni `app:`. El test lo fija.
//
// SIN `server-only`: es puro y lo importan los tests.
// =============================================================================

import type { Canal } from './tipos';

export const PREFIJO_API = 'api:';
export const PREFIJO_APP = 'app:';
/** Un paso «⚡ Acción» de un flujo (lib/api-mako/flujo.ts). Es canal `app` —empieza con
 *  `app:`— y se distingue sólo para decir de dónde vino la fila. */
export const PREFIJO_FLUJO = 'app:flujo:';

/** La clave de scope para un canal. HTTP: por workspace (hay UN token por ws; el
 *  día que haya tokens por usuario, la clave suma el id del token). */
export function canalKeyDe(canal: Canal, id: string | number): string {
  switch (canal) {
    case 'whatsapp': return String(id);
    case 'app': return `${PREFIJO_APP}${id}`;
    case 'http': return `${PREFIJO_API}${id}`;
  }
}

/** De qué canal vino una pendiente, leyendo su clave. */
export function canalDeClave(clave: string): Canal {
  if (clave.startsWith(PREFIJO_API)) return 'http';
  if (clave.startsWith(PREFIJO_APP)) return 'app';
  return 'whatsapp';
}

/** Cómo se le dice a una persona de dónde vino. */
export function etiquetaDeCanal(clave: string): string {
  if (clave.startsWith(PREFIJO_FLUJO)) return 'vino de una automatización';
  switch (canalDeClave(clave)) {
    case 'http': return 'vino por la API';
    case 'app': return 'vino del chat de la app';
    case 'whatsapp': return 'vino por WhatsApp';
  }
}

/** ¿Este canal puede CONFIRMAR una pendiente por su cuenta? Solo donde hay una
 *  persona en el circuito: el «sí» en WhatsApp lo tipea alguien; la bandeja de la
 *  app la aprieta alguien logueado. Por HTTP hace falta el alcance `ejecutar`,
 *  que se acuña a propósito — y aun así el `id` es obligatorio. */
export function puedeConfirmar(canal: Canal, alcance: 'lectura' | 'proponer' | 'ejecutar', bandeja?: true): boolean {
  if (bandeja) return true;
  if (canal === 'whatsapp') return true;
  if (canal === 'app') return true;
  return alcance === 'ejecutar';
}
