'use client';

// =============================================================================
// La Ticketera adentro del Centro (16/10/2026): el mazo y la lista de siempre, en el panel de la derecha
// =============================================================================
// Martín (16/10/2026): «elimines la ruta de la ticketera y lo pongas dentro del centro de operaciones... en el botón
// de "ticketera" visualizo todas, pero si es desde un chat, las que lo competen nada más», y «La ticketera con los
// desplegables queda para el botón de "ticketera" de arriba». Y mirándolo en producción: «No veo el botón de la
// ticketera dentro del Centro».
//
// Es LA MISMA Ticketera (app/tickets/decisiones/Mazo.tsx y app/admin/runway/Tablero.tsx), no una copia: el mazo con
// sus gestos y la lista con las contestadas en su desplegable, contestando con las mismas acciones. Lo único nuevo es
// que el «Tarjetas | Lista» cambia de vista acá adentro, sin irse de la pantalla. Las rutas de antes
// (/tickets/decisiones y su lista, y las del teléfono) traen hasta acá con `?ticketera=`.
// ⚠️ Sus hojas (mazo.css, vistas.css, decisiones.css) las importa la PÁGINA (app/admin/operaciones/page.tsx).

import { Icon } from '@/app/_components/icons';
import type { AccionDeshacer, AccionResponder, Decision, LecturaDecisiones } from '@/app/admin/runway/decisiones';
import { MazoDecisiones } from '@/app/tickets/decisiones/Mazo';
import { TableroDecisiones } from '@/app/admin/runway/Tablero';
import type { VistaTicketera } from '@/app/tickets/decisiones/CambioVista';

export function TicketeraCentro({ decisiones, vista, onVista, responder, deshacer, onVolver }: {
  /** null = no se pudieron leer (la Ticketera lo dice: no dibuja un mazo vacío que se lee «no hay nada»). */
  decisiones: readonly Decision[] | null;
  vista: VistaTicketera;
  onVista: (v: VistaTicketera) => void;
  responder: AccionResponder;
  deshacer: AccionDeshacer;
  onVolver: () => void;
}) {
  const lectura: LecturaDecisiones = decisiones
    ? { ok: true, decisiones: [...decisiones] }
    : { ok: false, faltaTabla: false, error: 'no se pudieron leer' };
  return (
    <section className="co-panel co-ticketera" aria-label="Ticketera">
      <header className="co-cab">
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
        <div className="co-cab__texto"><h1 className="co-cab__titulo">Ticketera</h1></div>
      </header>
      <div className="co-ticketera__cuerpo">
        {vista === 'tarjetas'
          ? <MazoDecisiones lectura={lectura} responder={responder} deshacer={deshacer} onCambioVista={onVista} />
          : <TableroDecisiones lectura={lectura} responder={responder} onCambioVista={onVista} />}
      </div>
    </section>
  );
}
