// =============================================================================
// Lo que se confirma AFUERA del chat vuelve al hilo de donde salió (20/10/2026, ola 1, pieza 1.8)
// =============================================================================
// docs/ops-center-principal.md §2.6: «Lo confirmado en /mako/revisar anota "Hecho: …" en el hilo de donde salió». Una
// propuesta de pantalla que nació en un chat de la app guarda la clave de ESE chat (`datos.canalKey`, `app:<sesión>`,
// lib/api-mako/acciones.ts → proponerPantallaGenerica). Al confirmarla o descartarla en su pantalla, esto deja el
// resultado en ese hilo, con lo que dibuja (lib/chat-bloques.ts), igual que la tarjeta del chat.
//
// ⚠️ LA SESIÓN SE BUSCA EN EL WORKSPACE QUE CONFIRMA (`getSession` va por la base del inquilino): una clave de otro
//    negocio no encuentra nada y no se anota. Un paso de un flujo (`app:flujo:…`) no es un chat: tampoco.
// ⚠️ NUNCA TIRA: la acción ya quedó hecha; no poder anotarla no la deshace.

import 'server-only';
import { appendMessage, getSession } from './chart-chats';
import { PREFIJO_APP, PREFIJO_FLUJO } from './api-mako/canal';
import { aGuardar, type Bloque } from './chat-bloques';

/** La sesión del chat de la app de una clave (`app:<id>`), o null (WhatsApp, la API, un flujo, algo que no calza). */
export function sesionDeClave(clave: unknown): number | null {
  if (typeof clave !== 'string' || !clave.startsWith(PREFIJO_APP) || clave.startsWith(PREFIJO_FLUJO)) return null;
  const m = /^app:([1-9][0-9]{0,14})$/.exec(clave);
  return m ? Number(m[1]) : null;
}

/** Anota `texto` (y lo que dibuja) en el chat de donde salió la propuesta. true = quedó anotado. */
export async function anotarEnHiloDeOrigen(canalKey: unknown, texto: string, bloques: readonly Bloque[] = []): Promise<boolean> {
  const id = sesionDeClave(canalKey);
  if (id == null) return false;
  try {
    if (!(await getSession(id))) return false;
    await appendMessage(id, 'assistant', texto, bloques.length ? bloques.map(aGuardar) : undefined);
    return true;
  } catch (e) {
    console.error(`[chat-hilo-origen] no pude anotar en la sesión ${id}:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}
