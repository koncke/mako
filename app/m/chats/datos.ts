// =============================================================================
// /m/chats — lo que LEE la pestaña Chats del teléfono (server), 17/10/2026
// =============================================================================
// La MISMA bandeja unificada de escritorio (`listarChats`, lib/chats.ts, la que sirve GET /api/chats):
// WhatsApp de todas las líneas, Instagram, Messenger y Email, una fila por contacto, con su estado, sus
// no leídos (de quien mira) y su borrador. Hasta el 17/10/2026 el teléfono leía sólo WhatsApp con lead.
//
// ⚠️ ACOTADA, COMO ANTES (medido el 14/10/2026): la bandeja de escritorio barre hasta 20 páginas de
// wa_mensajes EN SERIE por línea (5,5-7,8 s de servidor en el ws1). El teléfono lee las últimas
// `PAGINAS_WHATSAPP_M` páginas: una conversación cuyo último mensaje quedó más atrás no aparece acá (sí
// en la computadora). Y viajan las `TOPE_FILAS_M` más recientes; los contadores de las bandejas se
// cuentan sobre TODAS las leídas, antes del tope.
// =============================================================================

import 'server-only';
import { listarChats, puertaChats, type YoChats } from '@/lib/chats';
import { contarBandejas, opcionesDeCanal, type ConteosBandeja, type OpcionCanal } from '@/lib/chats-reglas';
import type { ChatResumen, EtapaChat } from '@/lib/chats-tipos';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { haceCuanto } from '@/app/m/crm/reglas';
import { PAGINAS_WHATSAPP_M, TOPE_FILAS_M, filasQueViajan, segundaLinea } from './modelo';

/**
 * Una fila del teléfono: la conversación tal cual la arma escritorio, y lo que se dibuja ya calculado. `enTope`: está entre las
 * `TOPE_FILAS_M` más recientes de todas (sin un canal elegido, la lista es ésa); las demás viajan por su línea (`filasQueViajan`).
 */
export type FilaChatM = { chat: ChatResumen; segunda: string; riel: string; enTope: boolean };

export type ChatsM = {
  filas: FilaChatM[];
  conteos: ConteosBandeja;
  /** Quien mira: «Míos» se decide por su nombre (el CRM guarda nombres en setter/closer). */
  yo: YoChats;
  etapas: EtapaChat[];
  /**
   * Los renglones del filtro de canal: cada número de WhatsApp, cada cuenta de Instagram y Messenger, y el Email. La MISMA
   * lista del chip «Canales» de escritorio (`opcionesDeCanal`): el super admin pasa de su número al de MaKo (O48, 18/11/2026).
   * Se arma con TODAS las conversaciones leídas, no sólo las que viajan.
   */
  canales: OpcionCanal[];
  /** Las fuentes que NO se pudieron leer (lib/chats.ts): «no pude leer» no es «no hay chats». */
  fallas: string[];
  /** Cuántas conversaciones quedaron en la computadora por el tope: de todas, y de cada renglón del filtro de canal. */
  fuera: number;
  fueraPorCanal: Record<string, number>;
};

/** null = no hay acceso o no se pudo leer nada (distinto de «no hay chats»). */
export async function leerChatsM(): Promise<ChatsM | null> {
  const puerta = await puertaChats();
  if (!puerta.ok) return null;
  try {
    const [lista, tz, hoy] = await Promise.all([
      listarChats({ usuario: puerta.yo, paginasWhatsapp: PAGINAS_WHATSAPP_M }),
      tzDeWorkspace(puerta.ws).catch(() => TZ_DEFAULT),
      hoyEnWorkspace(),
    ]);
    const ahora = Date.now();
    const canales = opcionesDeCanal(lista.lineas, lista.cuentasSociales, lista.chats);
    // Las 150 más nuevas de todas Y las 150 más nuevas de cada línea o cuenta: elegir la línea de MaKo trae las suyas aunque las
    // más nuevas sean todas del otro número (la revisión de O48, 18/11/2026). Con lo ya leído: no se lee nada de más.
    const viaje = filasQueViajan(lista.chats, canales, TOPE_FILAS_M);
    return {
      filas: viaje.viajan.map(({ chat: c, enTope }): FilaChatM => ({ chat: c, segunda: segundaLinea(c), riel: c.ultimaFecha ? haceCuanto(c.ultimaFecha, ahora, tz, hoy) : '', enTope })),
      conteos: contarBandejas(lista.chats, puerta.yo),
      yo: puerta.yo,
      etapas: lista.etapas,
      canales,
      fallas: lista.fallas,
      fuera: viaje.fueraTodos,
      fueraPorCanal: viaje.fueraPorCanal,
    };
  } catch (e) {
    console.error('[m/chats] no se pudo leer:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Para resolver un link de WhatsApp (`?linea=&chat=`) contra lo que hay. */
export async function chatsParaLink(): Promise<ChatResumen[]> {
  const r = await leerChatsM();
  return r ? r.filas.map((f) => f.chat) : [];
}
