// =============================================================================
// Criterio — la pestaña «Criterio» de Offer Playbook
// =============================================================================
// Pedido de Martín (11/10/2026, tarde): «simplifica mucho, que sea más legible,
// más fácil, más gráfico». Arriba lo que corre (indicadores, piezas y rúbrica,
// leídos de lib/offer-marco.ts por EnElCodigo); al medio, cómo sale la nota, tal
// cual lo dice el «Cómo se lee» del §4; abajo, el documento entero partido en
// desplegables. Ninguna sección del §1 al §7 se queda afuera: lo fija el test.
//
// Sin 'use client': todo se dibuja en el servidor.
// =============================================================================

import { PIEZAS, DIMENSIONES } from '@/lib/offer-marco';
import { Indicadores, GrillaPiezas, TablaRubrica } from './EnElCodigo';
import { Desplegable, CuerpoDeSecciones, Md } from './Desplegable';
import { BLOQUES_CRITERIO, seccionesDeBloque, partirRubrica, idBloque, type Seccion } from './secciones';

/** El «Cómo se lee» de la rúbrica, y las secciones del bloque sin él (para no repetirlo). */
function rubricaPartida(doc: string): { comoSeLee: string; secciones: Seccion[] } {
  let comoSeLee = '';
  const secciones = seccionesDeBloque(doc, 'rubrica').secciones.map((s) => {
    if (comoSeLee) return s;
    const p = partirRubrica(s.cuerpo);
    if (!p.comoSeLee) return s;
    comoSeLee = p.comoSeLee;
    return { ...s, cuerpo: p.resto };
  });
  return { comoSeLee, secciones };
}

export function Criterio({ doc, ver }: { doc: string; ver: string | null }) {
  const rubrica = rubricaPartida(doc);
  const bloques = BLOQUES_CRITERIO.map((b) => {
    const { intro, secciones } = b.id === 'rubrica'
      ? { intro: null, secciones: rubrica.secciones }
      : seccionesDeBloque(doc, b.id);
    return { ...b, intro, secciones };
  }).filter((b) => b.intro || b.secciones.length);

  return (
    <>
      <Indicadores />

      <section className="opb-sec">
        <h2 className="opb-h">Las piezas <span className="opb-h__n">{PIEZAS.length}</span></h2>
        <GrillaPiezas />
      </section>

      <section className="opb-sec">
        <h2 className="opb-h">Rúbrica <span className="opb-h__n">{DIMENSIONES.length}</span></h2>
        <TablaRubrica />
        {rubrica.comoSeLee && (
          <div className="opb-nota">
            <h3 className="opb-nota__t">Cómo sale la nota</h3>
            <Md texto={rubrica.comoSeLee} />
          </div>
        )}
      </section>

      <section className="opb-sec">
        <h2 className="opb-h">En detalle</h2>
        <div className="opb-dets">
          {bloques.map((b) => (
            <Desplegable
              key={b.id}
              id={idBloque(b.id)}
              titulo={b.titulo}
              meta={b.secciones.map((s) => `§${s.numero}`).join(' · ')}
              abierto={ver === b.id}
            >
              <CuerpoDeSecciones intro={b.intro} secciones={b.secciones} conTitulos={!!b.intro || b.secciones.length > 1} />
            </Desplegable>
          ))}
        </div>
      </section>
    </>
  );
}
