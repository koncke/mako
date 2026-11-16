// =============================================================================
// La barra del sitio de MaKo, con sus menús: copiada de la de https://www.beehiiv.com/ (12/11/2026)
// =============================================================================
// Su estructura: el logo, los links (dos abren un menú a todo el ancho: «Product» y «Solutions»), y a la derecha «Log in» más
// dos botones. En MaKo: «Producto» (las 19 landings: cuatro grandes con ícono y bajada, y el resto en columnas por familia, como
// sus columnas Publish / Grow / Earn / Analyze / Connect), «Industrias» (su «Solutions»: la columna «For publishers» son los
// avatares de MaKo y «Featured stories» el caso de Mauricio; su columna de anunciantes y socios no va), «Recursos» y
// «Precios» (/planes). «Recursos» (15/11/2026) ocupa el lugar de «Comparaciones», que pasó adentro: el menú de texto con rótulos
// de beehiiv (Learn · Compare · Connect), con lo que MaKo tiene (./datos.ts, RECURSOS). A la derecha «Iniciar sesión» —o, con la sesión abierta, la foto de perfil y su desplegable, que es lo
// único de esta barra que mira el navegador y no el servidor (./Cuenta.tsx)—, el botón para empezar y, al final, el sol y la luna (Martín,
// 12/11/2026: «no tiene sentido arriba entrar, ver planes, agenda tu llamada… debería ser registrarse, loguearse», y después:
// «el Dark Mode y White Mode deberían estar a la derecha del todo. En la top bar elimina también ver planes… ya tenemos precios»).
//
// Lo que cambió, y por qué:
//   · Sus menús abren con JavaScript; estos con CSS (:hover y :focus-within). El que abre es un <span tabIndex={0}>, no un
//     <button> (un botón sin onClick es un botón muerto: tests/ningun-boton-muerto.test.ts).
//   · En el teléfono su lista a pantalla completa entra a un submenú con «Back»; aquí cada menú se despliega en su renglón con
//     <details>, sin JavaScript. Abajo quedan los mismos tres botones.
//   · Sus íconos son rosas; los de MaKo, dorados. El logo es el de MaKo (LogoMaKo).
// Los valores, en ./estilos.ts y docs/diseno/sitio-beehiiv.md. Server component: lo único de cliente que cuelga de acá es la
// cuenta (./Cuenta.tsx), y NO porque estas páginas sean estáticas —no lo son, el layout raíz ya lee la cookie y las 25 se
// arman en cada visita (medido el 15/11/2026, la nota larga está en ./Cuenta.tsx)— sino porque esta barra se dibuja también
// FUERA de un pedido: cuatro tests y scripts/visor-landings/ la arman con `renderToStaticMarkup`, y ahí `cookies()` revienta.
// =============================================================================

import { LogoMaKo, TEXTO_CTA, RUTA_CTA } from '../_competencia/marca';
import { TemaSitio } from '../_competencia/TemaSitio';
import { HISTORIA, INDUSTRIAS, RECURSOS, RUTA_ENTRAR, RUTA_PRECIOS, menuProducto, type ItemRecurso, type MenuProducto } from './datos';
// La ruta se le pasa por prop a propósito: es un componente de cliente, e importar ./datos.ts desde el navegador se llevaría
// al paquete el catálogo de integraciones, el de grabadores y las 19 landings para usar un string de siete letras.
import { MenuCuenta } from './Cuenta';
import { CerrarMenuMovil } from './CerrarMenuMovil';
import { Chevron, Icono } from './Piezas';
import { CSS_BARRA, CSS_BASE, CSS_PIE } from './estilos';
import { Pie } from './Pie';
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

/** Un renglón de «Recursos»: el link de texto de las columnas de «Producto». Lo que sale de MaKo abre en otra pestaña. */
function LinkRecurso({ i }: { i: ItemRecurso }) {
  return <a className="s-mega-l" href={i.href} {...(i.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{i.nombre}</a>;
}

/**
 * «Recursos» (Martín, 15/11/2026: «en lugar de poner comparaciones en la top bar, pondría recursos… fíjate como lo tienen otras
 * aplicaciones»). Como el menú «Resources» de beehiiv y como las columnas de «Producto» (Martín, 12/11: «que todas estén como
 * están abajo»): un rótulo por grupo y los links, sin íconos ni bajadas. La misma grilla que «Producto», así las columnas caen
 * en el mismo lugar.
 */
function MenuRecursosPc() {
  return (
    <div className="s-mega">
      <div className="s-mega-in">
        <div className="s-mega-cols">
          {RECURSOS.map((g) => (
            <div key={g.rotulo}>
              <p className="s-mega-r">{g.rotulo}</p>
              <ul>{g.items.map((i) => <li key={i.href}><LinkRecurso i={i} /></li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** El menú del teléfono: la hamburguesa abre la lista a pantalla completa; «Producto», «Industrias» y «Recursos» se despliegan en su renglón. */
function MenuMovil({ m }: { m: MenuProducto }) {
  return (
    <details className="s-mv">
      <summary aria-label="Menú">
        <svg className="s-mv-h" width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M1 1h22M1 8h22M1 15h22" /></svg>
        <svg className="s-mv-x" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M3 3l14 14M17 3L3 17" /></svg>
      </summary>
      <div className="s-mv-panel">
        {/* Tocar una sección de esta misma página (/#preguntas, /#integraciones, /#caso estando en la portada) cierra el menú: si
            no, el navegador bajaba detrás y el menú seguía tapando todo (./CerrarMenuMovil.tsx). */}
        <CerrarMenuMovil />
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
        <details className="s-mv-sub">
          <summary className="s-mv-fila">Recursos <Chevron /></summary>
          <div className="s-mv-cuerpo">
            {RECURSOS.map((g) => (
              <div key={g.rotulo} className="s-mv-grupo">
                <p className="s-mega-r">{g.rotulo}</p>
                <ul>{g.items.map((i) => <li key={i.href}><LinkRecurso i={i} /></li>)}</ul>
              </div>
            ))}
          </div>
        </details>
        <a className="s-mv-fila" href={RUTA_PRECIOS}>Precios</a>
        <div className="s-mv-pie">
          {/* Con la sesión abierta, acá está su cara y no «Iniciar sesión» (./Cuenta.tsx). En el teléfono el desplegable abre
              para arriba: el pie está pegado al borde de abajo. El <details> del menú no se entera — un clic adentro de su
              contenido no lo cierra, sólo lo hace el <summary>. */}
          <MenuCuenta entrar={RUTA_ENTRAR} enElPie />
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
              <li className="s-nav-it">
                <span className="s-nav-a" tabIndex={0} aria-haspopup="true">Recursos</span>
                <MenuRecursosPc />
              </li>
              <li className="s-nav-it"><a className="s-nav-a" href={RUTA_PRECIOS}>Precios</a></li>
            </ul>
          </nav>
        </div>
        <div className="s-barra-der">
          {/* El orden (Martín, 16/11/2026): la luna (la pone TemaSitio, antes del botón), el botón para empezar y, a la derecha del
              todo, «Iniciar sesión» o la cara de quien ya entró. */}
          {/* En el teléfono angosto el botón se acorta («PRUÉBALO GRATIS»): con el logo y el menú no entraba a 360 (el Cerebro, 13/11). */}
          <a className="s-nb s-nb-lleno" href={RUTA_CTA}><span className="s-nb-largo">{TEXTO_CTA}</span><span className="s-nb-corto" aria-hidden="true">{TEXTO_CTA.replace(/\s+AHORA$/i, '')}</span></a>
          {/* «Iniciar sesión», o la cara de quien ya entró con su desplegable (Martín, 15/11/2026: «si yo ya tengo iniciada la
              sesión, en lugar de decirme iniciar sesión, debería ahí estar mi imagen de perfil»). Quién está adentro lo
              pregunta el navegador, no esta página: esta barra la arman 25 páginas y también `renderToStaticMarkup`, fuera
              de todo pedido, donde `cookies()` revienta (./Cuenta.tsx). */}
          <MenuCuenta entrar={RUTA_ENTRAR} />
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

/**
 * EL PIE DEL SITIO EN CADA LANDING (14/11/2026, la revisión de las 28 páginas: «cada landing parece de una marca distinta… unos 8 pies
 * distintos… usar un solo pie, el del sitio»; y el Cerebro: Ads no decía «El mejor software para vender High Ticket»). Como la barra:
 * uno para todo el sitio. El pie copiado de la referencia (cada diseño tiene UN <footer>, el suyo) se oculta.
 * 15/11/2026 (Martín: «la bottom bar… debería estar en todas las landing, todas las rutas. Incluso en la de precios también, en
 * todas»): es EL lugar que dibuja el pie fuera de la portada, de Comparaciones y de los funnels (que lo traen adentro de su
 * `.s-sitio`). Lo usan /planes, /accelerator (y su formulario), /mako-partners, las landings, las 14 viejas y las de Web Generator.
 * Las legales NO (se abren adentro de la app de iPhone, donde no se puede enlazar a comprar): tests/sitio-recursos-y-pie.test.ts
 * recorre las páginas públicas y pide el pie en cada una (o el porqué de la que no lo lleva, en su `SIN_PIE`).
 * `claro`: el pie claro, para la página que nace clara (el logo va oscuro: sin el sol y la luna, nadie lo da vuelta).
 */
export function PieGlobal({ claro = false }: { claro?: boolean }) {
  return (
    <div className={`s-sitio s-solo-pie${claro ? ' s-claro' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_PIE + CSS_SOLO_PIE }} />
      <Pie claro={claro} />
    </div>
  );
}

/**
 * Solo, el pie no es una página: sin el alto de pantalla de .s-sitio. Y el pie que traía la página (el de su referencia) se oculta.
 * ⚠️ SÓLO EL PIE DE LA PÁGINA, NO EL DE UNA TARJETA (16/11/2026): un <footer> adentro de un <article> es el pie de ESA pieza, no el
 * de la página. Era `footer:not(.s-pie)` a secas y en la landing de Copywriting escondía el renglón de abajo de las tarjetas de la
 * comparación («@AlexHormozi · 105.615 vistas», «El original», «Su versión»). Los pies de las referencias no van en un <article>.
 */
export const CSS_SOLO_PIE = '.s-sitio.s-solo-pie{min-height:0}footer:not(.s-pie):not(article footer){display:none!important}';

/** Sola, la barra no es una página: sin el alto de pantalla de .s-sitio, y la que queda fija arriba es la caja entera. */
const CSS_SOLO_BARRA = '.s-sitio.s-solo-barra{min-height:0;position:sticky;top:0;z-index:2147480000;overflow:visible}';
