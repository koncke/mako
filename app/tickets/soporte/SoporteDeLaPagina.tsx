'use client';

// /tickets («Reportar problema» en el menú): el mismo chat de Soporte que la Ticketera del Ops Center (23/10/2026), en la
// página. `?t=<id>` (el link de un aviso) abre ESE ticket. Con next/dynamic: las piezas del chat traen CSS.

import dynamic from 'next/dynamic';
import type { TicketCliente } from '@/lib/tickets-reglas';

const ChatSoporte = dynamic(() => import('./ChatSoporte'), { ssr: false, loading: () => <p className="tickets-cargando" role="status">Cargando…</p> });

export function SoporteDeLaPagina({ tickets, abierto }: { tickets: TicketCliente[]; abierto: number | null }) {
  return (
    <div className="tickets-chat">
      <ChatSoporte tickets={tickets} inicial={abierto ?? 'nuevo'} onVolver={() => window.history.back()} />
    </div>
  );
}
