// =============================================================================
// /m/tickets — lo que comparten la lista y el detalle (puro: sin 'use client')
// =============================================================================

import type { TonoPildora } from '@/app/m/_ui/Piezas';
import type { EstadoCliente } from '@/lib/tickets-reglas';

/** El color del punto de cada estado: los mismos tonos que la computadora (`TONO_ESTADO` de app/tickets/TicketsCliente.tsx). */
export const TONO_TICKET: Record<EstadoCliente, TonoPildora> = {
  recibido: 'neutro', en_curso: 'info', tu_respuesta: 'warn', resuelto: 'good', cerrado: 'neutro',
};

/** La pantalla de UN ticket en el teléfono (en la computadora, `/tickets?t=<id>`). */
export const rutaTicketM = (id: number) => `/m/tickets/${id}`;
