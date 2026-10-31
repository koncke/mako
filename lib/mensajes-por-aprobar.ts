// =============================================================================
// mensajes-por-aprobar — lo que una automatización dejó esperando que lo apruebes
// =============================================================================
// 20/10/2026, Martín: «Tambien revisa que Leila configuró una automatización recurrente y me dijo que no salió».
// Salió: #282 inscribió a 31 leads y los 31 mensajes quedaron como BORRADOR (`wa_borradores`, 'pendiente'). Es la
// regla anti-baneo del motor (lib/nutricion.ts, `esLeadCliente` de lib/evolution-envio.ts): por WhatsApp no
// oficial, a un lead que no pagó, un mensaje que no sale solo (`saleSolo`) queda para que una persona lo apruebe en
// Chats › Borradores. La pantalla no lo decía en ningún lado: «Activa», y nada salía.
//
// Puro: lo importan la tab (la línea de la automatización y el chat al activarla) y el server (el conteo).
// =============================================================================

import { rutaChatsDeVista } from './chats-links';
import { esNodoMensaje, idDe, type PasoGrafo } from './flujo-grafo';
import { subarbolRespuesta } from './flujo-conversacion';
import { saleSolo } from './nutricion-grafo-motor';

/** El porqué, en una frase: lo dice el chat al activarla y la línea de la automatización. */
export const POR_QUE_SE_APRUEBAN = 'Por WhatsApp no oficial, los mensajes a leads que no pagaron quedan para que los apruebes';
/** El porqué corto, debajo del conteo (AGENTS.md: el texto que se dibuja, corto). */
export const POR_QUE_CORTO = 'WhatsApp no oficial a leads sin pago';
/** Donde se aprueban: la bandeja «Borradores» de Chats (`?vista=borradores`, ChatsApp). */
export const RUTA_APROBAR = rutaChatsDeVista('borradores');

/** «31 mensajes esperando que los apruebes». null = ninguno (o no se pudo leer): no se dice nada. */
export function textoPorAprobar(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 1) return null;
  const k = Math.trunc(n);
  return k === 1 ? '1 mensaje esperando que lo apruebes' : `${k} mensajes esperando que los apruebes`;
}

/** Los pendientes de cada automatización, de las filas de `wa_borradores` (las sin automatización no cuentan). */
export function contarPorAprobar(filas: ReadonlyArray<{ secuencia_id: number | string | null }>): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of filas) {
    const id = Number(f.secuencia_id);
    if (f.secuencia_id == null || !Number.isInteger(id) || id <= 0) continue;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

/**
 * Los mensajes de WhatsApp de este flujo que le van a quedar como borrador a un lead que no pagó. Con la MISMA regla del
 * motor (`saleSolo`): `revisar` del mensaje y, si no tiene, el «sale sola» de la automatización. Las respuestas de
 * «Si responde» no cuentan: tienen su regla propia (contestan solas sólo con `revisar === false`) y no salen al activar.
 * ⚠️ SÓLO WHATSAPP: Instagram y Messenger no tienen bandeja, y el motor los manda sin pasar por `saleSolo` (`procesarEnvios`).
 */
export function mensajesQueQuedan(pasos: readonly PasoGrafo[], envioAutomatico: boolean): PasoGrafo[] {
  const respuestas = subarbolRespuesta(pasos);
  return pasos.filter((p, i) => esNodoMensaje(p) && p.canal === 'whatsapp' && !respuestas.has(idDe(p, i)) && !saleSolo(p, envioAutomatico));
}

/** Todos los mensajes del flujo, de cualquier canal, sin las respuestas de «Si responde»: el total contra el que se dice cuántos quedan. */
export function mensajesDelFlujo(pasos: readonly PasoGrafo[]): PasoGrafo[] {
  const respuestas = subarbolRespuesta(pasos);
  return pasos.filter((p, i) => esNodoMensaje(p) && !respuestas.has(idDe(p, i)));
}

/** ¿Alguno de este flujo queda para aprobar? (`mensajesQueQuedan`). */
export function dejaBorradores(pasos: readonly PasoGrafo[], envioAutomatico: boolean): boolean {
  return mensajesQueQuedan(pasos, envioAutomatico).length > 0;
}
