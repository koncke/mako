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
import { contarBandejas, type ConteosBandeja } from '@/lib/chats-reglas';
import type { ChatResumen, EtapaChat } from '@/lib/chats-tipos';
import { tzDeWorkspace, TZ_DEFAULT, hoyEnWorkspace } from '@/lib/timezone';
import { haceCuanto } from '@/app/m/crm/reglas';
import { PAGINAS_WHATSAPP_M, TOPE_FILAS_M, canalesPresentes, segundaLinea } from './modelo';

/** Una fila del teléfono: la conversación tal cual la arma escritorio, y lo que se dibuja ya calculado. */
export type FilaChatM = { chat: ChatResumen; segunda: string; riel: string };

export type ChatsM = {
  filas: FilaChatM[];
  conteos: ConteosBandeja;
  /** Quien mira: «Míos» se decide por su nombre (el CRM guarda nombres en setter/closer). */
  yo: YoChats;
  etapas: EtapaChat[];
  canales: ReturnType<typeof canalesPresentes>;
  /** Las fuentes que NO se pudieron leer (lib/chats.ts): «no pude leer» no es «no hay chats». */
  fallas: string[];
  /** Cuántas conversaciones quedaron en la computadora por el tope. */
  fuera: number;
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
    const visibles = lista.chats.slice(0, TOPE_FILAS_M);
    return {
      filas: visibles.map((c): FilaChatM => ({ chat: c, segunda: segundaLinea(c), riel: c.ultimaFecha ? haceCuanto(c.ultimaFecha, ahora, tz, hoy) : '' })),
      conteos: contarBandejas(lista.chats, puerta.yo),
      yo: puerta.yo,
      etapas: lista.etapas,
      canales: canalesPresentes(lista.chats),
      fallas: lista.fallas,
      fuera: Math.max(0, lista.chats.length - visibles.length),
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
