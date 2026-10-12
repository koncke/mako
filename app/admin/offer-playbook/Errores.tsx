// =============================================================================
// Errores — §8 del marco: los errores que más se repiten entre los autores
// =============================================================================
// Una tarjeta por fila de la tabla del documento (el error, cómo se ve y quién lo
// señala). Si la tabla cambia de forma, se dibuja la sección entera con MarkdownDoc:
// lo que no se entiende no se esconde.
//
// Sin 'use client': se dibuja en el servidor.
// =============================================================================

import { Md } from './Desplegable';
import { partirErrores, sinCursivas, type Seccion } from './secciones';

/** Una celda de la tabla, sin las marcas de markdown (en una tarjeta no hacen falta). */
const plano = (s: string) => sinCursivas(s).replace(/\*\*/g, '').replace(/`/g, '');

/** Las secciones que el reparto manda a esta pestaña (hoy, sólo el §8). */
export function Errores({ secciones }: { secciones: readonly Seccion[] }) {
  if (!secciones.length) return <p className="opb-tenue" style={{ margin: 0 }}>El marco no tiene esta sección.</p>;
  return <>{secciones.map((s) => <UnaSeccion key={s.numero} seccion={s} />)}</>;
}

function UnaSeccion({ seccion }: { seccion: Seccion }) {
  const { antes, filas, despues } = partirErrores(seccion.cuerpo);
  if (!filas) return <section id={seccion.id} className="opb-sec"><Md texto={seccion.cuerpo} /></section>;
  return (
    <section id={seccion.id} className="opb-sec">
      {antes && <Md texto={antes} />}
      <div className="opb-errores">
        {filas.map((f) => (
          <article key={f.n} className="opb-error">
            <div className="opb-error__cab">
              <span className="opb-error__n">{plano(f.n)}</span>
              <h3 className="opb-error__t">{plano(f.error)}</h3>
            </div>
            <p className="opb-error__ve">{plano(f.comoSeVe)}</p>
            <div className="opb-chips">
              <span className="opb-et">Lo señalan</span>
              {f.senalan.map((s, i) => <span key={i} className="opb-chip">{plano(s)}</span>)}
            </div>
          </article>
        ))}
      </div>
      {despues && <div className="opb-nota"><Md texto={despues} /></div>}
    </section>
  );
}
