// =============================================================================
// La lista de la Ticketera — la vista SECUNDARIA (la de entrada es el mazo, app/tickets/decisiones)
// =============================================================================
// Una tarjeta por decisión pendiente, en grupos por urgencia (lo que frena a un chat primero). Las
// contestadas quedan plegadas al final, con su respuesta a la vista y la tarjeta adentro para
// cambiarla. La dibujan /tickets/decisiones/lista (computadora) y /m/decisiones (teléfono).
//
// ⚠️ Martín, 14/10/2026: «Sacá el capital», «Sacá los 18 días»: la Ticketera es para DECIDIR, no
// para informar el estado del runway. Acá no va plata, ni plazos, ni links a la foto o a Strategy.
//
// ⚠️ UN componente para las dos pantallas: el teléfono no tiene una copia (AGENTS.md, MaKo
// Mobile: lo que /m reusa de escritorio no se copia). Sin `Pagina` ni nada de escritorio
// adentro: el marco lo pone cada página.

import { TarjetaDecision } from './TarjetaDecision';
import { repartir, textoDeRespuesta, URGENCIAS, type AccionResponder, type Decision, type LecturaDecisiones } from './decisiones';
import { CambioVista, type VistaTicketera } from '@/app/tickets/decisiones/CambioVista';

function Contestada({ d, responder }: { d: Decision; responder: AccionResponder }) {
  return (
    <details className="decisiones-hecha">
      <summary>
        <span className="decisiones-hecha-tilde" aria-hidden>✓</span>
        <span className="decisiones-hecha-txt">
          <span className="decisiones-hecha-preg">{d.pregunta}</span>
          <span className="decisiones-hecha-resp">{textoDeRespuesta(d)}</span>
        </span>
        <span className={`decisiones-hecha-estado${d.recogidaAt ? '' : ' decisiones-hecha-estado--nueva'}`}>
          {d.recogidaAt ? 'El chat ya la tiene' : 'Nueva'}
        </span>
      </summary>
      <div className="decisiones-hecha-cuerpo"><TarjetaDecision d={d} responder={responder} /></div>
    </details>
  );
}

export function TableroDecisiones({ lectura, responder, onCambioVista }: {
  lectura: LecturaDecisiones;
  /** La acción que guarda una respuesta (app/admin/runway/acciones.ts), que pasa la página. */
  responder: AccionResponder;
  /** Adentro del Centro: cambiar a las tarjetas sin irse de la pantalla. */
  onCambioVista?: (v: VistaTicketera) => void;
}) {
  if (!lectura.ok) {
    return (
      <div className="decisiones">
        <p className="decisiones-falla">
          {lectura.faltaTabla ? 'Falta crear la tabla de decisiones (migración 0277).' : 'No se pudieron leer las decisiones. Prueba de nuevo en un rato.'}
        </p>
      </div>
    );
  }

  const { pendientes, contestadas } = repartir(lectura.decisiones);
  const hayPendientes = URGENCIAS.some((u) => pendientes[u.clave].length > 0);

  return (
    <div className="decisiones">
      <CambioVista actual="lista" onCambio={onCambioVista} />

      {!hayPendientes && <p className="decisiones-vacio">No hay nada esperando una decisión.</p>}

      {URGENCIAS.map((u) => pendientes[u.clave].length > 0 && (
        <section key={u.clave} className={`decisiones-grupo decisiones-grupo--${u.clave}`}>
          <h2 className="decisiones-grupo-t">
            {u.titulo} <span className="decisiones-grupo-n">{pendientes[u.clave].length}</span>
          </h2>
          <div className="decisiones-lista">
            {pendientes[u.clave].map((d) => <TarjetaDecision key={d.id} d={d} responder={responder} />)}
          </div>
        </section>
      ))}

      {contestadas.length > 0 && (
        <details className="decisiones-contestadas">
          <summary>
            <h2 className="decisiones-grupo-t">
              Contestadas <span className="decisiones-grupo-n">{contestadas.length}</span>
            </h2>
          </summary>
          <div className="decisiones-lista decisiones-lista--hechas">
            {contestadas.map((d) => <Contestada key={d.id} d={d} responder={responder} />)}
          </div>
        </details>
      )}

    </div>
  );
}
