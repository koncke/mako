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
//
// 14/11/2026, Martín mirando el visor:
//   · al principio, la MISMA sección de la portada: la tira de las apps que MaKo reemplaza y lo que pagas hoy contra MaKo Pro
//     (./LoQuePagas.tsx);
//   · las flechas DESLIZAN las columnas («si no, no se entiende»): SCRIPT_FLECHAS, con un transform de 300 ms;
//   · sin la nota de abajo de la tabla («Lo de cada app sale de su web oficial…»: no hace falta). Las fuentes siguen en
//     ./competencia-datos.ts;
//   · cada tarjeta «MaKo vs X» abre en el lugar un panel con la comparación (TarjetasVs). Las páginas /vsl/comparaciones/<app> quedan;
//   · el ícono de MaKo, negro sobre claro y blanco sobre oscuro (`.s-mk-ico` con `data-tema-fijo`, en CSS_BASE).
// =============================================================================

import { Fragment } from 'react';
import { RUTA_CTA, EstrellaMaKo, TEXTO_CTA } from '../_competencia/marca';
import { Barra } from './Barra';
import { SeccionReemplaza } from './LoQuePagas';
import { Pie } from './Pie';
import { Boton, Flecha, Tilde } from './Piezas';
import { CSS_BARRA, CSS_BASE, CSS_COMPARACIONES, CSS_PIE, CSS_REEMPLAZA } from './estilos';
import { COMPETIDORES, ELIGE_MAKO_SI, GRUPOS_MATRIZ, celdaDeMaKo, type Celda, type Competidor } from './competencia';

/** El panel «MaKo vs X» de cada tarjeta y su casilla (TarjetasVs). */
const idPanel = (c: Pick<Competidor, 'slug'>) => `vs-${c.slug}`;
const idCasilla = (c: Pick<Competidor, 'slug'>) => `ck-vs-${c.slug}`;

/**
 * Las flechas (14/11/2026, noche, Martín: «nunca se tiene que quedar algo cortado por la mitad… tampoco tiene que existir el scroll de
 * izquierda a derecha… con las flechitas… tampoco quiero que se vea la barra de scroll… esa sección la haría como más larga»): la tabla
 * va ENTERA a lo alto de la página (sin caja con scroll), con la cabecera fija al bajar. El script mide cuántas apps entran enteras al
 * lado de las dos columnas fijas y les da ese ancho (`--mx-col`).
 * Y las flechas DESLIZAN (Martín, 14/11/2026, más tarde: «tiene que verse una animación de desplazamiento… si no, no se entiende»):
 * todas las columnas están puestas, y una flecha corre las celdas de las apps (`--mx-x`, un transform de 300 ms en estilos.ts) una
 * página entera; la caja las recorta (clip: sin barra ni scroll de costado). Las de afuera quedan `inert` y `aria-hidden`: no se
 * llega a ellas con el tabulador. Con «menos movimiento», el CSS saca la transición. Sin JavaScript se ven las primeras cuatro.
 */
const MIN_COL = 150;
const SCRIPT_FLECHAS = `(function(){document.querySelectorAll('[data-mx]').forEach(function(c){var b=c.querySelector('.s-mx-caja');if(!b||c.hasAttribute('data-una'))return;var f0=b.querySelector('thead th.s-mx-c0'),fm=b.querySelector('thead th.s-mx-mk');var celdas=b.querySelectorAll('[data-c]'),n=b.querySelectorAll('thead th[data-c]').length,p=c.querySelector('[data-mx-ir="-1"]'),s=c.querySelector('[data-mx-ir="1"]'),i=0,k=1,w=0;function ver(){c.style.setProperty('--mx-x',(-i*w)+'px');celdas.forEach(function(x){var j=Number(x.getAttribute('data-c'));if(j>=i&&j<i+k){x.removeAttribute('inert');x.removeAttribute('aria-hidden');}else{x.setAttribute('inert','');x.setAttribute('aria-hidden','true');}});if(p)p.disabled=i<=0;if(s)s.disabled=i>=n-k;}function medir(){c.setAttribute('data-quieto','');c.setAttribute('data-listo','');var libre=b.clientWidth-f0.offsetWidth-fm.offsetWidth;k=Math.max(1,Math.min(n,Math.floor(libre/${MIN_COL})));w=Math.floor(libre/k);c.style.setProperty('--mx-col',w+'px');i=Math.min(i,Math.max(0,n-k));ver();requestAnimationFrame(function(){requestAnimationFrame(function(){c.removeAttribute('data-quieto');});});}c.querySelectorAll('[data-mx-ir]').forEach(function(x){x.addEventListener('click',function(){var d=Number(x.getAttribute('data-mx-ir'));i=Math.max(0,Math.min(n-k,i+d*k));ver();});});addEventListener('resize',medir);medir();});})();`;

/**
 * El «Comparar» de la cabecera de la tabla abre el panel de esa app (en las tarjetas, más abajo): marca su casilla y baja hasta la
 * tarjeta. Sin JavaScript abre igual, con :target (estilos.ts). Al abrir la página con #vs-<app>, también.
 */
const SCRIPT_VS = `(function(){if(window.__mkVs)return;window.__mkVs=1;function abrir(id,ir){var ck=document.getElementById('ck-'+id);if(!ck)return false;ck.checked=true;if(ir){var t=ck.closest('.s-vs')||ck;t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}return true;}document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-vs-abre]');if(a&&abrir(a.getAttribute('data-vs-abre'),true))e.preventDefault();});if(/^#vs-/.test(location.hash)&&abrir(location.hash.slice(1),false)){try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}}})();`;

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
      <div className="s-mx-caja">
        <table className="s-mx-t">
          <thead>
            <tr>
              <th scope="col" className="s-mx-c0">
                <span className="s-sr">Función</span>
                {varias ? (
                  <span className="s-mx-flechas">
                    <button type="button" data-mx-ir="-1" aria-label="Ver las apps anteriores" disabled>‹</button>
                    <button type="button" data-mx-ir="1" aria-label="Ver las apps siguientes" disabled>›</button>
                  </span>
                ) : null}
              </th>
              <th scope="col" className="s-mx-mk">
                <span className="s-mx-cab"><span className="s-mx-estrella s-mk-ico" data-tema-fijo=""><EstrellaMaKo size={24} /></span><b>MaKo</b></span>
                <a className="s-mx-btn" href={RUTA_CTA}>{TEXTO_CTA}</a>
              </th>
              {competidores.map((c, i) => (
                <th key={c.slug} scope="col" className="s-mx-app" data-c={i}>
                  <span className="s-mx-cab"><LogoApp c={c} /><b>{c.nombre}</b></span>
                  {varias ? <a className="s-mx-btn s-mx-btn2" href={`#${idPanel(c)}`} data-vs-abre={idPanel(c)}>Comparar</a> : null}
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
                    {competidores.map((c, i) => <td key={c.slug} data-c={i}><ValorCelda c={c.celdas[f.clave]} fila={f.nombre} app={c.nombre} /></td>)}
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

/** Los dos logos: MaKo (negro sobre claro, blanco sobre oscuro) contra la app. */
function LogosVs({ c, size = 44 }: { c: Competidor; size?: number }) {
  return (
    <span className="s-vs-logos" aria-hidden="true">
      <span className="s-mx-estrella s-vs-mk s-mk-ico" data-tema-fijo=""><EstrellaMaKo size={Math.round(size * 0.6)} /></span>
      <span className="s-vs-x">vs</span>
      <LogoApp c={c} size={size} />
    </span>
  );
}

/** El panel que abre cada tarjeta: el comentario, «Elige X si / Elige MaKo si» y la tabla de las dos (sus filas de la matriz). */
function PanelVs({ c }: { c: Competidor }) {
  const cerrar = (
    <label htmlFor={idCasilla(c)} className="s-vs-cerrar">Cerrar <span aria-hidden="true">×</span></label>
  );
  return (
    // aria-labelledby y NO aria-label: el sol y la luna toma todo [aria-label^="MaKo"] por el logo de MaKo y pinta su primer <span>
    // como el cuadro del logo (con «MaKo vs X» salía una franja negra sobre los dos logos).
    <div className="s-vs-panel" id={idPanel(c)} role="region" aria-labelledby={`${idPanel(c)}-t`}>
      <div className="s-vs-pcab">
        <LogosVs c={c} size={40} />
        <h3 className="s-vs-pt" id={`${idPanel(c)}-t`}>MaKo vs {c.nombre}</h3>
        {cerrar}
      </div>
      <p className="s-vs-pdice">{c.comentario}</p>
      <div className="s-el-dos">
        <div className="s-el-col">
          <h4 className="s-el-h">Elige {c.nombre} si</h4>
          <ul>{c.eligeSi.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="s-el-col s-el-mk">
          <h4 className="s-el-h">Elige MaKo si</h4>
          <ul>{ELIGE_MAKO_SI.map((x) => <li key={x}><span className="s-mx-si"><Tilde /></span>{x}</li>)}</ul>
        </div>
      </div>
      <TablaCompetencia competidores={[c]} />
      <div className="s-vs-pie">{cerrar}</div>
    </div>
  );
}

/**
 * «MaKo vs las demás»: una tarjeta por app, con su comentario de una línea. Al tocarla se abre ahí mismo su panel (Martín, 14/11/2026:
 * «al tocarlas llevan a la landing principal, y no tiene que pasar»): la tarjeta es un label con su casilla, y el panel el hermano que
 * sigue (sin JavaScript, y anda en el visor). Cómo cae el panel en la grilla, en estilos.ts (CSS_COMPARACIONES, «LA TARJETA ABRE»).
 */
export function TarjetasVs({ excepto }: { excepto?: string }) {
  return (
    <section className="s-cv">
      <div className="s-cont">
        <h2 className="s-cv-h2">MaKo vs las demás.</h2>
        <div className="s-cv-grilla">
          {COMPETIDORES.filter((c) => c.slug !== excepto).map((c) => (
            <Fragment key={c.slug}>
              <label className="s-vs">
                <input type="checkbox" id={idCasilla(c)} className="s-vs-ck s-sr" aria-controls={idPanel(c)} aria-label={`Ver MaKo vs ${c.nombre}`} />
                <span className="s-vs-cara">
                  <LogosVs c={c} />
                  <span className="s-vs-t">MaKo vs {c.nombre}</span>
                  <span className="s-vs-com">{c.comentario}</span>
                  <span className="s-vs-a"><span className="s-vs-a-ver">Comparar</span><span className="s-vs-a-cerrar">Cerrar</span> <Flecha size={20} /></span>
                </span>
              </label>
              <PanelVs c={c} />
            </Fragment>
          ))}
        </div>
      </div>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT_VS }} />
    </section>
  );
}

const CSS = CSS_BASE + CSS_BARRA + CSS_PIE + CSS_REEMPLAZA + CSS_COMPARACIONES;

export function ComparacionesSitio() {
  return (
    <div className="s-sitio s-claro">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Barra claro />
      <main>
        <section className="s-ch">
          <div className="s-ch-logo" aria-hidden="true">
            <div className="s-ch-logo-in"><div className="s-ch-logo-c s-mk-ico" data-tema-fijo=""><EstrellaMaKo size={56} /></div></div>
          </div>
          <h1 className="s-ch-h1">MaKo contra las apps que ya pagas.</h1>
          <p className="s-ch-p">Qué tiene cada una y qué no, función por función.</p>
          <Boton flecha />
        </section>

        {/* Lo mismo que en la portada, al principio (Martín, 14/11/2026). */}
        <SeccionReemplaza claro />

        <section className="s-cc" id="comparar">
          <div className="s-cont">
            <h2 className="s-cc-h2">Compara precios y funciones.</h2>
            <p className="s-cc-p">Con las flechas pasas de una app a otra.</p>
            <TablaCompetencia competidores={COMPETIDORES} />
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
            <span className="s-ch-logo-c s-ch-vs-mk s-mk-ico" data-tema-fijo=""><EstrellaMaKo size={44} /></span>
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
