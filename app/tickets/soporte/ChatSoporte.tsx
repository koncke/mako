'use client';

// =============================================================================
// La Ticketera del cliente como un CHAT con MaKo, en la computadora (23/10/2026)
// =============================================================================
// Martín (22/10/2026): «Mira la ticketera, se ve bastante feo... Cuando podría tener el mismo diseño que un chat y que los
// usuarios le comenten a MaKo cual fue su problema... Tal vez alguna diferencia con los otros chats, pero ese debe ser la
// principal funcionalidad». El panel de un chat del Ops Center (PanelDeChat: la cabecera, el hilo y la caja únicos) con:
//   · en la cabecera, al lado de «Soporte», el botón con el ícono de lista: sus tickets con en qué anda cada uno, y «Contarle
//     a MaKo» para empezar otro (Martín, 23/10/2026: «No donde los pusiste actualmente», la tira de chips de abajo);
//   · la conversación: la nueva con MaKo, que termina en la tarjeta del ticket, o la de un ticket con el equipo (arriba, en
//     qué anda ese ticket);
//   · la criatura es la de MaKo, la estrella («la criatura debe ser la de MaKo»).
// ⚠️ LA CAJA VA ADENTRO DE `.co-caja`, como en el chat del Cerebro (ChatSecondBrain.tsx) y en Conversacion.tsx: el marco
//    redondeado, el alto y el campo sin el tirador del textarea son de esa clase. Sin ella, la caja salía rota (23/10/2026).
// La montan la Ticketera del Ops Center del cliente (app/second-brain/TicketeraDelCliente.tsx) y /tickets, con next/dynamic.

import { useCallback, useRef } from 'react';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import type { TicketCliente } from '@/lib/tickets-reglas';
import { CajaSoporte, EstadoDelTicket, HiloSoporte, ListaTickets, QUIEN_SOPORTE } from './PiezasSoporte';
import { useSoporte, type Abierto } from './useSoporte';

export default function ChatSoporte({ tickets, inicial = 'nuevo', onVolver }: {
  tickets: TicketCliente[] | null;
  inicial?: Abierto;
  onVolver: () => void;
}) {
  const s = useSoporte({ tickets, inicial });
  const hilo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seguir = useCallback(() => hilo.current, []);
  return (
    <PanelDeChat
      cabecera={{ clave: 'soporte', titulo: 'Soporte', criatura: QUIEN_SOPORTE.nombre, aspecto: QUIEN_SOPORTE.aspecto,
        animo: s.mandando || s.enviando ? 'trabajando' : 'despierto', acciones: <ListaTickets s={s} />, onVolver }}
      hilo={hilo}
      arriba={s.ticket ? <div className="sp-arriba"><EstadoDelTicket s={s} /></div> : undefined}
      caja={<div className="co-caja"><CajaSoporte s={s} campo={campo} seguir={seguir} /></div>}
      estado={s.cargando ? 'Abriendo el ticket…' : ''}>
      <HiloSoporte s={s} hilo={hilo} />
    </PanelDeChat>
  );
}
