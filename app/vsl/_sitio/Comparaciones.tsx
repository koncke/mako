// =============================================================================
// Comparaciones (/vsl/comparaciones, vista previa): copiada de https://www.beehiiv.com/comparisons (12/11/2026)
// =============================================================================
// Martín (12/11/2026): «Me gusta la de beehiiv y sobre todo la parte de comparaciones, MaKo reemplaza muchísimas apps grandes
// de la competencia, podemos hacer lo mismo». Su orden, que se respeta: la barra clara → hero con la marca en su marco, sobre la
// lavanda con trama de puntos («beehiiv comparisons») → «Compare pricing and features» (su tabla en la caja de filete negro) →
// «beehiiv vs the others» (la grilla de tarjetas) → el pie claro.
//
// Lo que cambió, y por qué:
//   · Su tabla compara beehiiv contra cuatro competidores, columna por columna, con precios. La de MaKo compara MaKo contra el
//     stack de apps que reemplaza: una fila por trabajo, la columna de MaKo (el tilde y el nombre de la función) y la de la app
//     que se usa hoy para ese trabajo. Las filas salen de los `reemplaza` de lib/funciones-mako.ts. NINGÚN precio de otra app y
//     ninguna afirmación sobre lo que otra app hace o no hace: sólo su nombre.
//   · Los encabezados de grupo («Pricing», «Website Features»…) son las familias de la barra de la app.
//   · Su cabecera tiene flechas para pasar columnas en el teléfono; con tres columnas no hacen falta.
//   · Sus tarjetas «beehiiv vs …» llevan a su página de comparación; las de MaKo, a la landing de esa función (las páginas «vs»
//     propias no se hacen todavía: llevarían afirmaciones sobre otras apps que hay que verificar una por una). Classroom no tiene
//     landing: su tarjeta lleva a su fila de la tabla, que se marca. Sin la franja de logo de arriba de cada tarjeta (sus logos).
//   · El titular dice cuántas apps reemplaza, contadas de esa lista.
// Server component, sin JavaScript.
// =============================================================================

import { Fragment } from 'react';
import { CALENDLY, EstrellaMaKo, TEXTO_CTA } from '../_competencia/marca';
import { Barra } from './Barra';
import { Pie } from './Pie';
import { Boton, Flecha, Tilde } from './Piezas';
import { CSS_BARRA, CSS_BASE, CSS_COMPARACIONES, CSS_PIE } from './estilos';
import { filasDeComparacion, gruposDeComparacion, listaDeTrabajos } from './datos';

export function ComparacionesSitio() {
  const filas = filasDeComparacion();
  const grupos = gruposDeComparacion();
  const n = filas.length;
  return (
    <div className="s-sitio s-claro">
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_BARRA + CSS_PIE + CSS_COMPARACIONES }} />
      <Barra claro />
      <main>
        <section className="s-ch">
          <div className="s-ch-logo" aria-hidden="true">
            <div className="s-ch-logo-in"><div className="s-ch-logo-c"><EstrellaMaKo size={56} /></div></div>
          </div>
          <h1 className="s-ch-h1">MaKo reemplaza {n} apps.</h1>
          <p className="s-ch-p">{listaDeTrabajos(filas)}, en una sola app.</p>
          <Boton flecha />
        </section>

        <section className="s-cc">
          <div className="s-cont">
            <h2 className="s-cc-h2">Compara función por función.</h2>
            <p className="s-cc-p">Cada trabajo, la app que se usa hoy para hacerlo y la función de MaKo que lo hace.</p>
            <div className="s-tabla-caja" id="comparar">
              <table className="s-tabla">
                <colgroup><col className="s-col1" /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th scope="col"><span className="s-sr">Trabajo</span></th>
                    <th scope="col">
                      <span className="s-th-n">MaKo</span>
                      <a className="s-th-btn" href={CALENDLY}>{TEXTO_CTA}</a>
                    </th>
                    <th scope="col">
                      <span className="s-th-n">Lo usas hoy en</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <Fragment key={g.familia}>
                      <tr className="s-tg"><td colSpan={3}>{g.familia}</td></tr>
                      {g.filas.map((f, i) => (
                        <tr key={f.key} id={f.ancla} className={`s-tf${i === g.filas.length - 1 ? ' s-tf-ult' : ''}`}>
                          <td>{f.trabajo}</td>
                          <td><span className="s-tilde"><span className="s-tilde-c"><Tilde /></span>{f.funcion}</span></td>
                          <td>{f.app}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="s-cv">
          <div className="s-cont">
            <h2 className="s-cv-h2">MaKo vs las demás.</h2>
            <div className="s-cv-grilla">
              {filas.map((f) => (
                <a key={f.key} className="s-vs" href={f.href}>
                  <span className="s-vs-cara">
                    <span className="s-vs-t">MaKo vs {f.app}</span>
                    {/* beehiiv lleva a su página «vs»; MaKo todavía no tiene una (afirmaría cosas de la otra app): lleva a la landing de la función. */}
                    <span className="s-vs-a">{f.href.startsWith('#') ? 'Ver en la tabla' : `Ver ${f.funcion}`} <Flecha size={20} /></span>
                  </span>
                  <span className="s-vs-c2" aria-hidden="true" />
                  <span className="s-vs-c1" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Pie />
    </div>
  );
}
