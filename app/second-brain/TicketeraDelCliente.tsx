'use client';

// =============================================================================
// La Ticketera del cliente, adentro de su Ops Center (22/10/2026)
// =============================================================================
// Martín: «Que el Ops Center de clientes sea IGUAL que el de SuperAdmin, que tengan su ticketera, pero en este caso ellos suben el
// ticket y ven sus tickets ya subidos y el historial con el status». Es el panel de la del super admin (TicketeraCentro.tsx: la
// cabecera con su «volver») con la pieza del cliente de /tickets adentro (TicketsCliente): levantar uno y ver los suyos, con su
// historial y por dónde lo levantó.
// ⚠️ SÓLO LOS SUYOS: los lee `misTicketsAction` con el workspace y el email de la SESIÓN (app/tickets/acciones.ts). Nada de acá
//    le pasa al servidor de quién son.

import '@/app/tickets/tickets.css';
import { Icon } from '@/app/_components/icons';
import { ErrorState } from '@/app/_ui';
import { TicketsCliente } from '@/app/tickets/TicketsCliente';
import type { MisTickets } from '@/app/tickets/usarMisTickets';

export function TicketeraDelCliente({ mis, onVolver }: { mis: MisTickets; onVolver: () => void }) {
  return (
    <section className="co-panel co-ticketera" aria-label="Ticketera">
      <header className="co-cab">
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
        <div className="co-cab__texto"><h1 className="co-cab__titulo">Ticketera</h1></div>
      </header>
      <div className="co-ticketera__cuerpo">
        {mis.tickets ? <TicketsCliente tickets={mis.tickets} error={null} abierto={null} />
          : mis.error ? <ErrorState titulo="No pude abrir tu Ticketera" detalle={mis.error} />
            : <p className="co-lista__vacio" role="status">Cargando…</p>}
      </div>
    </section>
  );
}
