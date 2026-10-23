'use client';

// =============================================================================
// La Ticketera del cliente como un CHAT con MaKo, en la computadora (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «Mira la ticketera, se ve bastante feo... Cuando podría tener el mismo diseño que un chat y que los
// usuarios le comenten a MaKo cual fue su problema... Tal vez alguna diferencia con los otros chats, pero ese debe ser la
// principal funcionalidad». El panel de un chat del Ops Center (PanelDeChat: la cabecera, el hilo y la caja únicos) con:
//   · arriba, la tira de sus tickets con en qué anda cada uno, y «Contarle a MaKo» para empezar otro;
//   · la conversación: la nueva con MaKo, que termina en la tarjeta del ticket, o la de un ticket con el equipo;
//   · la cabecera de Soporte (su criatura), que es la diferencia con los otros chats.
// La montan la Ticketera del Ops Center del cliente (app/second-brain/TicketeraDelCliente.tsx) y /tickets, con next/dynamic.

import { useRef } from 'react';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import type { TicketCliente } from '@/lib/tickets-reglas';
import { CajaSoporte, EstadoDelTicket, HiloSoporte, TiraTickets } from './PiezasSoporte';
import { useSoporte, type Abierto } from './useSoporte';

export default function ChatSoporte({ tickets, inicial = 'nuevo', onVolver }: {
  tickets: TicketCliente[] | null;
  inicial?: Abierto;
  onVolver: () => void;
}) {
  const s = useSoporte({ tickets, inicial });
  const hilo = useRef<HTMLDivElement>(null);
  return (
    <PanelDeChat
      cabecera={{ clave: 'soporte', titulo: 'Soporte', animo: s.mandando || s.enviando ? 'trabajando' : 'despierto', onVolver }}
      hilo={hilo}
      arriba={<div className="sp-arriba"><TiraTickets s={s} /><EstadoDelTicket s={s} /></div>}
      caja={<CajaSoporte s={s} />}
      estado={s.cargando ? 'Abriendo el ticket…' : ''}>
      <HiloSoporte s={s} hilo={hilo} />
    </PanelDeChat>
  );
}
