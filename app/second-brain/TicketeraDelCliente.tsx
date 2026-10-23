'use client';

// =============================================================================
// La Ticketera del cliente, adentro de su Ops Center (22/10/2026)
// =============================================================================
// Martín: «Que el Ops Center de clientes sea IGUAL que el de SuperAdmin, que tengan su ticketera, pero en este caso ellos suben el
// ticket y ven sus tickets ya subidos y el historial con el status».
// DESDE EL 23/10/2026 ES UN CHAT (Martín, 22/10: «se ve bastante feo... Cuando podría tener el mismo diseño que un chat y que los
// usuarios le comenten a MaKo cual fue su problema»): el chat de Soporte (app/tickets/soporte/ChatSoporte.tsx), con la cabecera,
// el hilo y la caja de los chats del Ops Center, sus tickets arriba con su estado, y cada conversación termina en un ticket.
// Va con next/dynamic: las piezas del chat traen CSS, y este archivo lo leen tests.
// ⚠️ SÓLO LOS SUYOS: los lee `misTicketsAction` con el workspace y el email de la SESIÓN (app/tickets/acciones.ts). Nada de acá
//    le pasa al servidor de quién son.

import '@/app/tickets/tickets.css';
import dynamic from 'next/dynamic';
import { Icon } from '@/app/_components/icons';
import { ErrorState } from '@/app/_ui';
import type { MisTickets } from '@/app/tickets/usarMisTickets';

const ChatSoporte = dynamic(() => import('@/app/tickets/soporte/ChatSoporte'), {
  ssr: false,
  loading: () => <section className="co-panel co-ticketera" aria-label="Ticketera"><p className="co-lista__vacio" role="status">Cargando…</p></section>,
});

export function TicketeraDelCliente({ mis, onVolver }: { mis: MisTickets; onVolver: () => void }) {
  // Sin poder leer sus tickets se dice; mientras llegan, la conversación con MaKo ya se puede empezar.
  if (!mis.tickets && mis.error) {
    return (
      <section className="co-panel co-ticketera" aria-label="Ticketera">
        <header className="co-cab">
          <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
            <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
          </button>
          <div className="co-cab__texto"><h1 className="co-cab__titulo">Ticketera</h1></div>
        </header>
        <div className="co-ticketera__cuerpo"><ErrorState titulo="No pude abrir tu Ticketera" detalle={mis.error} /></div>
      </section>
    );
  }
  return <ChatSoporte tickets={mis.tickets} onVolver={onVolver} />;
}
