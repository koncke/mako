// =============================================================================
// ListaPendientes — la pestaña «A definir»: una tarjeta de decisión por pendiente
// =============================================================================
// Los datos viven en pendientes.ts. Cada tarjeta: número, título, qué pasa hoy,
// qué hay que decidir, las opciones con su consecuencia y la recomendación (la
// opción recomendada va resaltada, y además se dice con letras: el color nunca es
// lo único que la marca). Agrupadas en Correcciones y Decisiones.
//
// (El nombre del archivo quedó de cuando era una lista; no se renombra a
// «Pendientes.tsx»: al lado de pendientes.ts, en Windows el import resolvería al
// .ts — ver docs/hallazgos-offer.md.)
//
// Sin 'use client': se dibuja en el servidor.
// =============================================================================

import { EmptyState } from '@/app/_ui';
import { A_DEFINIR, DECIDIDAS, ORDEN_TIPOS, ROTULO_TIPO, type Numerada, type TipoPendiente } from './pendientes';

/** Lo que pide cada grupo, en dos palabras. */
const PIDE: Readonly<Record<TipoPendiente, string>> = {
  correccion: 'Sí o no',
  decision: 'Tu criterio',
};

const rango = (xs: readonly Numerada[]) =>
  xs.length === 1 ? `${xs[0].n}` : `${xs[0].n}–${xs[xs.length - 1].n}`;

function Tarjeta({ p }: { p: Numerada }) {
  return (
    <article id={`pendiente-${p.clave}`} className="opb-card" data-tipo={p.tipo}>
      <header className="opb-card__cab">
        <span className="opb-card__n">{p.n}</span>
        <h3 className="opb-card__t">{p.titulo}</h3>
      </header>

      <div className="opb-bloque">
        <p className="opb-et">Qué pasa hoy</p>
        <p className="opb-texto">{p.hoy}</p>
      </div>

      <div className="opb-bloque">
        <p className="opb-et">Qué tienes que decidir</p>
        <p className="opb-pregunta">{p.pregunta}</p>
        <div className="opb-ops">
          {p.opciones.map((o) => (
            <div key={o.letra} className="opb-op" data-rec={o.letra === p.recomiendo}>
              <span className="opb-op__cab"><span className="opb-op__letra">{o.letra}</span>{o.texto}</span>
              <p className="opb-op__c">{o.consecuencia}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="opb-rec">
        <span className="opb-et">Mi recomendación</span>
        <strong>{p.recomiendo}.</strong>
        <span>{p.porque}</span>
      </p>
    </article>
  );
}

/** Lo que ya contestaste: el número de siempre, tu respuesta y si ya está aplicado. */
function Decididas() {
  if (!DECIDIDAS.length) return null;
  return (
    <section id="decididas" className="opb-sec">
      <h2 className="opb-h">Decididas <span className="opb-h__n">{DECIDIDAS.length}</span></h2>
      <div className="mk-scroll-x opb-marco">
        <table className="opb-tabla">
          <thead>
            <tr><th scope="col">#</th><th scope="col">Tema</th><th scope="col">Tu respuesta</th><th scope="col">Estado</th></tr>
          </thead>
          <tbody>
            {DECIDIDAS.map((p) => {
              const d = p.decidido!;
              const op = p.opciones.find((o) => o.letra === d.letra);
              return (
                <tr key={p.clave}>
                  <td>{p.n}</td>
                  <td>{p.titulo}</td>
                  <td><strong>{d.letra}</strong> · {op?.texto ?? ''}{d.nota ? <span className="opb-tenue"> — {d.nota}</span> : null}</td>
                  <td>{d.hecho ? 'Aplicada' : 'En curso'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ListaPendientes() {
  if (!A_DEFINIR.length) return <><EmptyState titulo="Nada por definir" /><Decididas /></>;
  const grupos = ORDEN_TIPOS
    .map((tipo) => ({ tipo, items: A_DEFINIR.filter((p) => p.tipo === tipo) }))
    .filter((g) => g.items.length > 0);
  return (
    <>
      <p className="opb-como">Responde en el chat con el número y la letra: <strong>1 A</strong></p>

      <div className="opb-resumen">
        {grupos.map((g) => (
          <a key={g.tipo} href={`#${g.tipo}`} className="opb-resumen__caja" data-tipo={g.tipo}>
            <span className="opb-resumen__n">{g.items.length}</span>
            <span className="opb-resumen__t">
              <strong>{ROTULO_TIPO[g.tipo]}</strong>
              <span>{rango(g.items)} · {PIDE[g.tipo]}</span>
            </span>
          </a>
        ))}
      </div>

      {grupos.map((g) => (
        <section key={g.tipo} id={g.tipo} className="opb-sec">
          <h2 className="opb-h">{ROTULO_TIPO[g.tipo]} <span className="opb-h__n">{g.items.length}</span></h2>
          <div className="opb-cards">
            {g.items.map((p) => <Tarjeta key={p.clave} p={p} />)}
          </div>
        </section>
      ))}
      <Decididas />
    </>
  );
}
