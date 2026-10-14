// =============================================================================
// El tablero de decisiones — lo dibujan /admin/runway (computadora) y /m/decisiones (teléfono)
// =============================================================================
// Arriba, tres números grandes: cuántas esperan, el capital y los días a los anuncios.
// Abajo, una tarjeta por decisión pendiente, en tres grupos por urgencia (lo que frena a un
// chat primero). Las contestadas quedan plegadas al final, con su respuesta a la vista y la
// tarjeta adentro para cambiarla.
//
// ⚠️ UN componente para las dos pantallas: el teléfono no tiene una copia (AGENTS.md, MaKo
// Mobile: lo que /m reusa de escritorio no se copia). Sin `Pagina` ni nada de escritorio
// adentro: el marco lo pone cada página.

import Link from '@/app/_ui/Link';
import { TarjetaDecision } from './TarjetaDecision';
import { repartir, textoDeRespuesta, URGENCIAS, type AccionResponder, type Decision, type LecturaDecisiones } from './decisiones';
import { CAPITAL, HITO_ANUNCIOS, HITO_PLATA, faltan } from '@/app/admin/estrategia/datos';
import { textoPlazo } from './datos';

function Cifra({ clave, valor, sub, fuerte }: { clave: string; valor: string; sub?: string; fuerte?: boolean }) {
  return (
    <div className={`decisiones-cifra${fuerte ? ' decisiones-cifra--fuerte' : ''}`}>
      <p className="decisiones-cifra-k">{clave}</p>
      <p className="decisiones-cifra-v">{valor}</p>
      {sub && <p className="decisiones-cifra-s">{sub}</p>}
    </div>
  );
}

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

export function TableroDecisiones({ lectura, hoy, responder, conFoto = true }: {
  lectura: LecturaDecisiones;
  hoy: string;
  /** La acción que guarda una respuesta (app/admin/runway/acciones.ts), que pasa la página. */
  responder: AccionResponder;
  /** El link a la foto vieja del lanzamiento (sólo en la computadora: es una pantalla ancha). */
  conFoto?: boolean;
}) {
  const aCapital = faltan(HITO_PLATA.fecha, hoy);
  const aAnuncios = faltan(HITO_ANUNCIOS.fecha, hoy);

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
  // Los avisos no son decisiones: no cuentan en «Para decidir».
  const total = URGENCIAS.reduce((s, u) => s + (u.clave === 'aviso' ? 0 : pendientes[u.clave].length), 0);
  const hayPendientes = URGENCIAS.some((u) => pendientes[u.clave].length > 0);

  return (
    <div className="decisiones">
      <div className="decisiones-cifras">
        <Cifra clave="Para decidir" valor={String(total)} sub={total === 1 ? 'decisión' : 'decisiones'} fuerte />
        <Cifra clave="Capital" valor={CAPITAL} sub={aCapital > 0 ? `se acaba en ${textoPlazo(aCapital)}` : 'se acabó'} />
        <Cifra clave="Anuncios" valor={aAnuncios > 0 ? textoPlazo(aAnuncios) : 'en curso'} sub={`arrancan el ${HITO_ANUNCIOS.rotulo}`} />
      </div>

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

      {conFoto && (
        <p className="decisiones-pie">
          <Link href="/admin/runway/foto">La foto del lanzamiento (3/10) →</Link>
          <Link href="/admin/estrategia">Strategy →</Link>
        </p>
      )}
    </div>
  );
}
