'use client';

// =============================================================================
// El chat de Soporte en el teléfono (23/10/2026): la hoja para contarle a MaKo y la conversación de un ticket
// =============================================================================
// Lo mismo que la computadora (app/tickets/soporte/ChatSoporte.tsx), destilado (MaKo Mobile: el teléfono DESTILA el escritorio):
//   · /m/tickets es la lista de sus tickets; «Contarle a MaKo» abre una hoja con la conversación nueva (como un chat del Ops
//     Center en el teléfono: ChatClienteM), que termina en la tarjeta del ticket;
//   · /m/tickets/<id> es la conversación de ESE ticket con el equipo, con la caja fija abajo (como /m/chats/<clave>).
// El motor es el mismo (useSoporte), y las piezas también (PiezasSoporte).

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useRef } from 'react';
import { SheetM } from '@/app/m/_ui';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import type { TicketCliente } from '@/lib/tickets-reglas';
import { CajaSoporte, EstadoDelTicket, HiloSoporte, QUIEN_SOPORTE } from '@/app/tickets/soporte/PiezasSoporte';
import { useSoporte, type Soporte } from '@/app/tickets/soporte/useSoporte';

const Titulo = ({ s }: { s: Soporte }) => (
  <span className="m-operaciones-titulo">
    {/* La criatura de MaKo, la estrella (23/10/2026), como en la computadora. */}
    <span className="m-operaciones-titulo__muneco"><Muneco titulo={QUIEN_SOPORTE.nombre} aspecto={QUIEN_SOPORTE.aspecto} animo={s.mandando ? 'trabajando' : 'despierto'} size={34} /></span>
    <span className="m-operaciones-titulo__texto"><span className="m-operaciones-titulo__nombre">{s.ticket ? `Ticket #${s.ticket.id}` : 'Soporte'}</span></span>
  </span>
);

/** La hoja de la conversación nueva con MaKo. Al mandar el ticket, sigue ahí con el «Listo» y la conversación de ese ticket. */
export function HojaSoporteM({ s, abierta, onCerrar }: { s: Soporte; abierta: boolean; onCerrar: () => void }) {
  const hilo = useRef<HTMLDivElement>(null);
  return (
    <SheetM id="soporte" abierto={abierta} onCerrar={onCerrar} snap="alto" titulo={<Titulo s={s} />} ocupado={s.mandando}
      pie={<div className="m-operaciones-caja"><CajaSoporte s={s} movil /></div>}>
      <div className="m-operaciones-hilo" ref={hilo}>
        {s.ticket && <div className="m-soporte-estado"><EstadoDelTicket s={s} /></div>}
        <HiloSoporte s={s} hilo={hilo} />
      </div>
    </SheetM>
  );
}

/** /m/tickets/<id>: la conversación de un ticket con el equipo, y la caja fija abajo. */
export function ChatTicketM({ t }: { t: TicketCliente }) {
  const s = useSoporte({ tickets: [t], inicial: t.id, movil: true });
  const hilo = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="m-soporte-estado"><EstadoDelTicket s={s} /></div>
      <div className="m-operaciones-hilo m-soporte-hilo" ref={hilo}><HiloSoporte s={s} hilo={hilo} /></div>
      <div className="m-soporte-caja m-operaciones-caja" data-m-sin-barra><CajaSoporte s={s} movil /></div>
    </>
  );
}
