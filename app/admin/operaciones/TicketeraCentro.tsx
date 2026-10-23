'use client';

// =============================================================================
// La Ticketera adentro del Centro: los tickets de los usuarios, en el panel de la derecha
// =============================================================================
// Martín (16/10/2026): «elimines la ruta de la ticketera y lo pongas dentro del centro de operaciones... en el botón
// de "ticketera" visualizo todas, pero si es desde un chat, las que lo competen nada más». Las rutas de antes
// (/tickets/decisiones y su lista, y las del teléfono) traen hasta acá con `?ticketera=`.
// ⚠️ Sus hojas (bandeja.css, mazo.css, vistas.css, decisiones.css) las importa la PÁGINA (app/second-brain/pagina.tsx).
//
// ⚠️ DESDE EL 17/10/2026 LA TICKETERA ES LA DE LOS TICKETS DE LOS USUARIOS (`tickets`, app/tickets/bandeja/; Martín: «La
// ticketera desde ahora será exclusiva para los tickets levantados por los usuarios»). Y esa noche (19:31): «Elimina la tab
// de "pregunta de los chats", para eso tenemos en cada chat la notif de "Espera tu respuesta"». El mazo y la lista de las
// preguntas de los chats ya NO se dibujan acá: se contestan en el chat que las hizo (Pregunta.tsx). Un link viejo con
// `?ticketera=tarjetas|lista` abre los tickets (tests/centro-ops6.test.ts).
//
// 22/10/2026 (Martín, desde el teléfono: «vuelva la vista de tarjetas y el desplazamiento tipo tinder... si quiero elegir
// la vista tabla también»): la bandeja es un MAZO para deslizar o una TABLA, a elección (app/tickets/bandeja/MazoTickets.tsx
// y TablaTickets.tsx). Este panel sólo le da la cabecera; los cortes los decide el ancho del PANEL, no el de la ventana.

import { Icon } from '@/app/_components/icons';
import { BandejaTickets } from '@/app/tickets/bandeja/BandejaTickets';
import type { CerebroParaTickets } from '@/app/tickets/bandeja/cerebro';

export function TicketeraCentro({ onVolver, cerebro }: {
  onVolver: () => void;
  /** El chat «Cerebro», listo para firmarle (app/tickets/bandeja/cerebro.ts): «Aprobar» un ticket le manda el pedido. */
  cerebro: CerebroParaTickets | null;
}) {
  return (
    <section className="co-panel co-ticketera" aria-label="Ticketera">
      <header className="co-cab">
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
        <div className="co-cab__texto"><h1 className="co-cab__titulo">Ticketera</h1></div>
      </header>
      <div className="co-ticketera__cuerpo">
        <BandejaTickets cerebro={cerebro} />
      </div>
    </section>
  );
}
