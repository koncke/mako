// =============================================================================
// La barra del sitio de MaKo, con sus menús: copiada de la de https://www.beehiiv.com/ (12/11/2026)
// =============================================================================
// Su estructura: el logo, los links (dos abren un menú a todo el ancho: «Product» y «Solutions»), y a la derecha «Log in» más
// dos botones. En MaKo: «Producto» (las 19 landings: cuatro grandes con ícono y bajada, y el resto en columnas por familia, como
// sus columnas Publish / Grow / Earn / Analyze / Connect), «Industrias» (su «Solutions»: la columna «For publishers» son los
// avatares de MaKo y «Featured stories» el caso de Mauricio; su columna de anunciantes y socios no va), «Comparaciones» y
// «Precios» (/planes). A la derecha «Iniciar sesión», el botón para empezar y, al final, el sol y la luna (Martín,
// 12/11/2026: «no tiene sentido arriba entrar, ver planes, agenda tu llamada… debería ser registrarse, loguearse», y después:
// «el Dark Mode y White Mode deberían estar a la derecha del todo. En la top bar elimina también ver planes… ya tenemos precios»).
//
// Lo que cambió, y por qué:
//   · Sus menús abren con JavaScript; estos con CSS (:hover y :focus-within). El que abre es un <span tabIndex={0}>, no un
//     <button> (un botón sin onClick es un botón muerto: tests/ningun-boton-muerto.test.ts).
//   · En el teléfono su lista a pantalla completa entra a un submenú con «Back»; aquí cada menú se despliega en su renglón con
//     <details>, sin JavaScript. Abajo quedan los mismos tres botones.
//   · Sus íconos son rosas; los de MaKo, dorados. El logo es el de MaKo (LogoMaKo).
// Los valores, en ./estilos.ts y docs/diseno/sitio-beehiiv.md. Server component.
// =============================================================================

import { LogoMaKo, TEXTO_CTA, RUTA_CTA } from '../_competencia/marca';
import { TemaSitio } from '../_competencia/TemaSitio';
import { HISTORIA, INDUSTRIAS, RUTA_COMPARACIONES, RUTA_ENTRAR, RUTA_PRECIOS, menuProducto, type MenuProducto } from './datos';
import { Chevron, Icono } from './Piezas';
import { CSS_BARRA, CSS_BASE } from './estilos';
import { FUNNELS_SITIO, rutaFunnel } from './funnels-datos';

/** Los funnels, dentro de Industrias (Martín, 14/11/2026: «dentro del desplegable de industria, una sección funnels… y que sea una
 *  landing cada uno»). */
function ItemsFunnels() {
  return <>{FUNNELS_SITIO.map((f) => <Grande key={f.id} href={rutaFunnel(f.id)} icono={f.icono} nombre={f.nombre} bajada={f.corta} />)}</>;
}

/** Uno de los cuatro grandes (o una industria): el cuadro con el ícono, el nombre y su bajada. */
function Grande({ href, icono, nombre, bajada }: { href: string; icono: readonly string[]; nombre: string; bajada: string }) {
  return (
    <a className="s-mg" href={href}>
      <span className="s-mg-ico"><Icono d={icono} /></span>
      <span className="s-mg-tx">
        <span className="s-mg-t">{nombre}</span>
        <span className="s-mg-d">{bajada}</span>
      </span>
    </a>
  );
}

function Historia() {
  return (
    <a className="s-hist" href={HISTORIA.href}>
      {/* eslint-disable-next-line @next/next/no-img-element -- una miniatura de 66 px servida de /public */}
      <img className="s-hist-img" src={HISTORIA.foto} alt="" width={66} height={44} />
      <span className="s-hist-tx">
        <span className="s-hist-t">{HISTORIA.quien}</span>
        <span className="s-hist-d">{HISTORIA.texto}</span>
      </span>
    </a>
  );
}

function MenuProductoPc({ m }: { m: MenuProducto }) {
  return (
    <div className="s-mega">
      <div className="s-mega-in">
        {m.grandes.length ? (
          <div className="s-mega-grandes">
            {m.grandes.map((g) => <Grande key={g.slug} href={g.href} icono={g.icono} nombre={g.nombre} bajada={g.bajada} />)}
          </div>
        ) : null}
        <div className="s-mega-cols">
          {m.columnas.map((c) => (
            <div key={c.rotulo}>
              <p className="s-mega-r">{c.rotulo}</p>
              <ul>{c.items.map((i) => <li key={i.slug}><a className="s-mega-l" href={i.href}>{i.nombre}</a></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuIndustriasPc() {
  return (
    <div className="s-mega">
      <div className="s-mega-in s-mega-ind">
        <div>
          <p className="s-mega-r">Por industria</p>
          {INDUSTRIAS.map((i) => <Grande key={i.avatar} href={i.href} icono={i.icono} nombre={i.nombre} bajada={i.bajada} />)}
        </div>
        <div>
          <p className="s-mega-r">Funnels</p>
          <ItemsFunnels />
        </div>
        <div className="s-mega-hist">
          <p className="s-mega-r">Casos</p>
          <Historia />
        </div>
      </div>
    </div>
  );
}

/** El menú del teléfono: la hamburguesa abre la lista a pantalla completa; «Producto» e «Industrias» se despliegan en su renglón. */
function MenuMovil({ m }: { m: MenuProducto }) {
  return (
    <details className="s-mv">
      <summary aria-label="Menú">
        <svg className="s-mv-h" width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M1 1h22M1 8h22M1 15h22" /></svg>
        <svg className="s-mv-x" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M3 3l14 14M17 3L3 17" /></svg>
      </summary>
      <div className="s-mv-panel">
        <details className="s-mv-sub">
          <summary className="s-mv-fila">Producto <Chevron /></summary>
          <div className="s-mv-cuerpo">
            {m.grandes.map((g) => <Grande key={g.slug} href={g.href} icono={g.icono} nombre={g.nombre} bajada={g.bajada} />)}
            {m.columnas.map((c) => (
              <div key={c.rotulo} className="s-mv-grupo">
                <p className="s-mega-r">{c.rotulo}</p>
                <ul>{c.items.map((i) => <li key={i.slug}><a className="s-mega-l" href={i.href}>{i.nombre}</a></li>)}</ul>
              </div>
            ))}
          </div>
        </details>
        <details className="s-mv-sub">
          <summary className="s-mv-fila">Industrias <Chevron /></summary>
          <div className="s-mv-cuerpo">
            {INDUSTRIAS.map((i) => <Grande key={i.avatar} href={i.href} icono={i.icono} nombre={i.nombre} bajada={i.bajada} />)}
            <div className="s-mv-grupo">
              <p className="s-mega-r">Funnels</p>
              <ItemsFunnels />
            </div>
            <div className="s-mv-grupo">
              <p className="s-mega-r">Casos</p>
              <Historia />
            </div>
          </div>
        </details>
        <a className="s-mv-fila" href={RUTA_COMPARACIONES}>Comparaciones</a>
        <a className="s-mv-fila" href={RUTA_PRECIOS}>Precios</a>
        <div className="s-mv-pie">
          <a className="s-nb s-mv-entrar" href={RUTA_ENTRAR}>Iniciar sesión</a>
          {/* El mismo botón, corto en el teléfono angosto (como el de la barra). */}
          <a className="s-nb s-nb-lleno" href={RUTA_CTA}><span className="s-nb-largo">{TEXTO_CTA}</span><span className="s-nb-corto" aria-hidden="true">{TEXTO_CTA.replace(/\s+AHORA$/i, '')}</span></a>
        </div>
      </div>
    </details>
  );
}

/** La barra. `claro`: la de su página de comparaciones (blanca, con el botón principal del color de marca). */
export function Barra({ claro = false }: { claro?: boolean }) {
  const m = menuProducto();
  return (
    <header className="s-barra">
      <div className="s-barra-in">
        <div className="s-barra-izq">
          <LogoMaKo className="s-logo" tamano={28} claro={!claro} />
          <nav aria-label="Principal" className="s-nav-w">
            <ul className="s-nav">
              <li className="s-nav-it">
                <span className="s-nav-a" tabIndex={0} aria-haspopup="true">Producto</span>
                <MenuProductoPc m={m} />
              </li>
              <li className="s-nav-it">
                <span className="s-nav-a" tabIndex={0} aria-haspopup="true">Industrias</span>
                <MenuIndustriasPc />
              </li>
              <li className="s-nav-it"><a className="s-nav-a" href={RUTA_COMPARACIONES}>Comparaciones</a></li>
              <li className="s-nav-it"><a className="s-nav-a" href={RUTA_PRECIOS}>Precios</a></li>
            </ul>
          </nav>
        </div>
        <div className="s-barra-der">
          <a className="s-nav-a s-solo-pc" href={RUTA_ENTRAR}>Iniciar sesión</a>
          {/* En el teléfono angosto el botón se acorta («PRUÉBALO GRATIS»): con el logo y el menú no entraba a 360 (el Cerebro, 13/11). */}
          <a className="s-nb s-nb-lleno" href={RUTA_CTA}><span className="s-nb-largo">{TEXTO_CTA}</span><span className="s-nb-corto" aria-hidden="true">{TEXTO_CTA.replace(/\s+AHORA$/i, '')}</span></a>
          <MenuMovil m={m} />
        </div>
      </div>
      {/* El sol y la luna de la app, con su barrido (Martín, 12/11/2026): el script lo pone antes del botón para empezar. */}
      <TemaSitio base={claro ? 'claro' : 'oscuro'} />
    </header>
  );
}

/**
 * LA BARRA DEL SITIO EN CUALQUIER PÁGINA (las 19 landings por función y /planes). Martín, 12/11/2026: «me voy a otra tab y
 * después ya no sale la top bar de arriba para seguir navegando. Eso no puede ser, ahora ya no puedo regresar». Cada landing
 * traía la barra copiada de su referencia, sin Producto, Industrias, Comparaciones ni Precios: como en beehiiv, la barra es UNA
 * para todo el sitio y queda fija arriba al bajar. `barraPropia`: el selector de la barra copiada que esta reemplaza (se oculta).
 */
export function BarraGlobal({ claro = false, barraPropia }: { claro?: boolean; barraPropia?: string }) {
  const ocultar = barraPropia ? `${barraPropia}{display:none!important}` : '';
  return (
    <div className={`s-sitio s-solo-barra${claro ? ' s-claro' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_BARRA + CSS_SOLO_BARRA + ocultar }} />
      <Barra claro={claro} />
    </div>
  );
}

/** Sola, la barra no es una página: sin el alto de pantalla de .s-sitio, y la que queda fija arriba es la caja entera. */
const CSS_SOLO_BARRA = '.s-sitio.s-solo-barra{min-height:0;position:sticky;top:0;z-index:2147480000;overflow:visible}';
