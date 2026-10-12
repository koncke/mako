// =============================================================================
// Autores — qué concluyó MaKo de cada curso (pestaña «Autores» de Offer Playbook)
// =============================================================================
// Lee lib/offer-autores.ts. Arriba, «quién habla de qué» (mapa-autores.ts); al
// medio, una tarjeta plegable por autor; al final, las fuentes de cada curso (§10
// del marco, que antes era su propia pestaña: Martín, 11/10/2026, «elimina las sub
// tab de "precio y garantías" y "Fuentes" si para eso ya está la de autores»).
//
// Cada «lo tomó MaKo» linkea a la regla en el marco: la sección (§N.N) se resuelve
// contra el documento con `indiceDeSecciones`, que usa la misma ancla que MarkdownDoc
// le pone al título y dice qué desplegable hay que abrir. Una referencia que no
// resuelve se muestra como texto (y el test la caza).
//
// Sin 'use client': se dibuja en el servidor.
// =============================================================================

import Link from '@/app/_ui/Link';
import { Tag, Status } from '@/app/_ui';
import { AUTORES_OFERTA, TEMAS_OFERTA, type AutorOferta } from '@/lib/offer-autores';
import { Desplegable, CuerpoDeSecciones } from './Desplegable';
import { mapaDeTemas, nombreCorto, idAutor } from './mapa-autores';
import { BLOQUE_FUENTES, idBloque, claveDeReferencia, hrefDeDestino, type Destino, type Seccion } from './secciones';

type Indice = Map<string, Destino>;

/** El link que abre la tarjeta de un autor (desde la tabla de arriba). */
const hrefAutor = (a: AutorOferta) => `/admin/offer-playbook?tab=autores&ver=${encodeURIComponent(idAutor(a))}#${idAutor(a)}`;

function Referencia({ seccion, indice }: { seccion: string; indice: Indice }) {
  const clave = claveDeReferencia(seccion);
  const destino = clave ? indice.get(clave) : undefined;
  if (!destino) return <span className="opb-ref opb-ref--muerta">{seccion}</span>;
  return <Link href={hrefDeDestino(destino)} title={destino.titulo} className="opb-ref">§{clave}</Link>;
}

function MapaTemas() {
  const { principales, resto, filas } = mapaDeTemas();
  return (
    <section className="opb-sec">
      <h2 className="opb-h">Quién habla de qué</h2>
      <div className="mk-scroll-x opb-marco opb-marco--pad">
        <table className="opb-mapa">
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left' }}>Tema</th>
              {principales.map((a) => (
                <th key={a.autor} scope="col"><Link href={hrefAutor(a)}>{nombreCorto(a.autor)}</Link></th>
              ))}
              {resto.length > 0 && <th scope="col">Otros {resto.length}</th>}
              <th scope="col" className="opb-mapa__total">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.tema.id}>
                <th scope="row">{f.tema.label}</th>
                {f.porAutor.map((n, i) => <td key={i} data-n={Math.min(n, 3)}>{n || '·'}</td>)}
                {resto.length > 0 && <td data-n={Math.min(f.otros, 3)}>{f.otros || '·'}</td>}
                <td className="opb-mapa__total">{f.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FichaAutor({ a, indice, abierto }: { a: AutorOferta; indice: Indice; abierto: boolean }) {
  const verificadas = a.conclusiones.filter((c) => c.verificada).length;
  // En el orden de los temas, no en el del archivo: así se lee igual en todos.
  const filas = TEMAS_OFERTA.flatMap((t) => a.conclusiones.filter((c) => c.tema === t.id).map((c) => ({ c, tema: t.label })));
  return (
    <Desplegable
      id={idAutor(a)}
      className="opb-autor"
      abierto={abierto}
      titulo={
        <span className="opb-autor__cab">
          <span className="opb-autor__nombre">{a.autor}</span>
          <span className="opb-autor__curso">{a.curso}</span>
          <span className="opb-autor__tesis">{a.tesis}</span>
          <span className="opb-chips">
            <Tag>{a.conclusiones.length} conclusiones</Tag>
            {verificadas > 0 && <Status tono="good">{verificadas} verificadas</Status>}
          </span>
        </span>
      }
    >
      {a.cita && <blockquote className="opb-cita">«{a.cita}»</blockquote>}

      <div className="mk-scroll-x" style={{ marginTop: 14 }}>
        <table className="opb-tabla opb-concl">
          <thead>
            <tr>
              <th scope="col">Tema</th>
              <th scope="col">Qué sostiene</th>
              <th scope="col">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ c, tema }, i) => (
              <tr key={i}>
                <td><Tag>{tema}</Tag></td>
                <td>{c.texto}</td>
                <td className="opb-fuente">
                  {c.fuente}
                  {c.verificada && <span className="opb-ok" aria-label="verificada en la fuente" title="Verificada en la fuente">✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="opb-dos">
        {a.adopta.length > 0 && (
          <div>
            <h3 className="opb-h3">Lo que tomó MaKo <span className="opb-h__n">{a.adopta.length}</span></h3>
            <ul className="opb-lista">
              {a.adopta.map((x, i) => (
                <li key={i}>
                  <span>{x.que}</span>
                  <Referencia seccion={x.seccion} indice={indice} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.descarta.length > 0 && (
          <div>
            <h3 className="opb-h3">Lo que no tomó <span className="opb-h__n">{a.descarta.length}</span></h3>
            <ul className="opb-lista">
              {a.descarta.map((x, i) => (
                <li key={i} className="opb-lista__una">
                  <span><strong style={{ fontWeight: 600 }}>{x.que}.</strong> <span className="opb-tenue">{x.porque}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="opb-carpeta">{a.carpeta}</p>
    </Desplegable>
  );
}

export function Autores({ indice, fuentes, ver }: { indice: Indice; fuentes: readonly Seccion[]; ver: string | null }) {
  return (
    <>
      {AUTORES_OFERTA.length > 0 ? (
        <>
          <MapaTemas />
          <section className="opb-sec">
            <h2 className="opb-h">Autores <span className="opb-h__n">{AUTORES_OFERTA.length}</span></h2>
            <div className="opb-autores">
              {AUTORES_OFERTA.map((a) => <FichaAutor key={a.autor} a={a} indice={indice} abierto={ver === idAutor(a)} />)}
            </div>
          </section>
        </>
      ) : (
        <p className="opb-tenue" style={{ margin: 0 }}>Todavía no hay conclusiones por autor cargadas.</p>
      )}

      {fuentes.length > 0 && (
        <Desplegable
          id={idBloque(BLOQUE_FUENTES)}
          titulo="Fuentes de cada curso"
          meta={fuentes.map((s) => `§${s.numero}`).join(' · ')}
          abierto={ver === BLOQUE_FUENTES}
        >
          <CuerpoDeSecciones secciones={fuentes} conTitulos={fuentes.length > 1} />
        </Desplegable>
      )}
    </>
  );
}
