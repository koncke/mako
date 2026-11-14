// =============================================================================
// Comparaciones (/vsl/comparaciones y /vsl/comparaciones/<app>): copiada de https://www.beehiiv.com/comparisons
// =============================================================================
// 12/11/2026, Martín: «Me gusta la de beehiiv y sobre todo la parte de comparaciones, MaKo reemplaza muchísimas apps grandes de la
// competencia, podemos hacer lo mismo».
// 14/11/2026, Martín: «no es como la referencia»: scrolleable, una tabla de lo que la competencia tiene o no tiene, comentarios y las
// tarjetas «MaKo vs X» abajo. Ahora es su molde (notas: referencias-comparar/beehiiv-comparisons.md):
//   · el índice: hero → la tabla (MaKo fijo a la izquierda y las apps en columnas que se deslizan, con las flechas de beehiiv) →
//     «MaKo vs las demás» (una tarjeta por app, con su comentario de una línea) → pie;
//   · la página de cada app: hero «MaKo vs X» → «Elige X si / Elige MaKo si» → el comentario → la tabla de dos columnas → las
//     tarjetas de las demás.
// En la tabla: ✓ en su círculo si la tiene, la celda VACÍA si no (como beehiiv), un valor corto si hay un matiz y «sin dato» si la
// investigación no lo pudo confirmar. Los datos y sus fuentes: ./competencia.ts y ./competencia-datos.ts.
// Server components. Las flechas son un script chico (`data-visor`, para que anden también en el visor de las landings).
// =============================================================================

import { Fragment } from 'react';
import { RUTA_CTA, EstrellaMaKo, TEXTO_CTA } from '../_competencia/marca';
import { Barra } from './Barra';
import { Pie } from './Pie';
import { Boton, Flecha, Tilde } from './Piezas';
import { CSS_BARRA, CSS_BASE, CSS_COMPARACIONES, CSS_PIE } from './estilos';
import { COMPETIDORES, ELIGE_MAKO_SI, GRUPOS_MATRIZ, RELEVADO_EL, celdaDeMaKo, rutaVs, type Celda, type Competidor } from './competencia';

const fechaCorta = (iso: string) => { const [a, m, d] = iso.split('-'); return a && m && d ? `${Number(d)}/${Number(m)}/${a}` : iso; };

/** El ancho de una columna de app (lo usan las flechas: pasan de a tres). */
const ANCHO_COL = 152;
const SCRIPT_FLECHAS = `(function(){document.querySelectorAll('[data-mx]').forEach(function(c){var b=c.querySelector('.s-mx-caja');if(!b)return;var p=c.querySelector('[data-mx-ir="-1"]'),n=c.querySelector('[data-mx-ir="1"]');function ver(){if(p)p.disabled=b.scrollLeft<4;if(n)n.disabled=b.scrollLeft+b.clientWidth>=b.scrollWidth-4;}c.querySelectorAll('[data-mx-ir]').forEach(function(x){x.addEventListener('click',function(){b.scrollBy({left:Number(x.getAttribute('data-mx-ir'))*${ANCHO_COL * 3},behavior:'smooth'});});});b.addEventListener('scroll',ver,{passive:true});ver();});})();`;

function ValorCelda({ c, fila, app }: { c: Celda | undefined; fila: string; app: string }) {
  const v = c?.v ?? '?';
  if (v === 'si') return <span className="s-mx-si"><Tilde /><span className="s-sr">{`${fila}, ${app}: sí`}</span></span>;
  if (v === 'no') return <span className="s-sr">{`${fila}, ${app}: no`}</span>;
  if (v === '?') return <span className="s-mx-nd" title="No lo pudimos confirmar en su web">sin dato</span>;
  return <span className="s-mx-v">{v}</span>;
}

function LogoApp({ c, size = 36 }: { c: Pick<Competidor, 'logo'>; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="s-mx-logo" src={c.logo} alt="" width={size} height={size} loading="lazy" />;
}

/** La tabla: MaKo fijo y una columna por app. Con una sola app (la página «MaKo vs X») no lleva flechas. */
export function TablaCompetencia({ competidores }: { competidores: readonly Competidor[] }) {
  const varias = competidores.length > 1;
  const cols = 2 + competidores.length;
  return (
    <div className="s-mx" data-mx="" data-una={varias ? undefined : ''}>
      <div className="s-mx-caja" tabIndex={0} aria-label="Tabla de comparación: se desliza hacia los costados">
        <table className="s-mx-t">
          <thead>
            <tr>
              <th scope="col" className="s-mx-c0">
                <span className="s-sr">Función</span>
                {varias ? (
                  <span className="s-mx-flechas">
                    <button type="button" data-mx-ir="-1" aria-label="Ver las apps anteriores" disabled>‹</button>
                    <button type="button" data-mx-ir="1" aria-label="Ver las apps siguientes">›</button>
                  </span>
                ) : null}
              </th>
              <th scope="col" className="s-mx-mk">
                <span className="s-mx-cab"><span className="s-mx-estrella"><EstrellaMaKo size={24} /></span><b>MaKo</b></span>
                <a className="s-mx-btn" href={RUTA_CTA}>{TEXTO_CTA}</a>
              </th>
              {competidores.map((c) => (
                <th key={c.slug} scope="col" className="s-mx-app">
                  <span className="s-mx-cab"><LogoApp c={c} /><b>{c.nombre}</b></span>
                  {varias ? <a className="s-mx-btn s-mx-btn2" href={rutaVs(c)}>Comparar</a> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS_MATRIZ.map((g) => (
              <Fragment key={g.titulo}>
                <tr className="s-mx-g"><th scope="colgroup" colSpan={cols}><span>{g.titulo}</span></th></tr>
                {g.filas.map((f) => (
                  <tr key={f.clave} className="s-mx-f">
                    <th scope="row" className="s-mx-c0">{f.nombre}</th>
                    <td className="s-mx-mk"><ValorCelda c={celdaDeMaKo(f.clave)} fila={f.nombre} app="MaKo" /></td>
                    {competidores.map((c) => <td key={c.slug}><ValorCelda c={c.celdas[f.clave]} fila={f.nombre} app={c.nombre} /></td>)}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {varias ? <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT_FLECHAS }} /> : null}
    </div>
  );
}

/** «MaKo vs las demás»: una tarjeta por app, con su comentario de una línea, que lleva a su página. */
export function TarjetasVs({ excepto }: { excepto?: string }) {
  return (
    <section className="s-cv">
      <div className="s-cont">
        <h2 className="s-cv-h2">MaKo vs las demás.</h2>
        <div className="s-cv-grilla">
          {COMPETIDORES.filter((c) => c.slug !== excepto).map((c) => (
            <a key={c.slug} className="s-vs" href={rutaVs(c)}>
              <span className="s-vs-cara">
                <span className="s-vs-logos" aria-hidden="true">
                  <span className="s-mx-estrella s-vs-mk"><EstrellaMaKo size={26} /></span>
                  <span className="s-vs-x">vs</span>
                  <LogoApp c={c} size={44} />
                </span>
                <span className="s-vs-t">MaKo vs {c.nombre}</span>
                <span className="s-vs-com">{c.comentario}</span>
                <span className="s-vs-a">Comparar <Flecha size={20} /></span>
              </span>
              <span className="s-vs-c2" aria-hidden="true" />
              <span className="s-vs-c1" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

const CSS = CSS_BASE + CSS_BARRA + CSS_PIE + CSS_COMPARACIONES;

export function ComparacionesSitio() {
  return (
    <div className="s-sitio s-claro">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra claro />
      <main>
        <section className="s-ch">
          <div className="s-ch-logo" aria-hidden="true">
            <div className="s-ch-logo-in"><div className="s-ch-logo-c"><EstrellaMaKo size={56} /></div></div>
          </div>
          <h1 className="s-ch-h1">MaKo contra las apps que ya pagas.</h1>
          <p className="s-ch-p">Qué tiene cada una y qué no, función por función.</p>
          <Boton flecha />
        </section>

        <section className="s-cc" id="comparar">
          <div className="s-cont">
            <h2 className="s-cc-h2">Compara precios y funciones.</h2>
            <p className="s-cc-p">Desliza para ver todas las apps.</p>
            <TablaCompetencia competidores={COMPETIDORES} />
            {/* Lo que se dice de otra app es público: de dónde sale y qué quiere decir «sin dato» (./competencia-datos.ts, con sus fuentes). */}
            <p className="s-mx-nota">Lo de cada app sale de su web oficial (relevado el {fechaCorta(RELEVADO_EL)}). «Sin dato»: no lo pudimos confirmar.</p>
          </div>
        </section>

        <TarjetasVs />
      </main>
      <Pie />
    </div>
  );
}

/** La página de una app: «MaKo vs X». */
export function ComparacionVs({ c }: { c: Competidor }) {
  return (
    <div className="s-sitio s-claro">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra claro />
      <main>
        <section className="s-ch">
          <div className="s-ch-vs" aria-hidden="true">
            <span className="s-ch-logo-c s-ch-vs-mk"><EstrellaMaKo size={44} /></span>
            <span className="s-ch-vs-x">vs</span>
            <span className="s-ch-vs-app"><LogoApp c={c} size={72} /></span>
          </div>
          <h1 className="s-ch-h1">MaKo vs {c.nombre}</h1>
          <p className="s-ch-p">La alternativa a {c.nombre} para vender servicios High Ticket, en español.</p>
          <Boton flecha />
        </section>

        <section className="s-el">
          <div className="s-cont s-el-dos">
            <div className="s-el-col">
              <h2 className="s-el-h">Elige {c.nombre} si</h2>
              <ul>{c.eligeSi.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="s-el-col s-el-mk">
              <h2 className="s-el-h">Elige MaKo si</h2>
              <ul>{ELIGE_MAKO_SI.map((x) => <li key={x}><span className="s-mx-si"><Tilde /></span>{x}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className="s-cc">
          <div className="s-cont">
            <h2 className="s-cc-h2">MaKo y {c.nombre}, función por función.</h2>
            <p className="s-cc-p s-vs-dice">{c.comentario}</p>
            <TablaCompetencia competidores={[c]} />
            <p className="s-mx-otras"><a href="/vsl/comparaciones#comparar">Mira cómo se compara MaKo con las demás <Flecha size={18} /></a></p>
          </div>
        </section>

        <TarjetasVs excepto={c.slug} />
      </main>
      <Pie />
    </div>
  );
}
