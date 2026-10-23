// =============================================================================
// El hilo de Soporte: la conversación nueva con MaKo y la de un ticket con el equipo, como filas del hilo del Ops Center
// =============================================================================
// La Ticketera del cliente es un chat (23/10/2026, lib/soporte-chat.ts): se dibuja con `HiloMako` y `CajaChat`, como todos.
//   · la conversación NUEVA: los turnos de MaKo y de la persona; una repregunta con opciones lleva sus respuestas rápidas
//     (el bloque G1 `rapida`, el de las conversaciones de Offer), y la última propuesta de ticket lleva su tarjeta;
//   · la de un TICKET mandado: sus líneas (`paraElCliente`: lo que mandó y lo que contestó el equipo), y debajo lo que la
//     persona acaba de escribir mientras sale.
// ⚠️ PURO y con tipos sólo de tipo: lo leen los tests en node (las piezas del hilo traen CSS y no cargan ahí).

import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { Tono } from '@/app/_ui/tokens';
import type { Borrador } from '@/lib/soporte-chat';
import type { EstadoCliente, TicketCliente } from '@/lib/tickets-reglas';

export type Turno = {
  id: string;
  de: 'mako' | 'persona';
  texto: string;
  at: string;
  /** Las respuestas rápidas de una repregunta («¿En qué parte de MaKo te pasó?»). */
  opciones?: readonly string[];
  /** El ticket armado: su tarjeta, con «Mandárselo al equipo». */
  borrador?: Borrador;
  /** Lo de la persona mientras sale, o si no salió (un 4xx: se puede mandar otra vez). */
  estado?: 'enviando' | 'error';
  error?: string;
};

export function itemsDeCharla(turnos: readonly Turno[]): ItemHilo[] {
  const out: ItemHilo[] = [];
  turnos.forEach((t, i) => {
    if (t.de === 'persona') {
      out.push({ k: 'msg', id: t.id, role: 'user', texto: t.texto, at: t.at, ...(t.estado ? { estado: t.estado } : {}), ...(t.error ? { error: t.error } : {}) });
      return;
    }
    out.push({ k: 'msg', id: t.id, role: 'assistant', texto: t.texto, at: t.at });
    if (t.opciones?.length) {
      // La que ya contestó (lo que escribió después) se ve contestada y no se toca.
      const despues = turnos.slice(i + 1).find((x) => x.de === 'persona');
      out.push({
        k: 'bloque', id: `${t.id}-op`, b: { t: 'pregunta', pregunta: t.texto, opciones: t.opciones.map((titulo) => ({ titulo })), rapida: true },
        ...(despues ? { respondida: despues.texto } : {}),
      });
    }
  });
  return out;
}

/** La tarjeta va en la ÚLTIMA propuesta: si la persona siguió contando, la de antes quedó vieja. */
export function idDelBorrador(turnos: readonly Turno[]): string | null {
  for (let i = turnos.length - 1; i >= 0; i--) if (turnos[i].borrador) return turnos[i].id;
  return null;
}

/** La conversación de un ticket: lo que mandó, lo que contestó el equipo y lo que se está mandando ahora. */
export function itemsDeTicket(t: TicketCliente, extra: readonly Turno[] = []): ItemHilo[] {
  return [
    ...t.lineas.map((l, i): ItemHilo => ({ k: 'msg', id: `t${t.id}-${i}`, role: l.quien === 'tu' ? 'user' : 'assistant', texto: l.texto, at: l.at })),
    ...itemsDeCharla(extra),
  ];
}

/** El color de cada estado, el mismo de la bandeja y del teléfono (app/m/tickets/modelo.ts). */
export const TONO_ESTADO: Record<EstadoCliente, Tono> = { recibido: 'neutral', en_curso: 'info', tu_respuesta: 'warn', resuelto: 'good', cerrado: 'neutral' };

/** Lo que dice la caja: en la conversación nueva, y en un ticket según en qué anda. */
export function placeholderDe(t: TicketCliente | null, contando: boolean): string {
  if (!t) return contando ? 'Suma algo, o mándale el ticket al equipo' : 'Cuéntale a MaKo qué pasó';
  if (!t.puedeResponder) return 'Este ticket está cerrado. Si vuelve a pasar, empieza uno nuevo.';
  return t.estado === 'tu_respuesta' ? 'Contesta lo que te preguntó el equipo' : 'Suma un dato para el equipo';
}
