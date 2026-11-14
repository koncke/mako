// =============================================================================
// «MaKo reemplaza apps que ya estás pagando»: la tira de logos y lo que pagas hoy contra MaKo Pro (14/11/2026)
// =============================================================================
// UNA sección para dos páginas: la portada (/vsl/sitio, sobre su fondo oscuro) y Comparaciones (al principio, `claro`). Martín,
// 14/11/2026: «esa misma sección va también en la pestaña de Comparaciones, al principio».
//
// La cuenta. Antes era una lista en dos columnas (logo, nombre, precio, logo, nombre, precio…) y Martín: «está todo muy junto y no se
// llega a entender muy bien de quién es el precio, si el de 97 es de HighLevel o es el de ManyChat». Ahora es una sola columna, como
// un ticket: una fila por app con su logo, su nombre y su precio en el MISMO renglón, unidos por puntos guía; las filas agrupadas por
// para qué sirven (GRUPOS_DEL_AHORRO) y, al final, el total. Más tarde ese día, al verlo: «todo junto» (sin los títulos de los
// grupos), el titular «Lo que probablemente ya pagas en tu negocio», el ahorro con MaKo Pro AL COSTADO del ticket y la tira debajo. Los precios y sus fuentes, en ./reemplaza.ts
// (STACK_TIPICO); la cuenta se hace acá.
//
// Los colores, con el sol y la luna (app/vsl/_competencia/TemaSitio.tsx): la tarjeta es blanca y el script la lleva al modo. Por eso
// las líneas y los puntos guía se pintan con `currentColor` (en un pseudo-elemento o una sombra): el script cambia el `color` del
// texto y no toca ni los pseudo-elementos ni las sombras, así que siguen al texto en los dos modos. Un BORDE no: en el claro, el
// script aclara todo borde oscuro y la línea desaparecía sobre el blanco. El ícono de MaKo va con `data-tema-fijo` y su color sale
// de `.s-mk-ico` (negro sobre claro, blanco sobre oscuro: CSS_BASE). La franja azul del ahorro, también fija.
// Server component, sin JavaScript.
// =============================================================================

import { EstrellaMaKo } from '../_competencia/marca';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';
import { Flecha } from './Piezas';
import { GRUPOS_DEL_AHORRO, STACK_TIPICO, appsDeLaTira } from './reemplaza';

const usd = (n: number) => `US$${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que paga hoy un negocio típico, app por app (el ticket), y al costado lo que ahorra con MaKo Pro (un bloque aparte, azul).
 * Martín, 14/11/2026, al verlo en el visor: «todo junto», sin los títulos de los grupos (el orden sigue siendo el de
 * GRUPOS_DEL_AHORRO: las de un mismo trabajo, juntas), y el ahorro AL COSTADO del ticket, que se note (debajo en el teléfono).
 */
function LoQuePagas() {
  const pro = PLANES_MAKO_DEFAULT.find((p) => p.id === 'pro');
  if (!pro) return null;
  const filas = GRUPOS_DEL_AHORRO.flatMap((g) => STACK_TIPICO.filter((x) => x.grupo === g));
  const hoy = centavos(filas.reduce((s, x) => s + x.precioUsd, 0));
  const mes = centavos(hoy - pro.precioUsd);
  if (mes <= 0) return null;
  // «Más de US$300»: el ahorro redondeado hacia abajo a la centena, para que la frase nunca prometa de más.
  const redondo = Math.floor(mes / 100) * 100;
  return (
    <div className="s-ah-afuera">
      <div className="s-ah-dos">
        <div className="s-ah">
          <ul aria-label="Lo que pagas por mes, app por app">
            {filas.map((x) => (
              <li key={x.app.nombre} className="s-ah-f" title={`${x.app.nombre} ${x.plan} (${x.trabajo}): ${usd(x.precioUsd)} por mes`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.app.logo} alt="" width={32} height={32} loading="lazy" />
                <span className="s-ah-n">{x.app.nombre}</span>
                <span className="s-ah-guia" aria-hidden="true" />
                <span className="s-ah-p">{usd(x.precioUsd)}</span>
              </li>
            ))}
          </ul>
          <p className="s-ah-f s-ah-tot">
            <span className="s-ah-n">Total por mes</span>
            <span className="s-ah-guia" aria-hidden="true" />
            <span className="s-ah-p">{usd(hoy)}</span>
          </p>
        </div>
        <div className="s-ah-gana" data-tema-fijo="">
          <p className="s-ah-gana-t">Con MaKo te ahorras más de {usd(redondo)} por mes</p>
          <p className="s-ah-gana-mk">
            <span className="s-mk-ico s-ah-ico" aria-hidden="true"><EstrellaMaKo size={19} /></span>
            <span style={{ whiteSpace: 'nowrap' }}>Todo en <strong>MaKo Pro: {usd(pro.precioUsd)}</strong> por mes</span>
          </p>
          <p className="s-ah-gana-n"><strong>{usd(mes)}</strong> por mes</p>
        </div>
      </div>
    </div>
  );
}

/**
 * La sección entera, en este orden (Martín, 14/11/2026): el titular, el ticket con el ahorro al costado, la tira de logos que se
 * desliza (sólo las apps más conocidas, ./reemplaza.ts → appsDeLaTira) y, si se pasa `ver`, el link a la comparación (en
 * Comparaciones no va: la comparación está justo abajo).
 */
export function SeccionReemplaza({ claro = false, principal = false, ver }: { claro?: boolean; principal?: boolean; ver?: string }) {
  // `principal`: la sección abre la página (Comparaciones) y su titular es el h1.
  const titular = 'Lo que probablemente ya pagas en tu negocio';
  const apps = appsDeLaTira();
  const lista = (oculta: boolean) => (
    <ul className="s-tira-l" aria-hidden={oculta || undefined}>
      {apps.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <li key={a.logo} className="s-tira-i s-tira-app"><img src={a.logo} alt="" width={30} height={30} />{a.nombre}</li>
      ))}
    </ul>
  );
  return (
    <section className={`s-tira s-tira-reemplaza${claro ? ' s-reemplaza-claro' : ''}`} aria-labelledby="lo-que-pagas">
      {principal ? <h1 className="s-ah-h" id="lo-que-pagas">{titular}</h1> : <h2 className="s-ah-h" id="lo-que-pagas">{titular}</h2>}
      <LoQuePagas />
      <p className="s-tira-r">MaKo reemplaza las apps que ya estás pagando</p>
      <div className="s-tira-v">
        <div className="s-tira-p">{lista(false)}{lista(true)}</div>
      </div>
      {ver ? <p className="s-tira-ver"><a href={ver}>Ver la comparación, trabajo por trabajo <Flecha size={18} /></a></p> : null}
    </section>
  );
}
