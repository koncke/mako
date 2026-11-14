// =============================================================================
// Crear una automatización con MaKo es un TRABAJO DEL SERVIDOR — las reglas PURAS (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 00:34): «¿existe y termina sola?». No terminaba: si se cerraba o se recargaba
// la pestaña mientras el modelo escribía, el pedido se cortaba (`req.signal`) y no quedaba nada. Ahora el trabajo sigue
// en el servidor (`after`, app/api/chat-agent/secuencias/ia/route.ts) y sólo lo corta un «Cancelar» de verdad, que deja
// una MARCA (el navegador que se cierra no la deja). Al terminar, el chat de la automatización lo dice y, si nadie estaba
// mirando, le llega un push a quien lo pidió. Sigue naciendo PAUSADA.
//
// Sin `server-only`: `trabajoEnElServidor` la usa la pantalla (app/automations/ChatMako.tsx) al volver.
// =============================================================================

import type { MensajeChatMako } from './automatizacion-chat';

/** La clave de la marca de «Cancelar» de una automatización (`app_settings`, por negocio). */
export const claveCancelada = (secuenciaId: number): string => `automatizacion.ia.cancelada.${secuenciaId}`;

/** Cada cuánto mira el trabajo si lo cancelaron. */
export const MIRAR_CANCELADA_MS = 2_000;

/**
 * Lo más que puede seguir un trabajo: la función tiene 300 s (`maxDuration`). Pasado esto, un turno sin respuesta de MaKo
 * no es un trabajo en curso: se cortó (y la persona puede volver a pedirlo).
 */
export const TOPE_TRABAJO_MS = 330_000;

/** ¿La marca cancela ESTE trabajo? Sólo una puesta después de que arrancó: una vieja es de otro pedido. */
export function canceladaDesde(valor: string | null | undefined, inicio: number): boolean {
  const t = Number(valor);
  return Number.isFinite(t) && t >= inicio;
}

/**
 * Al volver a la automatización (recargó, o la abrió de nuevo después de cerrar la pestaña): ¿MaKo sigue armándola en el
 * servidor? El último mensaje del chat es el pedido de la persona, de hace menos que el tope, y todavía no hay respuesta.
 */
export function trabajoEnElServidor(mensajes: readonly Pick<MensajeChatMako, 'de' | 'at'>[], ahora: number): boolean {
  const u = mensajes[mensajes.length - 1];
  if (!u || u.de !== 'yo') return false;
  const t = Date.parse(u.at);
  return Number.isFinite(t) && ahora - t >= 0 && ahora - t < TOPE_TRABAJO_MS;
}

/** El push a quien lo pidió, cuando terminó sin que nadie mirara. */
export function pushDeTrabajo(r: { t: 'listo'; nombre: string } | { t: 'pregunta'; nombre: string; pregunta: string } | { t: 'error'; nombre: string; error: string }): { titulo: string; cuerpo: string } {
  const quien = r.nombre.trim() ? `«${r.nombre.trim()}»` : 'Tu automatización';
  if (r.t === 'listo') return { titulo: `${quien} está lista`, cuerpo: 'MaKo la armó y quedó pausada: revísala y publícala.' };
  if (r.t === 'pregunta') return { titulo: `MaKo te pregunta sobre ${quien}`, cuerpo: r.pregunta };
  return { titulo: `MaKo no pudo armar ${quien}`, cuerpo: r.error };
}
