// =============================================================================
// Discrepancias — §9 del marco: dónde discrepan los autores y qué adopta MaKo
// =============================================================================
// Una tarjeta plegable por «### 9.x»: el título es la pregunta, y adentro va el
// texto del documento con MarkdownDoc, con el criterio de MaKo destacado (la viñeta
// «**MaKo.**» del documento). Lo que no tenga esa forma se dibuja tal cual: un
// cambio del documento no puede hacer desaparecer nada.
//
// Sin 'use client': se dibuja en el servidor.
// =============================================================================

import { Desplegable, Md } from './Desplegable';
import { partirDiscrepancias, esCriterioDeMako, type Seccion } from './secciones';

/** Las secciones que el reparto manda a esta pestaña (hoy, sólo el §9). */
export function Discrepancias({ secciones, ver }: { secciones: readonly Seccion[]; ver: string | null }) {
  if (!secciones.length) return <p className="opb-tenue" style={{ margin: 0 }}>El marco no tiene esta sección.</p>;
  return <>{secciones.map((s) => <UnaSeccion key={s.numero} seccion={s} ver={ver} />)}</>;
}

function UnaSeccion({ seccion, ver }: { seccion: Seccion; ver: string | null }) {
  const { preambulo, items } = partirDiscrepancias(seccion.cuerpo);
  return (
    <section id={seccion.id} className="opb-sec">
      {preambulo && <Md texto={preambulo} />}
      {items.length > 0 ? (
        <div className="opb-dets">
          {items.map((d) => (
            <Desplegable key={d.clave} id={d.id} titulo={d.titulo} meta={`§${d.clave}`} abierto={ver === d.clave}>
              {d.tramos.map((t, i) => esCriterioDeMako(t) ? (
                <div key={i} className="opb-mako">
                  <p className="opb-mako__et">Criterio de MaKo</p>
                  <Md texto={t.texto} />
                </div>
              ) : t.etiqueta ? (
                <div key={i}>
                  <p className="opb-tramo__et">{t.etiqueta}</p>
                  <Md texto={t.texto} />
                </div>
              ) : (
                <Md key={i} texto={t.texto} />
              ))}
            </Desplegable>
          ))}
        </div>
      ) : (
        <Md texto={seccion.cuerpo} />
      )}
    </section>
  );
}
