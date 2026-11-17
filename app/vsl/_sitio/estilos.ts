// =============================================================================
// Las hojas del sitio de MaKo (/vsl/sitio y /vsl/comparaciones): el DISEÑO de beehiiv con sus números
// =============================================================================
// Referencias copiadas (leídas el 12/11/2026 con Chromium a 1440 y 390 px, getComputedStyle y getBoundingClientRect):
//   · la barra, sus menús «Product» y «Solutions» abiertos y el pie de https://www.beehiiv.com/;
//   · las secciones de su portada. beehiiv sirve dos portadas (una prueba A/B): se copió la de «Everything you need to turn
//     attention into growth», a 1440 y a 390 (la otra, con «Stand out in the inbox», es otra página y no se mezcla);
//   · https://www.beehiiv.com/comparisons (la página clara: su hero de puntos, la tabla y la grilla «beehiiv vs the others»).
// Todos los valores, sección por sección, en docs/diseno/sitio-beehiiv.md.
//
// Lo que cambia, y por qué:
//   · Sus fuentes son Clash Grotesk y Satoshi (de Fontshare, con licencia propia, no están en Google Fonts). Van las de Google
//     más parecidas, que ya están en el repo y usa la landing de Email (que copió la misma referencia): Archivo variable (OFL) en
//     900 y al 88 % de ancho para los titulares en mayúsculas, y Figtree (OFL) para el texto.
//   · Su color de marca, el índigo #2F39BA (los botones, la tabla, los links de «Compare»), es el azul de MaKo #2F6FED; su rosa
//     #FF5EC4 (los rótulos, el renglón en degradado del titular, los íconos de los menús, los números) es el dorado #F2B01E; sus
//     rosas claros (las capas del botón) son dorados claros; su lavanda (#D7D9F6, el fondo de comparaciones) es el mismo tinte
//     del azul de MaKo (#D5E2FB). Los fondos oscuros, los grises, los radios y los espacios son los suyos.
// Todo prefijado `s-`, bajo `.s-sitio`. Sin JavaScript: los menús abren con :hover y :focus-within y el del teléfono con
// <details>. Las animaciones son de CSS y se apagan con prefers-reduced-motion.
// =============================================================================

import { fondoDeSigno } from '@/app/planes/signos';
import { LOGOS_SOBRE_BLANCO } from './reemplaza';

const FONDO = '#060419';
const CARD = '#0D0B28';
const SUBCARD = '#1C1940';
const CAJA_ICONO = '#141230';
const TEXTO = '#F7F5FF';
const GRIS = '#DDDCE8';
const GRIS2 = '#C4C2D6';
const GRIS3 = '#9393A9';
const NOTA = '#B8B8C8';
const LINEA = 'rgba(255,255,255,.06)';
const LINEA12 = 'rgba(255,255,255,.12)';
const AZUL = '#2F6FED';
const AZUL_HOVER = '#A9C4FA';
const AZUL_TINTE = '#D5E2FB';
const AZUL_CELDA = 'rgba(249,250,255,.5)';
const DORADO = '#F2B01E';
const DORADO_CAPA = '#FBE3A6';
const DORADO_CLARO = '#FDF0CC';
const TINTA = '#060419';
const GRIS_CLARO = '#6F6F8A';
const GRIS_CLARO2 = '#4E4E6C';
/** Los logos que van sobre blanco en el modo oscuro, como selector de CSS (el archivo de cada uno en public/vsl-assets/logos/apps/). */
const SEL_LOGOS_SOBRE_BLANCO = LOGOS_SOBRE_BLANCO.map((a) => `[src$="/${a}.png"]`).join(',');
export const TITULAR = `font-family:'s-archivo','s-figtree',Arial,sans-serif;font-weight:900;font-stretch:88%;text-transform:uppercase;text-wrap:balance`;

// ─────────────────────────────────────────────────────────────────────────────
// La base: fuentes, el contenedor y el botón
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_BASE = `
@font-face{font-family:'s-archivo';src:url('/vsl-assets/fuentes/archivo/archivo-latin-wdth-wght.woff2') format('woff2');font-weight:100 900;font-stretch:62% 125%;font-display:swap}
@font-face{font-family:'s-figtree';src:url('/vsl-assets/fuentes/figtree/figtree-latin.woff2') format('woff2');font-weight:300 900;font-display:swap}
.s-sitio{background:${FONDO};color:#fff;font-family:'s-figtree',Arial,sans-serif;font-size:16px;line-height:24px;-webkit-font-smoothing:antialiased;overflow-x:clip;position:relative;min-height:100vh}
.s-sitio.s-claro{background:#fff;color:${TINTA}}
.s-sitio *{box-sizing:border-box}
:where(.s-sitio) :where(h1,h2,h3,p,ul,li,figure,blockquote,table){margin:0;padding:0}
:where(.s-sitio) :where(ul){list-style:none}
:where(.s-sitio) :where(a){text-decoration:none;color:inherit}
.s-sitio summary{list-style:none}
.s-sitio summary::-webkit-details-marker{display:none}
.s-cont{max-width:1440px;margin:0 auto;padding:0 128px}
.s-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.s-sitio a:focus-visible,.s-sitio summary:focus-visible,.s-sitio [tabindex]:focus-visible{outline:2px solid ${AZUL};outline-offset:2px}

/* El ícono de MaKo como logo de app (la tabla y las tarjetas de Comparaciones, la cuenta de lo que pagas hoy): NEGRO sobre claro y
   BLANCO sobre oscuro (Martín, 14/11/2026: «en modo claro sale blanco y en modo oscuro sale negro»). Lleva data-tema-fijo: el sol y
   la luna llevaba su cuadro negro al modo como un fondo más, y en el claro lo pasaba a blanco. El modo lo dice data-sitio-modo. */
.s-mk-ico{background:#1A1712}
html[data-sitio-modo="oscuro"] .s-mk-ico{background:#fff}

/* LOS LOGOS DE MARCA CASI NEGRA, SOBRE SU CUADRO BLANCO EN EL MODO OSCURO (15/11/2026, Martín: «fíjate todos los logos»). El cursor de
   ClickFunnels es #080436 y la «s» de Skool #282F97: sobre el fondo #060419 no se leían (la tira de la portada, la cuenta de lo que
   pagas, la tabla y las tarjetas de Comparaciones). Van sobre blanco, como el ícono de su app; en el claro, sin cuadro. Cuáles son,
   en ./reemplaza.ts (LOGOS_SOBRE_BLANCO). El sol y la luna no toca las imágenes: el modo lo pone este CSS. */
.s-sitio:not(.s-claro) img:is(${SEL_LOGOS_SOBRE_BLANCO}),html[data-sitio-modo="oscuro"] .s-sitio img:is(${SEL_LOGOS_SOBRE_BLANCO}){background:#fff;padding:3px}
html[data-sitio-modo="claro"] .s-sitio img:is(${SEL_LOGOS_SOBRE_BLANCO}){background:none;padding:0}

/* Su botón: la cara de color, radio 6. SIN las dos capas que se separaban al pasar el mouse (Martín, 12/11/2026: «hace una
   animación rarísima… no quiero que ese hover exista. De última un pequeño hover, pero muy sutil»): al pasar, se aclara apenas. */
.s-btn{position:relative;display:inline-flex}
.s-btn-t{position:relative;z-index:10;display:inline-flex;align-items:center;justify-content:center;gap:10px;background:${AZUL};border:1px solid ${AZUL};border-radius:6px;padding:8px 24px;font-size:18px;line-height:28px;font-weight:700;color:#fff;white-space:nowrap;transition:filter .15s ease}
.s-btn-c1,.s-btn-c2{display:none}
.s-btn:hover .s-btn-t{filter:brightness(1.08)}
/* El de borde (su «Sign up with email»): fondo #131125 y filete casi blanco. */
.s-btn-borde .s-btn-t{background:#131125;border-color:#FCFCFD}
.s-btn-alto .s-btn-t{padding:10px 24px}
@media (prefers-reduced-motion:reduce){
  .s-btn-t{transition:none}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// La barra y sus menús
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_BARRA = `
/* La barra: 77 px (36 de botones y 20 arriba y abajo), 128 a los lados, filete blanco al 12 %, pegada arriba. */
.s-barra{position:sticky;top:0;z-index:60;background:${FONDO};border-bottom:1px solid ${LINEA12}}
.s-barra-in{max-width:1440px;margin:0 auto;padding:0 128px;height:76px;display:flex;align-items:center;justify-content:space-between}
.s-barra-izq{display:flex;align-items:stretch;height:100%}
.s-logo{align-self:center;font-family:'s-figtree',Arial,sans-serif}
/* Los links: 14/20 600 #DDDCE8, 8 × 12, radio 6, separados 4; el de un menú abierto, con su velo blanco al 10 %. */
.s-nav-w{display:flex;align-items:stretch}
.s-nav{display:flex;align-items:stretch;gap:4px;margin-left:40px}
.s-nav-it{display:flex;align-items:center}
.s-nav-a{display:inline-flex;align-items:center;font-size:14px;line-height:20px;font-weight:600;color:${GRIS};padding:8px 12px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:color .2s cubic-bezier(.4,0,.2,1),background-color .2s cubic-bezier(.4,0,.2,1)}
.s-nav-a:hover,.s-nav-it:hover>.s-nav-a,.s-nav-it:focus-within>.s-nav-a{background:rgba(255,255,255,.1);color:#fff}
.s-barra-der{display:flex;align-items:center;gap:12px}
.s-nb{display:inline-flex;align-items:center;font-size:14px;line-height:20px;font-weight:600;padding:7px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.2);color:#fff;white-space:nowrap;transition:background-color .15s,color .15s}
.s-nb:hover{background:rgba(255,255,255,.08)}
.s-nb-lleno{background:#fff;border-color:#fff;color:${FONDO}}
.s-nb-lleno:hover{background:${GRIS}}

/* El menú abierto: a todo el ancho, debajo de la barra, #0D0B28 con filete abajo; entra en .32 s. */
.s-mega{position:absolute;left:0;right:0;top:100%;background:${CARD};border-bottom:1px solid ${LINEA12};opacity:0;visibility:hidden;transform:translateY(-8px);pointer-events:none;transition:opacity .32s,transform .32s,visibility 0s linear .32s}
.s-nav-it:hover>.s-mega,.s-nav-it:focus-within>.s-mega{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .32s,transform .32s,visibility 0s}
.s-nav:hover .s-nav-it:not(:hover)>.s-mega{opacity:0;visibility:hidden;transform:translateY(-8px);pointer-events:none}
.s-nav:hover .s-nav-it:not(:hover)>.s-nav-a{background:transparent;color:${GRIS}}
.s-mega-in{width:min(1200px,calc(100% - 48px));margin:0 auto;padding:40px 0 44px}
/* «Product»: los cuatro grandes (cuadro de 40 #141230 radio 4 con el ícono de 20 en el color de acento; 15/20 700 y 15/20 500). */
.s-mega-grandes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:48px}
.s-mg{display:flex;align-items:flex-start;gap:12px;margin:0 -8px;padding:12px 8px;border-radius:8px;transition:background-color .15s cubic-bezier(.4,0,.2,1)}
.s-mg:hover{background:rgba(255,255,255,.1)}
.s-mg-ico{flex:none;width:40px;height:40px;border-radius:4px;background:${CAJA_ICONO};display:flex;align-items:center;justify-content:center;color:${DORADO}}
.s-mg-tx{min-width:0}
.s-mg-t{display:block;font-size:15px;line-height:20px;font-weight:700;color:#fff}
.s-mg-d{display:block;margin-top:4px;font-size:15px;line-height:20px;font-weight:500;color:${TEXTO}}
/* Sus columnas: filete arriba al 6 %, 40 de aire, el rótulo 12/16 700 en mayúsculas #9393A9 y los links 16/20 500 de 32 de alto. */
.s-mega-cols{margin-top:40px;padding-top:40px;border-top:1px solid ${LINEA};display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:40px}
.s-mega-cols:first-child{margin-top:0;padding-top:0;border-top:0}
.s-mega-r{font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${GRIS3};margin-bottom:12px}
.s-mega-l{display:block;width:fit-content;margin-left:-8px;padding:6px 8px;border-radius:6px;font-size:16px;line-height:20px;font-weight:500;color:#fff;transition:color .15s cubic-bezier(.4,0,.2,1),background-color .15s cubic-bezier(.4,0,.2,1)}
.s-mega-l:hover{background:rgba(255,255,255,.1);color:${AZUL_HOVER}}
/* «Solutions»: su columna «For publishers» (362), el hueco de la de anunciantes, y «Featured stories» con su filete a la izquierda. */
.s-mega-ind{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 340px;gap:40px}
.s-mega-ind .s-mg{margin:0 -8px}
.s-mega-hist{border-left:1px solid ${LINEA};padding-left:40px}
.s-hist{display:flex;align-items:center;gap:16px;padding:12px;border-radius:8px;background:${SUBCARD};transition:background-color .15s}
.s-hist:hover{background:#25224F}
.s-hist-img{flex:none;width:66px;height:44px;border-radius:6px;object-fit:cover;object-position:20% 88%;background:#000}
.s-hist-tx{min-width:0}
.s-hist-t{display:block;font-size:15px;line-height:20px;font-weight:700;color:#fff}
.s-hist-d{display:block;font-size:15px;line-height:20px;font-weight:500;color:${TEXTO};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* El menú del teléfono (debajo de 1024): la barra de 57 con el logo, el botón y la hamburguesa; abierto, la lista a pantalla
   completa con sus renglones de 57 y, abajo, los tres botones. */
.s-mv{display:none}
.s-mv>summary{display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer;color:#fff}
.s-mv .s-mv-x{display:none}
.s-mv[open] .s-mv-x{display:block}
.s-mv[open] .s-mv-h{display:none}
.s-mv-panel{position:fixed;top:57px;left:0;right:0;bottom:0;z-index:70;background:${FONDO};overflow-y:auto;padding:0 16px 104px}
.s-mv-fila{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid ${LINEA};font-size:16px;line-height:20px;font-weight:500;color:#fff;cursor:pointer}
.s-mv-fila svg{flex:none;transition:transform .2s cubic-bezier(.4,0,.2,1)}
.s-mv-sub[open]>.s-mv-fila svg{transform:rotate(90deg)}
.s-mv-cuerpo{padding:16px 0 8px;border-bottom:1px solid ${LINEA}}
.s-mv-cuerpo .s-mg{margin:0 -8px}
.s-mv-grupo{padding:24px 0 8px;border-top:1px solid ${LINEA};margin-top:16px}
.s-mv-grupo .s-mega-r{margin-bottom:8px}
/* El primer grupo de un menú sin la raya de arriba: Producto (sin sus cuatro grandes desde el 12/11) y Recursos empiezan por un grupo, y
   quedaba una franja vacía con su raya antes del primer rótulo. */
.s-mv-cuerpo>.s-mv-grupo:first-child{margin-top:0;padding-top:4px;border-top:0}
.s-mv-grupo .s-mega-l{margin-left:0;padding:9px 0;line-height:24px}
.s-mv-pie{position:fixed;left:0;right:0;bottom:0;z-index:71;display:flex;align-items:center;gap:8px;padding:16px;background:${FONDO};border-top:1px solid ${LINEA12}}
.s-mv-pie .s-nb{justify-content:center}
.s-mv-pie .s-nb:not(.s-mv-entrar){flex:1 1 auto}
.s-mv-entrar{border-color:transparent!important;color:${GRIS}!important}
html:has(.s-mv[open]){overflow:hidden}
/* Abierto, como el suyo: arriba sólo el logo y la cruz (los botones quedan abajo). */
.s-barra-der:has(.s-mv[open])>.s-nb-lleno{display:none}
/* El botón para empezar, corto en el teléfono angosto; y el sol y la luna, adentro del menú (lo pone TemaSitio). */
.s-nb-corto{display:none}
.s-mv-tema{cursor:default}
/* El botón (36 px) no estira la fila: «Claro u oscuro» mide lo mismo que «Precios» y las demás (61 px), con su raya igual. */
.s-mv-tema .mk-tema-sitio{margin:-8px -8px -8px 0}
@media (max-width:400px){.s-nb-lleno .s-nb-largo{display:none}.s-nb-lleno .s-nb-corto{display:inline}}
@media (max-width:767px){.s-barra-in .s-logo>span+span{display:none}}
@media (max-width:359px){.s-barra-der{gap:8px}}

/* La barra clara (la de su página de comparaciones): blanca, filete #060419 al 12 %, el botón principal del color de marca. */
.s-claro .s-barra{background:#fff;border-bottom-color:rgba(6,4,25,.12)}
.s-claro .s-nav-a{color:${TINTA}}
.s-claro .s-nav-a:hover,.s-claro .s-nav-it:hover>.s-nav-a,.s-claro .s-nav-it:focus-within>.s-nav-a{background:rgba(6,4,25,.06);color:${TINTA}}
.s-claro .s-nav:hover .s-nav-it:not(:hover)>.s-nav-a{background:transparent;color:${TINTA}}
.s-claro .s-nb{color:${TINTA};border-color:#000}
.s-claro .s-nb:hover{background:rgba(6,4,25,.06)}
.s-claro .s-nb-lleno{background:${AZUL};border-color:${AZUL};color:#fff}
.s-claro .s-nb-lleno:hover{background:#1F57C8;border-color:#1F57C8}
/* Y el mismo azul cuando la persona aclara una página que nació oscura (la portada): el sol y la luna deja los botones como están
   (un botón conserva su color en los dos modos), y el blanco de la barra oscura quedaba blanco sobre la barra ya clara. El velo del
   link con su menú abierto, el de la barra clara. */
html[data-sitio-modo="claro"] .s-barra .s-nb-lleno{background:${AZUL};border-color:${AZUL};color:#fff}
html[data-sitio-modo="claro"] .s-barra .s-nb-lleno:hover{background:#1F57C8;border-color:#1F57C8}
html[data-sitio-modo="claro"] .s-nav-a:hover,html[data-sitio-modo="claro"] .s-nav-it:hover>.s-nav-a,html[data-sitio-modo="claro"] .s-nav-it:focus-within>.s-nav-a{background:rgba(6,4,25,.06)}
.s-claro .s-mega{background:#fff;border-bottom-color:#D6D6E0}
.s-claro .s-mg:hover,.s-claro .s-mega-l:hover{background:rgba(6,4,25,.06)}
.s-claro .s-mg-ico{background:#EEF3FE}
.s-claro .s-mg-t,.s-claro .s-hist-t,.s-claro .s-mega-l{color:${TINTA}}
.s-claro .s-mg-d,.s-claro .s-hist-d{color:${GRIS_CLARO}}
.s-claro .s-mega-l:hover{color:${AZUL}}
.s-claro .s-mega-cols,.s-claro .s-mega-hist{border-color:rgba(6,4,25,.08)}
.s-claro .s-hist{background:#F3F6FE}
.s-claro .s-hist:hover{background:#E7EEFD}
.s-claro .s-mv>summary{color:${TINTA}}
.s-claro .s-mv-panel,.s-claro .s-mv-pie{background:#fff}
.s-claro .s-mv-fila{color:${TINTA};border-bottom-color:rgba(6,4,25,.08)}
.s-claro .s-mv-cuerpo,.s-claro .s-mv-grupo{border-color:rgba(6,4,25,.08)}
.s-claro .s-mv-pie{border-top-color:rgba(6,4,25,.12)}
.s-claro .s-mv-entrar{color:${TINTA}!important}

/* ─────────────────────────────────────────────────────────────────────────────
   LA CUENTA: la foto de perfil y su desplegable, donde decía «Iniciar sesión» (15/11/2026)
   ─────────────────────────────────────────────────────────────────────────────
   Martín, 15/11/2026: «si yo ya tengo iniciada la sesión, en lugar de decirme iniciar sesión, debería ahí estar mi imagen de
   perfil, mi foto de perfil. Y si le doy clic, que me salte el desplegable». La forma es la del menú de cuenta de Linear,
   Notion y Vercel: la cara sola en la barra, y el desplegable con quién sos arriba y los renglones con ícono debajo. Los
   números son los de ESTA barra —el velo blanco al 10 % y el filete del menú grande (.s-mega), el azul de marca— con dos
   cambios: el radio 6 de sus botones sube a 12, porque es una tarjeta y no un botón, y la tarjeta lleva sombra, que en esta
   barra no hay nada más que la tenga porque nada más flota sobre la página.
   ⚠️ LOS DOS MODOS SE DECLARAN ACÁ, y por eso los colores salen de variables. El botón nace cuando contesta la red y el
   desplegable en el clic, o sea DESPUÉS de que el sol y la luna leyó los colores de la página: llevan data-tema-fijo, el
   script no los lleva al modo y el modo lo tiene que poner el CSS (ver app/vsl/_sitio/Cuenta.tsx). Entonces el claro va con
   .s-claro (como nació la página) y con html[data-sitio-modo="claro"] (lo que eligió la persona), y el oscuro repite sus
   valores bajo html[data-sitio-modo="oscuro"] para ganarle a .s-claro cuando la persona oscurece una página clara.
   (Sin comillas invertidas en estos comentarios: esta hoja es un template literal y una comilla invertida lo cierra.) */
.s-cuenta{--cu-fondo:${CARD};--cu-filete:${LINEA12};--cu-tinta:#fff;--cu-dim:${GRIS3};--cu-raya:${LINEA};--cu-velo:rgba(255,255,255,.1);--cu-aro:rgba(255,255,255,.22);--cu-aro-alto:rgba(255,255,255,.32);--cu-sombra:0 24px 56px -16px rgba(0,0,0,.6);position:relative;display:flex;align-items:center;min-width:0}
.s-claro .s-cuenta,html[data-sitio-modo="claro"] .s-cuenta{--cu-fondo:#fff;--cu-filete:#D6D6E0;--cu-tinta:${TINTA};--cu-dim:${GRIS_CLARO};--cu-raya:rgba(6,4,25,.08);--cu-velo:rgba(6,4,25,.06);--cu-aro:rgba(6,4,25,.1);--cu-aro-alto:rgba(6,4,25,.16);--cu-sombra:0 24px 56px -16px rgba(6,4,25,.28)}
html[data-sitio-modo="oscuro"] .s-cuenta{--cu-fondo:${CARD};--cu-filete:${LINEA12};--cu-tinta:#fff;--cu-dim:${GRIS3};--cu-raya:${LINEA};--cu-velo:rgba(255,255,255,.1);--cu-aro:rgba(255,255,255,.22);--cu-aro-alto:rgba(255,255,255,.32);--cu-sombra:0 24px 56px -16px rgba(0,0,0,.6)}
/* El botón: la cara (y el nombre, en el pie del teléfono). Nada de fondo ni de borde propios: lo que se ve es la cara. */
.s-cuenta-b{display:flex;align-items:center;gap:10px;min-width:0;max-width:220px;padding:2px;border:0;border-radius:999px;background:none;font:inherit;color:inherit;cursor:pointer}
.s-cuenta-b:focus-visible{outline:2px solid ${AZUL};outline-offset:2px}
/* La cara: la foto, o las iniciales sobre el azul de marca. El filete la separa de la barra con cualquier foto detrás, y el
   aro de color aparece al pasar el mouse y mientras el menú está abierto, que es lo único que dice que esto se aprieta. */
.s-cuenta-cara{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;border-radius:999px;background:linear-gradient(145deg,${AZUL} 0%,#1F57C8 100%);color:#fff;font-weight:700;line-height:1;box-shadow:0 0 0 1px var(--cu-aro),0 0 0 0 rgba(47,111,237,0);transition:box-shadow .15s cubic-bezier(.4,0,.2,1)}
.s-cuenta-cara img{display:block;width:100%;height:100%;object-fit:cover}
.s-cuenta-b:hover .s-cuenta-cara,.s-cuenta-b[aria-expanded="true"] .s-cuenta-cara{box-shadow:0 0 0 1px var(--cu-aro-alto),0 0 0 3px rgba(47,111,237,.45)}
/* El nombre: sólo en el pie del teléfono, un renglón, con puntos suspensivos si no entra al lado del botón de empezar. */
.s-cuenta-n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px;font-weight:600}
/* El desplegable: 264 de ancho, pegado al borde derecho del botón, 10 de aire. */
.s-cuenta-m{position:absolute;top:calc(100% + 10px);right:0;z-index:80;width:264px;padding:6px;border-radius:12px;background:var(--cu-fondo);border:1px solid var(--cu-filete);box-shadow:var(--cu-sombra);animation:s-cuenta-abre .16s cubic-bezier(.4,0,.2,1)}
/* En el pie del teléfono abre PARA ARRIBA: el pie está pegado al borde de abajo de la pantalla. */
.s-cuenta[data-arriba] .s-cuenta-m{top:auto;bottom:calc(100% + 10px);animation-name:s-cuenta-abre-arriba}
@keyframes s-cuenta-abre{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
@keyframes s-cuenta-abre-arriba{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
/* Quién sos, arriba: la cara grande, el nombre y el correo. El correo en gris: es para reconocer la cuenta, no para leerlo. */
.s-cuenta-quien{display:flex;align-items:center;gap:10px;padding:10px}
.s-cuenta-t{flex:1 1 auto;min-width:0}
.s-cuenta-t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:19px;font-weight:700;color:var(--cu-tinta)}
.s-cuenta-t span{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:17px;color:var(--cu-dim)}
.s-cuenta-sep{height:1px;margin:5px 4px;background:var(--cu-raya)}
/* Los renglones: el ícono en gris y el texto en tinta; al pasar o al llegar con el teclado, el velo y el ícono en tinta. */
.s-cuenta-f{display:flex;align-items:center;gap:10px;width:100%;min-height:36px;padding:8px 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:14px;line-height:20px;font-weight:500;color:var(--cu-tinta);text-align:left;cursor:pointer;transition:background-color .12s cubic-bezier(.4,0,.2,1)}
.s-cuenta-f svg{flex:none;color:var(--cu-dim);transition:color .12s cubic-bezier(.4,0,.2,1)}
.s-cuenta-f:hover,.s-cuenta-f:focus-visible{background:var(--cu-velo)}
/* El velo solo no alcanza para decir dónde está el foco (es el mismo que el del mouse): el renglón enfocado lleva además el
   filete azul, por dentro para que no lo tape el borde de la tarjeta. */
.s-cuenta-f:focus-visible{outline:2px solid ${AZUL};outline-offset:-2px}
.s-cuenta-f:hover svg,.s-cuenta-f:focus-visible svg{color:var(--cu-tinta)}
.s-cuenta-f[disabled]{cursor:default;opacity:.6}
/* «Cerrar sesión», en ROJO (Martín, 16/11/2026, a la noche: «cerrar sesión debería estar en rojo»): el texto y su ícono, también al
   pasar el mouse. El mismo rojo en los dos modos (el menú lleva data-tema-fijo). */
.s-cuenta-f.s-cuenta-salir,.s-cuenta-f.s-cuenta-salir svg,.s-cuenta-f.s-cuenta-salir:hover svg,.s-cuenta-f.s-cuenta-salir:focus-visible svg{color:#D93025}
.s-cuenta-f.s-cuenta-salir:hover,.s-cuenta-f.s-cuenta-salir:focus-visible{background:rgba(217,48,37,.08)}

@media (prefers-reduced-motion:reduce){
  .s-mega,.s-nav-it:hover>.s-mega,.s-nav-it:focus-within>.s-mega{transition:none;transform:none}
  .s-mv-fila svg{transition:none}
  .s-cuenta-m{animation:none}
  .s-cuenta-cara,.s-cuenta-f,.s-cuenta-f svg{transition:none}
}
@media (max-width:1279px){
  .s-cont,.s-barra-in{padding:0 32px}
  .s-nav{margin-left:24px}
}
@media (max-width:1023px){
  .s-nav,.s-solo-pc{display:none!important}
  .s-barra-in{height:56px;padding:0 16px}
  .s-barra-der{gap:12px}
  .s-nb-lleno{font-size:14px;line-height:18px;padding:8px 12px}
  .s-mv{display:block}
  /* EL SOL Y LA LUNA, ARRIBA Y A MANO TAMBIÉN EN EL TELÉFONO (Martín, 16/11/2026: «no tiene para fácil acceso al dark mode o
     white mode y debería tenerlo arriba… eliminando la palabra MaKo del título y solamente dejando la estrellita»). Antes iba
     sólo en el menú: con el logo entero, el botón y el ☰ no entraba (13/11/2026). Abajo de 768 el logo queda en la estrellita. */
  /* La cuenta del pie del menú: el desplegable se ancla a la IZQUIERDA (el botón está a la izquierda del pie) y no se sale
     de los 16 de margen; y los renglones suben a 44 de alto, que es el mínimo para un dedo (el --touch de la app). */
  .s-cuenta-pie .s-cuenta-m{left:0;right:auto;width:min(288px,calc(100vw - 32px))}
  .s-cuenta-f{min-height:44px}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// El pie
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_PIE = `
/* Su pie: filete arriba; arriba la marca (el logo, el lema y su bajada) con el contacto, debajo las columnas (títulos 14/20 700,
   links 14/20 500 #9393A9) y abajo el © con la razón social y la estrella.
   LA RAZÓN SOCIAL, PEGADA A LO DE ARRIBA (15/11/2026, Martín: «quedó como muy alejado, hay mucha separación»). Eran 109 px entre el
   último link y el ©: 48 + 32 alrededor de un filete blanco al 6 % que no se veía, y 16 de margen del © que lo separaban de una fila
   de links legales que se fue el 12/11 (los legales pasaron a su columna). Ahora el © va centrado con la estrella, y el filete
   lo dibuja la base con SU color de texto (una sombra con currentColor: el sol y la luna da vuelta el color y la sombra lo sigue; un
   borde, en el claro, lo aclaraba hasta perderlo, como en la cuenta de lo que pagas).
   MÁS BAJO (16/11/2026, Martín: «la bottom bar quedó demasiado alta, entonces hay que ver cómo reducir eso»). Medido con la portada
   dibujada: 697 px a 1440, 957 a 1280 y a 1024, 1.409 a 390. En la computadora la marca, la frase y el contacto pasan a UN renglón
   (eran tres renglones apilados: 100 px y 40 de aire), los links van cada 28 px (eran 32), los rótulos con 12 debajo (16) y el pie
   con 48 arriba y 40 abajo (64 y 64). En el teléfono, cada columna es un renglón que se despliega (.s-pie-pliegues): las ocho
   columnas en dos eran casi dos pantallas. Nada se fue: los mismos links, en el mismo orden.
   MÁS BAJO OTRA VEZ, Y CON TODO (16/11/2026, a la tarde, Martín: «sigo viendo la bottom bar muy alta… deberían estar todo, pero
   que evidentemente se vea bien»): era 551 px a 1440 y 727 a 375. La columna más alta era Industrias con los Funnels debajo: en
   la computadora los Funnels van en SU columna (./Pie.tsx); los links cada 24 px (eran 28), los rótulos con 8 debajo, el pie con
   36 arriba y 24 abajo. El mismo pie en el Accelerator, con TODAS las columnas (sólo cambia su fondo). */
/* SIN EL LEMA Y MÁS JUNTO (16/11/2026, ~17:50 UTC, Martín: «podríamos eliminar el mejor software para ventas high ticket… que el
   logo de MaKo esté abajo a la derecha, en donde hoy está la estrellita… equipo y WhatsApp en ese espacio en blanco al lado de
   legal… juntar un poquito más las cosas»): las columnas arriba de todo, el contacto debajo de Legal, el logo en el renglón del ©. */
.s-pie{background:${FONDO};border-top:1px solid ${LINEA};padding:30px 0 20px}
.s-pie-in{display:grid;grid-template-columns:minmax(0,1fr);gap:0;padding-bottom:16px}
.s-pie-marca{display:flex;align-items:center;gap:12px 24px}
.s-pie-logo{flex:none}
.s-pie-frase{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px}
/* Sin el tope de 300 px: cortaba «High / Ticket.» y dejaba «Ticket.» solo en su renglón. */
.s-pie-lema{font-size:16px;line-height:24px;font-weight:700;color:#fff;text-wrap:balance}
.s-pie-sub{font-size:14px;line-height:20px;font-weight:500;color:${GRIS3}}
/* EL CONTACTO, A LA VISTA (16/11/2026, Martín: «que no solamente esté el email, sino que también esté el WhatsApp de MaKo»): el email
   y el WhatsApp de MaKo (./contacto.ts), con su logo en su verde. Antes el email iba al final de la columna Legal. */
.s-pie-contacto{flex:none;display:flex;align-items:center;gap:6px 20px;flex-wrap:wrap}
.s-pie-contacto a{display:inline-flex;align-items:center;gap:8px;min-height:32px;font-size:14px;line-height:20px;font-weight:600;color:${GRIS};white-space:nowrap;transition:color .15s}
.s-pie-contacto a:hover{color:#fff}
.s-pie-contacto svg{flex:none}
.s-pie-contacto li:last-child svg{color:#25D366}
/* LAS COLUMNAS EN UN RENGLÓN DESDE 1440, y en una grilla de cuatro más angosto. Ocho columnas sin cortar un nombre suman 1.150 px
   y a 1440 hay 1.184; a 1280 (1.024 de ancho) y a 1024 (960) no entraban: con siete ya se pasaban y a 1024 cortaban el correo. */
.s-pie-cols{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:22px 20px}
/* Diez columnas (el contacto, la décima) a 12,5 px: medido, a 13 px y 10 de aire se pasaban 46 px de 1184; así sobran 16. El aire lo
   reparte space-between; el mínimo de 8 es para que no se peguen. */
@media (min-width:1440px){.s-pie-cols{display:flex;gap:8px;justify-content:space-between}}
.s-pie-h{font-size:12.5px;line-height:18px;font-weight:700;color:#fff;margin-bottom:6px;white-space:nowrap}
/* El segundo rótulo de una columna (los Funnels, debajo de Industrias, como en el menú de la barra). */
.s-pie-h2{margin-top:16px}
.s-pie-col li{font-size:12.5px;line-height:18px;font-weight:500;padding-bottom:4px}
.s-pie-col a{color:${GRIS3};white-space:nowrap;transition:color .15s}
.s-pie-col a:hover{color:#fff}
/* El contacto, su columna al costado de Legal, con la letra de los links. En el teléfono va aparte, a la vista (.s-pie-contacto-tel). */
.s-pie-col .s-pie-contacto{display:block}
.s-pie-col .s-pie-contacto a{min-height:0;gap:6px;font-size:12.5px;line-height:18px;font-weight:500;color:${GRIS3}}
.s-pie-col .s-pie-contacto svg{width:14px;height:14px}
.s-pie-contacto-tel{display:none}
/* La versión del teléfono (los renglones que se despliegan): sólo abajo de 768. */
.s-pie-pliegues{display:none}
.s-pie-base{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-top:14px;box-shadow:inset 0 1px 0 color-mix(in srgb,currentColor 14%,transparent)}
.s-pie-c{font-size:14px;line-height:20px;font-weight:500;color:${GRIS2}}
.s-claro .s-pie{background:#FCFCFD;border-top-color:rgba(6,4,25,.12)}
.s-claro .s-pie-lema,.s-claro .s-pie-h,.s-claro .s-pie-pliegue summary{color:${TINTA}}
.s-claro .s-pie-sub,.s-claro .s-pie-col a{color:${GRIS_CLARO}}
.s-claro .s-pie-contacto a{color:${GRIS_CLARO2}}
.s-claro .s-pie-col a:hover,.s-claro .s-pie-contacto a:hover{color:${TINTA}}
.s-claro .s-pie-c{color:${GRIS_CLARO2}}
/* Entre 768 y 1279 la marca y la frase no entran con el contacto en un renglón: el contacto baja. */
@media (max-width:1279px){
  .s-pie-marca{flex-wrap:wrap}
  .s-pie-contacto{flex-basis:100%}
}
@media (max-width:1023px){
  .s-pie-cols{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 16px}
}
/* A 390: arriba la marca con su lema y el contacto (como en la computadora: el Cerebro, 14/11/2026), cada columna en un renglón que se
   despliega, y al final el ©. Los renglones miden 48 (más que los 44 de un dedo) y se separan con una raya de SU color de texto. */
@media (max-width:767px){
  .s-pie{padding:28px 0 20px}
  .s-pie .s-cont{display:flex;flex-direction:column;padding:0 16px}
  .s-pie-in{display:contents}
  .s-pie-marca{order:1;flex-direction:column;align-items:flex-start;gap:8px;margin-bottom:12px}
  .s-pie-frase{flex-direction:column;align-items:flex-start;gap:4px}
  .s-pie-contacto{flex-direction:column;align-items:flex-start;gap:0}
  .s-pie-contacto a{min-height:34px}
  .s-pie-cols{display:none}
  .s-pie-pliegues{display:block;order:2;margin-bottom:12px}
  .s-pie-contacto-tel{display:flex;order:3;margin-bottom:12px}
  .s-pie-pliegue summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;cursor:pointer;font-size:15px;line-height:20px;font-weight:700;color:#fff;box-shadow:inset 0 -1px 0 color-mix(in srgb,currentColor 12%,transparent)}
  .s-pie-pliegue summary svg{flex:none;opacity:.7;transition:transform .2s ease}
  .s-pie-pliegue[open] summary svg{transform:rotate(90deg)}
  .s-pie-pliegue .s-pie-col{padding:6px 0 10px}
  .s-pie-pliegue .s-pie-col li{padding-bottom:0}
  .s-pie-pliegue .s-pie-col a{display:inline-flex;align-items:center;min-height:36px;white-space:normal}
  .s-pie-pliegue .s-pie-h2{margin:10px 0 4px}
  /* El lugar del WhatsApp que flota (./WhatsappFlotante.tsx, 52 px a 16 del borde): al final de la página tapaba la estrella. */
  .s-pie-base{order:4;padding-top:16px;padding-right:60px}
}
@media (prefers-reduced-motion:reduce){.s-pie-pliegue summary svg{transition:none}}
`;

// ─────────────────────────────────────────────────────────────────────────────
// «MaKo reemplaza apps que ya estás pagando»: la tira de logos y la cuenta (./LoQuePagas.tsx), en la portada y en Comparaciones
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_REEMPLAZA = `
/* La tira de logos: el rótulo 14/20 700 en mayúsculas espaciado 1.12, a 24 la fila que se desliza (85 s), con los bordes fundidos. */
.s-tira{padding-bottom:32px}
.s-tira-r{text-align:center;font-size:14px;line-height:20px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin-bottom:24px;padding:0 16px}
.s-tira-v{overflow:hidden;-webkit-mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(to right,transparent,#000 12%,#000 88%,transparent)}
.s-tira-p{display:flex;width:max-content;animation:s-desliza 85s linear infinite}
.s-tira-l{display:flex;align-items:center;gap:48px;padding-right:48px}
.s-tira-i{display:flex;align-items:center;gap:10px;height:48px;font-size:24px;line-height:28px;font-weight:800;letter-spacing:-.02em;color:#fff;white-space:nowrap;opacity:.92}
/* La de las apps que MaKo reemplaza (12/11/2026): cada logo original flotando, sin recuadro (Martín: «prefiero que los logos estén
   flotando nada más»),
   más lenta porque son muchas, y el link a la comparación debajo. */
.s-tira-reemplaza{padding-top:56px;padding-bottom:48px}
.s-tira-reemplaza .s-tira-p{animation-duration:170s}
.s-tira-app img{width:34px;height:34px;flex:none;border-radius:9px;object-fit:contain}
.s-tira-ver{margin-top:20px;text-align:center;padding:0 16px}
.s-tira-ver a{display:inline-flex;align-items:center;gap:8px;font-size:16px;line-height:24px;font-weight:700;color:${DORADO_CLARO}}
.s-tira-ver a:hover{text-decoration:underline}
.s-sitio .s-tira:not(.s-tira-reemplaza){padding-top:64px}
@keyframes s-desliza{to{transform:translateX(-50%)}}

/* LO QUE PAGAS HOY (14/11/2026, Martín: «está todo muy junto y no se llega a entender muy bien de quién es el precio»): una sola
   columna, como un ticket. Cada fila, el logo, el nombre y el precio en el mismo renglón, unidos por puntos guía; las filas agrupadas
   por para qué sirven; al final el total, MaKo Pro y lo que ahorras. Las líneas y los puntos se pintan con currentColor (una sombra o
   un pseudo-elemento): el sol y la luna cambia el color del texto y no toca ni las sombras ni los pseudo-elementos, así siguen al
   texto en los dos modos (un borde oscuro, en el claro, el script lo aclaraba y desaparecía).
   Más tarde ese día (Martín, al verlo): todo junto, sin los títulos de los grupos; el titular arriba; el ahorro, un bloque azul AL
   COSTADO del ticket (dos columnas en la PC, fijo al bajar; debajo en el teléfono); la tira de logos, debajo. */
.s-ah-h{${TITULAR};max-width:1040px;margin:0 auto;padding:0 24px;text-align:center;font-size:44px;line-height:46px;color:#fff;text-wrap:balance}
.s-ah-afuera{padding:0 24px;margin:36px 0 0}
.s-ah-dos{max-width:1040px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:24px;align-items:stretch}
.s-ah{padding:20px 30px 26px;background:#fff;color:#12151B;border-radius:20px;text-align:left;box-shadow:0 0 0 1px color-mix(in srgb,currentColor 12%,transparent),0 28px 70px -40px rgba(0,0,0,.55)}
.s-ah ul{list-style:none;margin:0;padding:0}
.s-ah-f{display:flex;align-items:center;gap:14px;min-height:50px;margin:0;font-size:17px;line-height:24px}
.s-ah li + li{box-shadow:inset 0 1px 0 color-mix(in srgb,currentColor 9%,transparent)}
.s-ah-f img{width:32px;height:32px;flex:none;object-fit:contain;border-radius:8px}
.s-ah-n{flex:none;max-width:60%;font-weight:600}
.s-ah-guia{flex:1 1 auto;min-width:18px;align-self:stretch;position:relative;opacity:.4}
.s-ah-guia::after{content:'';position:absolute;left:0;right:0;top:calc(50% + 4px);height:4px;background-image:radial-gradient(circle,currentColor 1.15px,transparent 1.6px);background-size:8px 4px;background-repeat:repeat-x;background-position:right center}
.s-ah-p{flex:none;min-width:4.6em;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
/* El total: la raya gruesa de un ticket arriba y el número tachado. */
.s-ah-tot{margin-top:18px;padding-top:6px;box-shadow:inset 0 2px 0 currentColor;font-size:19px}
.s-ah-tot .s-ah-n{font-weight:800}
.s-ah-mk{margin-top:10px;padding:6px 12px;border-radius:12px;background:color-mix(in srgb,#2F6FED 12%,transparent);font-size:19px}
.s-ah-mk .s-ah-n{font-weight:800}
.s-ah-mk .s-ah-p{font-size:24px;font-weight:800;color:#2F6FED}
.s-ah-tot .s-ah-p{font-size:24px;font-weight:800;text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:#E11D48}
/* El ahorro: un bloque aparte, azul (fijo en los dos modos), al costado del ticket. */
.s-ah-ico{width:32px;height:32px;flex:none;border-radius:9px;display:inline-flex;align-items:center;justify-content:center}
.s-ah-gana{display:flex;flex-direction:column;justify-content:center;padding:32px 30px;border-radius:20px;background:linear-gradient(150deg,${AZUL},#1E3FA8);color:#fff;text-align:left;box-shadow:0 28px 70px -36px rgba(47,111,237,.65)}
.s-ah-gana-t{font-size:32px;line-height:37px;font-weight:800;letter-spacing:-.015em}
.s-ah-gana-mk{margin-top:18px;display:flex;align-items:center;gap:12px;font-size:17px;line-height:24px}
.s-ah-gana-n{margin-top:22px;padding-top:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.28);font-size:18px;line-height:30px}
.s-ah-gana-n strong{font-size:26px;font-weight:800;color:#FDE68A}
/* La tira va ARRIBA del titular (16/11/2026, Martín: «que el carrusel… esté arriba de el título»): el aire que la separaba del ticket
   (56 arriba del rótulo) pasa a separarla del titular. */
.s-tira-reemplaza > .s-ah-h{margin-top:48px}
.s-tira-reemplaza > .s-tira-ver{margin-top:28px}
/* En Comparaciones (la página clara, donde la sección abre la página): blanca, con la letra en tinta. */
.s-reemplaza-claro{background:#fff;padding:64px 0 72px}
.s-reemplaza-claro .s-ah-h,.s-reemplaza-claro .s-tira-r,.s-reemplaza-claro .s-tira-i{color:${TINTA}}
.s-reemplaza-claro .s-ah{box-shadow:0 0 0 1px color-mix(in srgb,currentColor 14%,transparent),0 24px 60px -36px rgba(6,4,25,.35)}
@media (prefers-reduced-motion:reduce){
  .s-tira-p{animation:none;width:auto}
  .s-tira-l{flex-wrap:wrap;justify-content:center;gap:16px 40px;padding:0 24px}
  .s-tira-l[aria-hidden]{display:none}
}
@media (max-width:860px){
  .s-ah-dos{grid-template-columns:minmax(0,1fr);max-width:600px}
  .s-ah-gana{position:static}
}
@media (max-width:767px){
  .s-tira-r{font-size:12px;line-height:16px}
  .s-tira-i{font-size:20px;line-height:24px;height:40px}
  .s-ah-h{font-size:32px;line-height:35px;padding:0 16px}
  .s-ah-afuera{padding:0 16px;margin-top:24px}
  .s-ah-dos{gap:16px}
  .s-ah{padding:12px 18px 20px;border-radius:16px}
  .s-ah-f{gap:10px;min-height:46px;font-size:16px}
  .s-ah-f img,.s-ah-ico{width:28px;height:28px;border-radius:7px}
  .s-ah-tot{font-size:17px}
  .s-ah-tot .s-ah-p{font-size:20px}
  .s-ah-gana{padding:22px 20px;border-radius:16px}
  .s-ah-gana-t{font-size:25px;line-height:30px}
  .s-ah-gana-n strong{font-size:22px}
  .s-tira-reemplaza > .s-ah-h{margin-top:32px}
  .s-reemplaza-claro{padding:40px 0 48px}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// La portada (/vsl/sitio)
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_PORTADA = `
/* El hero: 96 arriba y abajo; dos columnas de 576 con 32 de separación; el titular 60/60 en mayúsculas con el último renglón en
   degradado, la bajada 20/28 en 512 px, los dos botones de 50 separados 12, la nota 14/20 #B8B8C8 y el visual de 634 × 475. */
.s-hero{position:relative;padding:96px 0}
/* El héroe con la MISMA disposición que las filas de abajo (Martín, 16/11/2026: «el recuadro del VSL… debería estar también del
   mismo tamaño que los bloques de las animaciones»): 5 y 7, 72 de aire, y el video en 16/10. */
.s-hero-in{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:72px;align-items:center}
/* El VSL de Martín en el lugar de la composición de beehiiv (12/11/2026): 16:9, con el halo azul de su composición. */
.s-hero-vsl{position:relative}
.s-hero-vsl::before{content:'';position:absolute;inset:-8% -8% -4%;background:radial-gradient(closest-side,rgba(47,111,237,.32),rgba(47,111,237,0));filter:blur(24px);pointer-events:none}
.s-hero-vsl .mk-vsl-slot{position:relative;width:100%;aspect-ratio:16/10}
.s-hero-vsl .mk-vsl{position:absolute;inset:0;border-radius:16px;overflow:hidden;background:#0B0D12;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 70px -32px rgba(0,0,0,.7)}
.s-hero-vsl .mk-vsl iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}
.s-hero-vsl .mk-cor,.s-hero-vsl .mk-vsl-x{display:none}
.s-hero-tx{container-type:inline-size;min-width:0}
/* En el modo claro (el sol y la luna pone data-sitio-modo en <html>), el dorado del título más oscuro: el claro no se lee sobre blanco. */
html[data-sitio-modo="claro"] .s-h1 em{background:linear-gradient(to right,#B87A06,#DE9410);-webkit-background-clip:text;background-clip:text}
.s-h1{${TITULAR};font-size:min(60px,9.2cqi);line-height:1;color:#fff}
.s-h1 em{font-style:normal;background:linear-gradient(to right,${DORADO_CLARO},${DORADO});-webkit-background-clip:text;background-clip:text;color:transparent}
.s-hero-p{margin-top:16px;max-width:512px;font-size:20px;line-height:28px;font-weight:500;color:${TEXTO}}
.s-hero-p strong{font-weight:700;color:#fff}
.s-hero-btns{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
.s-nota{margin-top:16px;font-size:14px;line-height:20px;color:${NOTA}}
/* Su imagen: tres pantallas oscuras superpuestas (#0D0B28, filete blanco al 12 %, radio 8, su título 15/20 600 con filete abajo),
   atrás a la izquierda, al centro y adelante a la derecha, con el halo detrás y fundidas abajo. */
.s-hero-vis{position:relative;height:470px;-webkit-mask-image:linear-gradient(to bottom,#000 70%,transparent 98%);mask-image:linear-gradient(to bottom,#000 70%,transparent 98%)}
.s-hero-vis::before{content:'';position:absolute;inset:-6% -10% 0;background:radial-gradient(closest-side,rgba(47,111,237,.30),rgba(47,111,237,0));filter:blur(24px);pointer-events:none}
.s-hv{position:absolute;background:${CARD};border:1px solid rgba(255,255,255,.12);border-radius:8px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.s-hv-t{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.12);font-size:15px;line-height:20px;font-weight:600;color:#fff}
.s-hv-c{padding:12px;overflow:hidden}
.s-hv-c .s-panel{border-radius:6px}
.s-hv-a{left:-8px;top:118px;width:282px;z-index:1}
.s-hv-a .s-hv-c{height:300px}
.s-hv-b{left:116px;top:0;width:444px;z-index:2}
.s-hv-b .s-hv-c{height:310px}
.s-hv-c2{left:228px;top:150px;width:372px;z-index:3}
.s-hv-c2 .s-hv-c{height:300px}
.s-panel{position:relative;background:#fff;border-radius:12px;overflow:hidden;color:#12151B}
.s-panel svg{display:block;max-width:100%;height:auto}

${CSS_REEMPLAZA}

/* Las secciones: 96 arriba y abajo. La cabecera: el rótulo 14/20 de color, el título 48/48 a 8 px; a la derecha el texto 20/28 y,
   a 24, el botón, alineados abajo. */
.s-sec{padding:96px 0}
.s-rotulo{font-size:14px;line-height:20px;font-weight:500;color:${DORADO}}
.s-h2{${TITULAR};font-size:48px;line-height:48px;color:#fff;margin-top:8px}
.s-lede{font-size:20px;line-height:28px;font-weight:500;color:#fff}
.s-cab{display:grid;grid-template-columns:569px 557px;justify-content:space-between;align-items:end}
.s-cab-der{display:flex;flex-direction:column;align-items:flex-start;gap:24px}
.s-centro{display:flex;flex-direction:column;align-items:center;text-align:center}
.s-centro .s-h2{max-width:1000px}
.s-centro .s-lede{margin-top:12px;max-width:770px}
.s-centro .s-btn,.s-centro .s-btn-sec{margin-top:24px}

/* «Everything you need…»: filas de 2 a 1 y de 1 a 2, 24 de separación, 606 de alto; tarjetas #0D0B28 con filete al 6 %, radio 12,
   24 de aire; título 24/32 700, texto 18/28 500, el link 18/28 500 de color; la captura corrida y cortada por la tarjeta. */
.s-bento{margin-top:64px;display:flex;flex-direction:column;gap:24px}
.s-fila{display:flex;gap:24px}
.s-fila > :nth-child(1){flex:2 1 0;min-width:0}
.s-fila > :nth-child(2){flex:1 1 0;min-width:0}
.s-fila-inv > :nth-child(1){flex:1 1 0}
.s-fila-inv > :nth-child(2){flex:2 1 0}
.s-card{position:relative;overflow:hidden;min-height:606px;background:radial-gradient(60% 55% at 92% 18%,rgba(47,111,237,.30),rgba(47,111,237,0) 70%),radial-gradient(55% 60% at 0% 100%,rgba(47,111,237,.36),rgba(47,111,237,0) 70%),${CARD};border:1px solid ${LINEA};border-radius:12px;padding:24px;transition:border-color .2s}
/* Su «+»: cuadro de 44 #1C1940 radio 6, el ícono de 24 en el color de acento. */
.s-card-mas{position:absolute;top:24px;right:24px;z-index:3;width:44px;height:44px;border-radius:6px;background:${SUBCARD};color:${DORADO};display:flex;align-items:center;justify-content:center;transition:background-color .15s}
.s-card-mas:hover{background:#25224F}
.s-card:hover{border-color:rgba(255,255,255,.14)}
.s-card-tx{position:relative;z-index:2;display:flex;flex-direction:column;gap:8px;max-width:520px;padding-right:60px}
.s-card-t{font-size:24px;line-height:32px;font-weight:700;color:#fff}
.s-card-p{font-size:18px;line-height:28px;font-weight:500;color:${TEXTO}}
.s-card-a{margin-top:8px;display:inline-flex;align-items:center;gap:6px;width:fit-content;font-size:18px;line-height:28px;font-weight:500;color:${DORADO}}
.s-card-a svg{transition:transform .15s}
.s-card-a:hover svg{transform:translateX(3px)}
.s-card-vis{position:absolute;left:85px;top:204px;width:640px}
.s-card-chica .s-card-vis{left:40px;top:248px;width:520px}
/* «Todo lo que necesitas», en filas (12/11/2026): texto de un lado, la grabación del otro, intercalando. */
/* Martín (14/11/2026): «la separación entre una sección y otra tiene que ser más grande y los cuadros donde aparecen las animaciones,
   todos del mismo tamaño»: 176 de aire entre filas, y cada recuadro es 16:10 (el de las grabaciones, 960 × 600). */
.s-zz{margin-top:96px;display:flex;flex-direction:column;gap:176px}
.s-zz-fila{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:72px;align-items:center}
.s-zz-inv{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
.s-zz-inv .s-zz-tx{order:2}
.s-zz-r{font-size:14px;line-height:20px;font-weight:600;color:${DORADO}}
.s-zz-t{margin-top:8px;font-size:36px;line-height:42px;font-weight:700;letter-spacing:-.01em;color:#fff}
.s-zz-p{margin-top:16px;font-size:18px;line-height:28px;font-weight:500;color:${TEXTO}}
/* El caso de Mauricio: la franja que corre (separa), el video y sus meses, antes / con MaKo, las fotos y el cierre. */
.s-exito{padding:0 0 96px}
.s-caso-tira{overflow:hidden;background:#2F6FED;color:#fff;padding:16px 0;margin-bottom:72px}
.s-caso-tira-p{display:flex;width:max-content;animation:s-caso-corre 38s linear infinite}
.s-caso-tira-l{list-style:none;margin:0;padding:0;display:flex}
.s-caso-tira-l li{display:flex;align-items:center;white-space:nowrap;font-size:20px;font-weight:700;letter-spacing:-.01em;padding:0 22px}
.s-caso-tira-l li::after{content:'✦';margin-left:44px;font-size:14px;opacity:.7}
@keyframes s-caso-corre{to{transform:translateX(-50%)}}
/* Todo al costado del carrusel: el título, el texto y la tarjeta del antes y el después con sus dos mitades una al lado de la otra. */
.s-caso-arriba{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:48px;align-items:center}
.s-caso-der .s-caso-h{font-size:38px}
.s-caso-der .s-caso-vs{margin-top:28px;grid-template-columns:1fr 1fr}
.s-caso-der .s-caso-lado{padding:24px 26px 26px}
.s-caso-der .s-caso-lado-n{font-size:28px;margin:8px 0 16px}
.s-caso-der .s-caso-lado li{font-size:15px;line-height:1.45}
@media (max-width:900px){.s-caso-der .s-caso-h{font-size:32px}.s-caso-der .s-caso-vs{grid-template-columns:1fr}.s-caso-der .s-caso-flecha{transform:translate(-50%,-50%) rotate(90deg)}}
.s-caso-vid{position:relative;border-radius:22px;overflow:hidden;aspect-ratio:4/5;background:#0B0A1F;box-shadow:0 30px 70px -30px rgba(0,0,0,.6)}
.s-caso-vid video{display:block;width:100%;height:100%;object-fit:cover}
/* El carrusel del video y las fotos: cada uno 4 s, con un fundido; el primero (el video) arranca a la vista. */
.s-caso-slide{position:absolute;inset:0;opacity:0;animation:s-caso-pasa 16s infinite}
.s-caso-slide:nth-child(1){animation-delay:-.6s}.s-caso-slide:nth-child(2){animation-delay:3.4s}.s-caso-slide:nth-child(3){animation-delay:7.4s}.s-caso-slide:nth-child(4){animation-delay:11.4s}
.s-caso-slide img{display:block;width:100%;height:100%;object-fit:cover}
@keyframes s-caso-pasa{0%{opacity:0}4%,25%{opacity:1}29%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.s-caso-slide{animation:none}.s-caso-slide:nth-child(1){opacity:1}}
.s-caso-badge{position:absolute;left:16px;top:16px;display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fff;background:rgba(10,13,20,.6);padding:7px 12px;border-radius:999px}
.s-caso-dot{width:8px;height:8px;border-radius:50%;background:#EF4444;box-shadow:0 0 0 4px rgba(239,68,68,.25)}
.s-caso-r{margin:0 0 14px;font-size:16px;font-weight:700;color:${DORADO}}
.s-caso-h{margin:0;font-size:44px;line-height:1.12;font-weight:700;letter-spacing:-.02em}
.s-caso-h em{font-style:normal;color:${DORADO}}
.s-caso-sub{margin:18px 0 0;font-size:19px;line-height:1.5;opacity:.82}
.s-caso-p{margin:14px 0 0;font-size:17px;line-height:1.6;opacity:.86}
.s-caso-p strong{font-weight:700;opacity:1}
/* El antes y el después: una tarjeta, dos mitades, la flecha al medio (16/11/2026). */
.s-caso-vs{position:relative;margin-top:64px;display:grid;grid-template-columns:1fr 1fr;border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:${CARD}}
.s-caso-lado{padding:34px 44px 36px}
/* La mitad de MaKo como la columna de MaKo Pro de /planes (Martín: «un degradado sutil en azul… que se diferencie, pero no que sea todo
   azul»): el degradado de .planes-compara-plan[data-destacado] (app/planes/estilo.ts) y el número en azul. */
.s-caso-lado-mako{background:linear-gradient(180deg,#EEF4FF,#FFFFFF);color:#12151B;box-shadow:inset 0 0 0 1.5px rgba(47,111,237,.35)}
.s-caso-lado-mako .s-caso-lado-n{color:#2F6FED}
.s-caso-lado-t{margin:0;font-size:13px;line-height:18px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.72}
.s-caso-lado-n{margin:10px 0 22px;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:-.02em}
.s-caso-lado-n small{display:block;margin-top:6px;font-size:15px;line-height:20px;font-weight:600;letter-spacing:0;opacity:.75}
.s-caso-lado ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.s-caso-lado li{display:flex;gap:12px;font-size:16px;line-height:1.5}
.s-caso-flecha{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1;width:52px;height:52px;border-radius:50%;background:#fff;color:#2F6FED;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(0,0,0,.28)}
.s-caso-flecha svg{display:block}
/* La ✕ y la ✓ son DIBUJOS centrados en su lienzo (app/planes/signos.ts), no la letra «✕» (Figtree no la tiene y la fuente de reemplazo
   la apoyaba medio píxel arriba) ni un SVG de 13 px en un círculo de 24 (quedaba a 5,5 px del borde y el navegador lo corría ¾ px). Lado
   par en un círculo par: el dibujo cae en píxeles enteros (Martín, 15/11/2026: «céntralo bien todo»). */
.s-caso-x{flex:none;width:24px;height:24px;border-radius:50%;background:${fondoDeSigno('no', '#F87171', 'rgba(248,113,113,.14)')};background-size:12px 12px,auto}
.s-caso-ok{flex:none;width:24px;height:24px;border-radius:50%;background:${fondoDeSigno('si', '#FFFFFF', '#2F6FED')};background-size:14px 14px,auto}
.s-caso-fotos{list-style:none;margin:40px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.s-caso-fotos img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:16px}
.s-caso-cierre{margin-top:48px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.s-caso-cierre p{margin:0;max-width:640px;font-size:22px;line-height:1.45}
@media (max-width:900px){.s-caso-arriba{grid-template-columns:1fr;gap:32px}.s-caso-vid{max-width:420px;width:100%;margin:0 auto}.s-caso-h{font-size:32px}.s-caso-vs{grid-template-columns:1fr}.s-caso-lado{padding:28px 24px}.s-caso-lado-n{font-size:28px}.s-caso-flecha{transform:translate(-50%,-50%) rotate(90deg)}.s-caso-fotos{grid-template-columns:1fr 1fr}.s-caso-fotos li:last-child{display:none}.s-caso-tira{margin-bottom:48px}.s-caso-tira-l li{font-size:16px}}
@media (prefers-reduced-motion:reduce){.s-caso-tira-p{animation:none}}
/* Cada función: su prueba gratis y, abajo, «Ver cómo funciona». */
.s-zz-acc{margin-top:24px;display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.s-zz-acc .s-zz-a{margin-top:10px}
/* «Ver cómo funciona»: un link, en azul (Martín, 13/11/2026: «no me gusta que esté en amarillo… en azul, como si fuera un link»). */
.s-zz-a{margin-top:20px;display:inline-flex;align-items:center;gap:6px;font-size:18px;line-height:28px;font-weight:500;color:#6EA8FF;text-decoration:none}
.s-zz-a:hover{text-decoration:underline;text-underline-offset:4px}
.s-zz-a svg{transition:transform .15s}
.s-zz-a:hover svg{transform:translateX(3px)}
.s-zz-vis{position:relative;border-radius:16px;overflow:hidden;border:1px solid ${LINEA};background:#fff;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.s-zz-vis > .s-panel{border-radius:0;max-height:460px;overflow:hidden}
.s-zz-vis{aspect-ratio:16/10}
.s-zz-video video{display:block;width:100%;height:100%;object-fit:cover}
/* EL SECOND BRAIN, A TODO EL ANCHO Y MÁS ALTO (16/11/2026, Martín: «me gustaría de que se vea mucho más épico»): el texto arriba,
   centrado, y el mapa debajo, del ancho del contenido (1.184 a 1440) y de hasta 680 de alto; en el teléfono, más alto que ancho
   (eran 210 px de alto a 375: el 16:10 de las otras filas). El grafo se reencuadra solo con la caja (app/vsl/_sitio/BrainVivo.tsx). */
/* El Second Brain: una fila más, del MISMO tamaño que las otras (16/11/2026, a la tarde, Martín: «todos los bloques deben ser del
   mismo tamaño… exactamente igual en relación a la disposición, los tamaños»): sin reglas de tamaño propias. */
/* Los tableros: de a uno, 2,6 s cada uno, entrando de arriba hacia abajo (como su animación de entrada en la app). */
.s-zz-tableros{background:#fff}
/* Los tableros: el recuadro es SÓLO el tablero (la pista, que se desliza); las flechas a los costados y el nombre y los puntos debajo,
   por fuera (Martín, 13/11/2026). La fila no lleva el marco de las demás visuales. */
.s-zz-vis.s-zz-tableros{background:transparent;border:0;box-shadow:none;border-radius:0;overflow:visible;aspect-ratio:auto}
/* La pista del tamaño de los demás recuadros; las flechas por fuera, en el aire de al lado (en el teléfono, abajo, con los puntos). */
.s-tab{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:12px}
.s-tab>.s-tab-fl:first-child{grid-row:1;grid-column:1;justify-self:start;margin-left:-56px}
.s-tab>.s-tab-pista{grid-row:1;grid-column:1}
.s-tab>.s-tab-fl:nth-child(3){grid-row:1;grid-column:1;justify-self:end;margin-right:-56px}
.s-tab-pista{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:16px;border:1px solid rgba(18,21,27,.12);background:#F4F3EF;box-shadow:0 30px 80px -30px rgba(0,0,0,.6);cursor:grab;outline:none;overscroll-behavior-x:contain;touch-action:pan-x pan-y}
.s-tab-pista::-webkit-scrollbar{display:none}
.s-tab-pista[data-arrastra]{cursor:grabbing;scroll-snap-type:none;user-select:none}
.s-tab-uno{flex:0 0 100%;margin:0;aspect-ratio:16/10;scroll-snap-align:start}
.s-tab-uno video{display:block;width:100%;height:100%;object-fit:cover;object-position:top;pointer-events:none}
.s-tab-fl{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer}
.s-tab-fl:hover{background:rgba(255,255,255,.08)}
.s-tab-nombre{grid-column:1/-1;margin:6px 0 0;text-align:center;font-size:15px;font-weight:700}
.s-tab-puntos{grid-column:1/-1;display:flex;justify-content:center;flex-wrap:wrap;gap:6px}
.s-tab-puntos button{width:7px;height:7px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.3);cursor:pointer}
.s-tab-puntos button[aria-current]{width:20px;border-radius:99px;background:#2F6FED}
@media (max-width:560px){.s-tab>.s-tab-fl:first-child{grid-row:4;margin-left:0}.s-tab>.s-tab-fl:nth-child(3){grid-row:4;margin-right:0}.s-tab-puntos{grid-row:4;grid-column:1;align-self:center;padding:0 44px}.s-tab-fl{width:34px;height:34px}}
/* AI Avatar: dos anuncios de verdad, cada uno con la foto de la que salió (la foto chica, montada sobre la esquina del teléfono). */
.s-zz-avatar{background:linear-gradient(135deg,#EEF4FF,#F8F5FF)}
.s-av{height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:40px;padding:22px 24px 16px}
.s-av-par{margin:0;position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.s-av-tel{position:relative;display:block;height:calc(100% - 34px);width:auto;aspect-ratio:9/16;border-radius:24px;overflow:hidden;background:#12151B;box-shadow:0 0 0 6px #12151B,0 24px 50px rgba(18,21,27,.3)}
.s-av-tel video{display:block;width:100%;height:100%;object-fit:cover}
.s-av-foto{position:absolute;left:-34px;top:26px;z-index:2;width:78px;aspect-ratio:4/5;border-radius:12px;overflow:hidden;border:3px solid #fff;box-shadow:0 10px 24px rgba(18,21,27,.28);transform:rotate(-6deg)}
.s-av-foto img{display:block;width:100%;height:100%;object-fit:cover}
.s-av-foto small{position:absolute;left:0;right:0;bottom:0;padding:3px 0;text-align:center;font-size:9px;line-height:1.15;font-weight:700;color:#fff;background:rgba(18,21,27,.6)}
.s-av-par figcaption{font-size:14px;font-weight:700;color:inherit;opacity:.85}
.s-av-son{position:absolute;right:10px;bottom:10px;width:36px;height:36px;border-radius:50%;border:0;display:grid;place-items:center;color:#fff;background:rgba(18,21,27,.62);cursor:pointer}
.s-av-son:hover{background:rgba(18,21,27,.8)}
.s-av-son .s-av-on{display:none}.s-av-son[aria-pressed="true"] .s-av-on{display:inline}.s-av-son[aria-pressed="true"] .s-av-off{display:none}
@media (max-width:560px){.s-av{gap:26px;padding:12px 14px 10px 30px}.s-av-tel{border-radius:16px}.s-av-foto{width:56px;left:-24px;top:18px}.s-av-son{width:30px;height:30px;right:7px;bottom:7px}}
/* El recuadro de «Aquí falta la animación» va sin el marco blanco: el suyo es el borde punteado. */
.s-zz-falta{border:0;background:transparent;box-shadow:none;overflow:visible}
/* Los referentes: una pared que sube sola, sin texto, y vuelve a empezar sin corte (la lista va dos veces). */
.s-zz-gurus{height:440px}
.s-gurus{height:100%;overflow:hidden;padding:0 16px;background:#fff}
.s-gurus-ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;animation:s-gurus-sube 60s linear infinite}
.s-gurus-ul img{display:block;width:100%;height:auto;aspect-ratio:1;border-radius:12px;object-fit:cover;background:#F1F4F9}
@keyframes s-gurus-sube{from{transform:translateY(0)}to{transform:translateY(calc(-50% - 6px))}}
@media (prefers-reduced-motion:reduce){.s-gurus-ul{animation:none}}

/* El caso, con el tratamiento de sus tarjetas de clientes: la de la persona (foto a todo el alto, el nombre abajo) y las de cifra
   (#0D0B28, radio 12, el número 64/68 abajo y su renglón). */
.s-casos{margin-top:64px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.s-caso{position:relative;overflow:hidden;height:425px;border-radius:12px;background:${CARD}}
.s-caso-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:30% 50%}
.s-caso-velo{position:absolute;inset:auto 0 0 0;padding:16px;background:linear-gradient(to top,rgba(6,4,25,.92),rgba(6,4,25,0))}
.s-caso-n{font-size:20px;line-height:28px;font-weight:700;color:#fff}
.s-caso-r{font-size:16px;line-height:24px;font-weight:500;color:${GRIS2}}
.s-caso-cifra{display:flex;flex-direction:column;justify-content:flex-end;padding:32px 24px}
.s-caso-num{${TITULAR};font-size:64px;line-height:68px;color:#9DBBF8}
.s-caso-txt{margin-top:8px;font-size:16px;line-height:24px;font-weight:500;color:${GRIS}}

/* «Build your way»: el botón de borde (18/28 700, #100E22, filete al 20 %, radio 8) y las tarjetas blancas (radio 12, 24 × 20 × 20,
   16 entre piezas): el nombre 24/32, la bajada 14/20 #4E4E6C, el precio 48/48, el botón de 46, el filete #D6D6E0 y la lista 14/20. */
.s-btn-sec{display:inline-flex;align-items:center;gap:8px;padding:8px 24px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:#100E22;font-size:18px;line-height:28px;font-weight:700;color:#fff;transition:background-color .15s}
.s-btn-sec:hover{background:#1A1836}
/* Los precios sobre franja clara, con los bloques de /planes (app/planes/Tarjetas.tsx). */
.s-precios{background:#F6F8FC;color:#12151B}
.s-precios .s-rotulo{color:#2F6FED}
.s-precios .s-h2,.s-precios .s-lede{color:#12151B}
.s-precios .s-lede{color:#4A5260}
/* LAS COLUMNAS DE /planes, TAL CUAL (Martín, 15/11/2026: «en la landing principal se tiene que repetir exactamente lo mismo que en
   precios… tiene que ser exactamente lo mismo»): las arma ./ColumnasPlanes.tsx con las props de /planes, y acá van con la LETRA, el
   ANCHO y el MARGEN de /planes (app/planes/estilo.ts: .planes-root, 16/1.55 en Urbanist, que el sitio declara «Geist»; y
   .planes-wrap.planes-ancho, 1.060 px, con 16 a los costados). Eran Figtree 16/24, 1.120 px y 20 a los costados en el teléfono. */
.s-precios .s-cont{padding-left:16px;padding-right:16px}
.s-precios-bloques{margin:48px auto 0;max-width:1060px;color:#121212;font:400 16px/1.55 'Geist',ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
/* LO QUE LA BARRA DE MaKo TOKENS REESCRIBE, LEGIBLE EN EL MODO OSCURO (16/11/2026). La portada nace oscura y desde el 15/11 lleva la
   barra: su script (app/planes/CalculadoraTokens.tsx) reescribe con innerHTML el «+N MaKo Tokens extras al mes» y lo que alcanza en
   cada columna, y los <b> nuevos nacen SIN el color que el sol y la luna les puso a los de la primera pantalla: quedaban #12151B sobre
   la columna oscura (medido con la barra a la mitad: rgb(18,21,27), el número sin leerse). Acá, el color al que el sol y la luna lleva
   ese #12151B en el oscuro (el de «32.000 MaKo Tokens al mes», que sí persiste). El renglón tachado sigue rojo. En /planes pasa lo
   mismo en el oscuro: el arreglo de fondo es de CalculadoraTokens (CSS_TOKENS y CSS_TARJETAS), y entonces esta regla sobra. */
html[data-sitio-modo="oscuro"] .s-precios .tk-extra b,html[data-sitio-modo="oscuro"] .s-precios .mkpl-alcanza li:not(.mkpl-alcanza-sin) b{color:rgb(228,231,237)}
.s-precios .s-btn-sec{background:#fff;color:#12151B;border-color:#D5DBE6}
.s-planes{margin-top:64px;display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,384px));justify-content:center;gap:16px}
.s-plan{display:flex;flex-direction:column;gap:16px;background:#fff;color:${TINTA};border-radius:12px;padding:24px 20px 20px}
.s-plan-dest{box-shadow:0 0 0 2px ${DORADO}}
.s-plan-top{display:flex;flex-direction:column;gap:6px}
.s-plan-nom{display:flex;align-items:center;justify-content:space-between;gap:8px}
.s-plan-h{font-size:24px;line-height:32px;font-weight:700;color:${TINTA}}
.s-plan-chip{font-size:12px;line-height:16px;font-weight:500;color:#fff;background:${TINTA};border-radius:9999px;padding:2px 8px 4px;white-space:nowrap}
.s-plan-res{font-size:14px;line-height:20px;font-weight:500;color:${GRIS_CLARO2}}
.s-plan-pr{display:flex;align-items:baseline;gap:6px;margin-top:8px}
.s-plan-num{font-size:48px;line-height:48px;font-weight:700;color:${TINTA};letter-spacing:-.01em}
.s-plan-mes{font-size:18px;line-height:24px;font-weight:500;color:${TINTA}}
.s-plan-sub{font-size:12px;line-height:16px;font-weight:500;color:${GRIS_CLARO2}}
.s-plan-btn{display:flex;align-items:center;justify-content:center;padding:8px 24px;border-radius:6px;border:1px solid ${AZUL};background:#fff;color:${AZUL};font-size:18px;line-height:28px;font-weight:700;text-align:center;transition:background-color .15s,color .15s}
.s-plan-btn:hover{background:#EEF3FE}
.s-plan-dest .s-plan-btn{background:${AZUL};color:#fff}
.s-plan-dest .s-plan-btn:hover{background:#1F57C8;border-color:#1F57C8}
.s-plan-hr{height:1px;background:#D6D6E0}
.s-plan-ul{display:flex;flex-direction:column;gap:6px}
.s-plan-ul li{font-size:14px;line-height:20px;font-weight:500;color:${GRIS_CLARO2}}
.s-plan-ul li:first-child{font-weight:700;color:${TINTA}}

/* «The numbers tell the story»: el título centrado y cuatro tarjetas de 281 (20 de separación), #0D0B28, filete al 6 %, radio 8,
   32 × 28 de aire; el número 64/66 en mayúsculas del color de acento y, 64 más abajo, su renglón 18/28. */
.s-nums{margin-top:64px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}
.s-num{display:flex;flex-direction:column;gap:64px;background:${CARD};border:1px solid ${LINEA};border-radius:8px;padding:32px 28px}
.s-num-v{${TITULAR};font-size:64px;line-height:66px;color:${DORADO}}
.s-num-t{font-size:18px;line-height:28px;font-weight:500;color:#fff}

/* «Powerful integrations»: el título de 576 con su texto a 16, el botón a la derecha, y a 64 dos filas de logos que se cortan
   en los bordes. */
.s-int-cab{display:grid;grid-template-columns:576px auto;justify-content:space-between;align-items:end;gap:32px}
.s-int-cab .s-h2{margin-top:0}
.s-int-cab .s-lede{margin-top:16px}
.s-int-filas{margin-top:64px;display:flex;flex-direction:column;gap:14px;overflow:hidden;position:relative;-webkit-mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)}
.s-int-pista{display:flex;width:max-content;animation:s-int-corre 48s linear infinite}
.s-int-pista-inv{animation-direction:reverse}
@keyframes s-int-corre{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.s-int-pista{animation:none}}
.s-int-f{list-style:none;margin:0;padding:0 7px;display:flex;gap:14px}
.s-int-t{flex:none;position:relative;width:68px;height:68px;border-radius:14px;background:${CARD};border:1px solid ${LINEA};display:flex;align-items:center;justify-content:center}
/* En el teléfono, el mismo carrusel con los íconos más chicos. */
@media (max-width:767px){.s-int-filas{margin-top:32px}.s-int-t{width:52px;height:52px;border-radius:12px}}

/* «Have a question?»: el título en 352 y las preguntas en 768 desde x = 544, con su filete de 2 px #4E4E6C. */
.s-faq-in{display:grid;grid-template-columns:352px 768px;justify-content:space-between;align-items:start}
.s-faq-in .s-h2{margin-top:0}
.s-q summary{display:flex;align-items:center;justify-content:space-between;padding:24px 16px;border-top:2px solid #4E4E6C;cursor:pointer;font-size:18px;line-height:28px;font-weight:500}
.s-faq-l{border-bottom:2px solid #4E4E6C}
.s-q h3{padding-right:8px;font-size:20px;line-height:28px;font-weight:600;color:#fff}
.s-q summary svg{flex:none;color:#fff;transition:transform .3s cubic-bezier(.4,0,.2,1)}
.s-q[open] summary svg{transform:rotate(180deg)}
.s-q p{padding:0 16px 24px;font-size:20px;line-height:28px;font-weight:500;color:${TEXTO}}

/* La caja del cierre: 64 arriba y abajo; 1184 × 312, #0D0B28 con filete del color de marca al 50 %, radio 12 y su brillo. */
.s-cierre{padding:64px 0}
.s-cierre-caja{position:relative;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;align-items:center;text-align:center;padding:96px 24px;background:${CARD};border:1px solid rgba(47,111,237,.5);border-radius:12px}
.s-cierre-caja::before{content:'';position:absolute;z-index:-1;inset:0;background:radial-gradient(60% 90% at 18% 70%,rgba(47,111,237,.38),rgba(47,111,237,0)),radial-gradient(40% 70% at 85% 20%,rgba(242,176,30,.10),rgba(242,176,30,0))}
.s-cierre-caja .s-h2{margin-top:0;max-width:1000px}
.s-cierre-caja .s-btn{margin-top:24px}

@media (prefers-reduced-motion:reduce){
  .s-card-a svg,.s-q summary svg{transition:none}
}
@media (max-width:1279px){
  .s-cab{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px}
  .s-int-cab{grid-template-columns:minmax(0,1fr) auto}
  .s-faq-in{grid-template-columns:minmax(0,1fr) minmax(0,2.2fr);gap:48px}
  /* Con 32 a los lados la columna del hero no llega a los 600 de la composición: se achica para no cortarse en el borde. */
  .s-hero-vis{zoom:.8}
  .s-card-vis{left:48px;width:min(640px,calc(100% - 48px))}
  .s-card-chica .s-card-vis{left:32px;width:min(520px,calc(100% - 32px))}
}
@media (max-width:1023px){
  .s-casos,.s-nums{grid-template-columns:repeat(2,minmax(0,1fr))}
  .s-planes{grid-template-columns:minmax(0,520px)}
}
/* Como su hero, que pasa a una columna debajo de 890 px. */
@media (max-width:889px){
  .s-hero-in{grid-template-columns:minmax(0,1fr)}
  .s-hero-vsl{margin-top:32px}
  .s-hero-vis{width:576px;max-width:none;margin:40px auto 0}
  .s-fila{flex-direction:column}
  .s-zz{gap:112px;margin-top:56px}
  .s-zz-fila,.s-zz-inv{grid-template-columns:minmax(0,1fr);gap:28px}
  .s-zz-inv .s-zz-tx{order:0}
  .s-zz-t{font-size:28px;line-height:34px}
  .s-zz-gurus{height:340px}
  .s-bento .s-fila > :nth-child(n){flex:none}
  /* El Brain en el teléfono: más alto que ancho, para que el mapa no quede en una tira. */
}
/* A 390: 40 de aire en cada sección, 20 a los lados, titulares 42/44 y 36/40, todo en una columna. */
@media (max-width:767px){
  .s-cont{padding:0 20px}
  .s-hero{padding:40px 0}
  .s-h1{font-size:min(42px,9.2cqi);line-height:1.04}
  .s-hero-p{margin-top:8px;max-width:none}
  .s-hero-btns{margin-top:24px;flex-direction:column;gap:16px}
  .s-hero-btns .s-btn,.s-hero-btns .s-btn-t{width:100%}
  .s-hero-vis{margin-top:32px;zoom:.6}
  .s-btn-t{font-size:16px;line-height:24px}
  .s-btn-alto .s-btn-t{padding:10px 24px}
  .s-sec{padding:40px 0}
  /* Las secciones a las que llevan «Recursos» e «Industrias → Casos» (/#integraciones, /#preguntas, /#caso, y #precios), DEBAJO de la
     barra fija (16/11/2026): acá la sección tiene 40 px de aire y la barra mide 57, y el título quedaba cortado bajo ella (medido a
     390: «TUS APPS,» arrancaba en y = 40). En la computadora el aire (96) ya es más que la barra (77). */
  .s-sec[id]{scroll-margin-top:57px}
  .s-h2{font-size:36px;line-height:40px}
  .s-lede{font-size:18px;line-height:28px}
  .s-cab,.s-int-cab{grid-template-columns:minmax(0,1fr);gap:24px}
  /* A 390 (su portada con «Everything you need…»): las tarjetas una debajo de otra, 20/28 el título y 16/24 el texto y el
     link, sin el «+», con la captura cortada por el borde derecho. */
  .s-bento{margin-top:40px;gap:16px}
  .s-card{min-height:0;padding:24px 24px 0}
  .s-card-tx{padding-right:0}
  .s-card-t{font-size:20px;line-height:28px}
  .s-card-p,.s-card-a{font-size:16px;line-height:24px}
  .s-card-mas{display:none}
  .s-card-vis,.s-card-chica .s-card-vis{position:relative;left:auto;top:auto;width:auto;margin:32px -24px 0 0}
  .s-card-vis .s-panel{border-radius:12px 0 0 0}
  /* A 390 sus tarjetas de clientes son una fila de 220 × 300 que se corta en el borde: aquí se corre con el dedo. */
  .s-casos{margin:40px -20px 0;padding:0 20px;display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory}
  .s-caso{flex:none;width:220px;height:300px;scroll-snap-align:start}
  .s-caso-cifra{padding:20px 16px}
  .s-caso-num{font-size:36px;line-height:40px}
  .s-btn-sec{font-size:16px;line-height:24px}
  .s-planes{margin-top:40px;grid-template-columns:minmax(0,1fr)}
  .s-nums{margin-top:40px;grid-template-columns:minmax(0,1fr);gap:20px}
  .s-num{gap:24px;padding:20px 16px}
  .s-num-v{font-size:42px;line-height:44px}
  .s-int-cab .s-btn,.s-int-cab .s-btn-t{width:100%}
  .s-int-filas{margin-top:40px;gap:12px}
  .s-int-f{gap:12px}
  /* (Acá iba la segunda fila corrida 34 px, de cuando las filas eran fijas: en el carrusel empujaba la copia y dejaba un hueco en la unión. 14/11) */
  .s-int-t{width:56px;height:56px;border-radius:12px}
  .s-faq-in{grid-template-columns:minmax(0,1fr);gap:48px}
  .s-cierre{padding:40px 0}
  .s-cierre-caja{padding:64px 24px}
  .s-cierre-caja .s-btn,.s-cierre-caja .s-btn-t{width:100%}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Comparaciones (/vsl/comparaciones), la página clara
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_COMPARACIONES = `
/* Las apps de cada fila, con su logo original sobre un recuadro blanco (12/11/2026: de 8 apps a todas). */
.s-apps{display:flex;flex-wrap:wrap;gap:8px 14px}
.s-app{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.s-app img{width:22px;height:22px;border-radius:6px;object-fit:contain}
/* Su hero: el fondo lavanda con la trama de puntos, 80 + 64 de aire; el logo de 160 en su marco, el titular 64/66, el texto 24/32
   en 768 y el botón con su flecha, separados 24. */
.s-ch{background-color:${AZUL_TINTE};background-image:radial-gradient(rgba(6,4,25,.13) 1px,transparent 1.4px);background-size:12px 12px;padding:144px 24px;text-align:center}
.s-ch-logo{width:160px;height:160px;margin:0 auto;border-radius:28px;border:2px dashed rgba(47,111,237,.35);display:flex;align-items:center;justify-content:center}
.s-ch-logo-in{width:134px;height:134px;border-radius:22px;background:#fff;border:3px solid ${AZUL};display:flex;align-items:center;justify-content:center}
.s-ch-logo-c{width:108px;height:108px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.s-ch-h1{${TITULAR};margin-top:24px;font-size:64px;line-height:66px;color:${TINTA}}
.s-ch-p{margin:16px auto 0;max-width:768px;font-size:24px;line-height:32px;font-weight:500;color:${TINTA}}
.s-ch .s-btn{margin-top:24px}

/* «Compare pricing and features»: #F3F4F6, 80 de aire; el título 48/48, el texto 24/32 a 24; la caja blanca de filete 2 px
   #060419 y radio 10 a 64, con su tabla: la cabecera de 154, los encabezados de grupo 20/28 600 sobre el tinte al 50 %, las filas
   de 57 con su filete #CECFD4, la primera columna de 288 sobre el tinte claro y el tilde en su círculo de 32. */
.s-cc{background:#F3F4F6;padding:80px 0}
.s-cc-h2{${TITULAR};font-size:48px;line-height:48px;color:${TINTA}}
.s-cc-p{margin-top:24px;max-width:931px;font-size:24px;line-height:32px;font-weight:500;color:${TINTA}}
.s-tabla-caja{margin-top:64px;background:#fff;border:2px solid ${TINTA};border-radius:10px;padding:16px;overflow-x:auto}
.s-tabla{width:100%;border-collapse:collapse;table-layout:fixed}
.s-tabla col.s-col1{width:288px}
.s-tabla thead th{vertical-align:top;padding:16px 16px 8px;font-size:16px;line-height:24px;font-weight:400;color:${TINTA};text-align:center}
.s-tabla thead th:first-child{text-align:left}
.s-th-n{display:block;padding:16px 0 12px}
.s-th-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 32px;border-radius:6px;border:1px solid ${AZUL};background:${AZUL};color:#fff;font-size:16px;line-height:24px;font-weight:500;white-space:nowrap;transition:background-color .15s}
.s-th-btn:hover{background:#1F57C8}
.s-th-tx{display:block;margin-top:4px;font-size:14px;line-height:20px;color:${GRIS_CLARO}}
.s-tabla .s-tg td{background:rgba(213,226,251,.5);padding:8px 16px;font-size:20px;line-height:28px;font-weight:600;color:${TINTA}}
.s-tabla .s-tf td{padding:16px;font-size:16px;line-height:24px;font-weight:400;color:${TINTA};text-align:center;vertical-align:middle;border-bottom:1px solid #CECFD4}
.s-tabla .s-tf:last-child td,.s-tabla .s-tf-ult td{border-bottom:0}
.s-tabla .s-tf td:first-child{background:${AZUL_CELDA};font-weight:500;text-align:left}
.s-tabla .s-tf td:nth-child(3){background:${AZUL_CELDA}}
.s-tabla .s-tf:target td{background:#FFF6DB}
.s-tilde{display:inline-flex;align-items:center;gap:10px;font-weight:500}
.s-tilde-c{flex:none;width:32px;height:32px;border-radius:9999px;background:${AZUL_TINTE};color:${AZUL};display:inline-flex;align-items:center;justify-content:center}

/* LA TABLA CONTRA LA COMPETENCIA (14/11/2026, la de beehiiv): una caja que se desliza hacia los costados y hacia abajo, con la
   cabecera (logos y botones) fija arriba y las columnas de la función y de MaKo fijas a la izquierda; ✓ en su círculo, la celda
   vacía si no lo tiene, el valor corto centrado. La cebra va por COLUMNA (MaKo teñida). Las flechas pasan de a tres apps. */
.s-mx{margin-top:48px;position:relative}
/* 14/11/2026, noche (Martín): ni scroll de costado ni barras: la tabla va entera a lo alto de la página (overflow: clip no hace una caja
   con scroll, así la cabecera queda fija contra la página) y las flechas muestran la página siguiente de apps, siempre enteras (el
   script: --mx-col y data-c). Sin JavaScript, las primeras cuatro. */
.s-mx-caja{overflow:clip;background:#fff;border:2px solid ${TINTA};border-radius:10px}
.s-mx:not([data-listo]):not([data-una]) [data-c]:nth-child(n+7){display:none}
/* Martín, 14/11/2026: «al pasar de página con la flechita tiene que verse una animación de desplazamiento… si no, no se entiende».
   Las columnas de las apps están todas puestas y se DESLIZAN: cada celda se corre --mx-x (lo pone el script: la página por el ancho
   de una columna) en 300 ms; las de afuera las recorta la caja (clip: sin barra ni scroll de costado) y pasan por debajo de las dos
   columnas fijas, que están encima (z-index) y son opacas. data-quieto: al medir (al abrir o al cambiar el ancho) no se anima. */
.s-mx:not([data-una]) [data-c]{transform:translateX(var(--mx-x,0px));transition:transform .3s cubic-bezier(.22,.61,.36,1)}
.s-mx[data-quieto] [data-c]{transition:none}
.s-mx-caja:focus-visible{outline:3px solid ${AZUL};outline-offset:3px}
.s-mx-t{border-collapse:separate;border-spacing:0;table-layout:fixed;width:max-content;min-width:100%}
.s-mx-t th,.s-mx-t td{box-sizing:border-box}
.s-mx-t .s-mx-c0{width:240px;min-width:240px;max-width:240px;position:sticky;left:0;z-index:2;background:#F9FAFF;text-align:left}
.s-mx-t .s-mx-mk{width:164px;min-width:164px;position:sticky;left:240px;z-index:2;background:#EEF3FE;box-shadow:inset -1px 0 0 #CECFD4}
.s-mx-t thead th{position:sticky;top:var(--s-barra-alto,76px);z-index:3;background:#fff;vertical-align:top;padding:16px 12px 14px;border-bottom:1px solid #CECFD4;font-weight:400;color:${TINTA};text-align:center}
.s-mx-t thead th.s-mx-c0,.s-mx-t thead th.s-mx-mk{z-index:4}
.s-mx-t thead th.s-mx-c0{background:#F9FAFF}
.s-mx-t thead th.s-mx-mk{background:#EEF3FE}
.s-mx-t thead th.s-mx-app,.s-mx-t tbody td:not(.s-mx-mk){width:var(--mx-col,170px);min-width:var(--mx-col,170px);max-width:var(--mx-col,170px)}
.s-mx-cab{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:15px;line-height:20px}
.s-mx-cab b{font-weight:600}
.s-mx-logo{width:36px;height:36px;border-radius:9px;object-fit:contain}
.s-mx-estrella{width:36px;height:36px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center}
.s-mx-btn{display:inline-flex;align-items:center;justify-content:center;margin-top:10px;padding:6px 12px;border-radius:6px;background:${AZUL};color:#fff;font-size:13px;line-height:18px;font-weight:600;white-space:nowrap}
.s-mx-btn2{background:#fff;color:${TINTA};box-shadow:inset 0 0 0 1.5px #CECFD4}
.s-mx-btn2:hover{box-shadow:inset 0 0 0 1.5px ${TINTA}}
.s-mx-flechas{display:flex;gap:10px;justify-content:center;padding-top:28px}
.s-mx-flechas button{width:40px;height:40px;border-radius:9999px;border:1.5px solid ${TINTA};background:#fff;color:${TINTA};font-size:24px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
.s-mx-flechas button:disabled{opacity:.3;cursor:default}
.s-mx-g th{padding:0;background:rgba(213,226,251,.55);text-align:left;border-bottom:1px solid #CECFD4}
.s-mx-g th span{position:sticky;left:0;display:inline-block;padding:10px 16px;font-size:18px;line-height:24px;font-weight:600;color:${TINTA}}
.s-mx-f th,.s-mx-f td{padding:13px 12px;border-bottom:1px solid #E4E5EA;font-size:15px;line-height:20px;color:${TINTA};text-align:center;vertical-align:middle}
.s-mx-f th{font-weight:500;text-align:left}
.s-mx-f td:nth-child(2n+3){background:#FCFCFE}
.s-mx-si{width:28px;height:28px;border-radius:9999px;background:${AZUL_TINTE};color:${AZUL};display:inline-flex;align-items:center;justify-content:center;vertical-align:middle}
.s-mx-v{font-size:14px;line-height:18px;font-weight:500}
.s-mx-nd{font-size:12px;line-height:16px;color:${GRIS_CLARO}}
.s-mx[data-una] .s-mx-caja{max-height:none;overflow:visible}
.s-mx[data-una] .s-mx-t{width:100%}
.s-mx[data-una] .s-mx-t .s-mx-mk,.s-mx[data-una] .s-mx-t .s-mx-app{width:auto}
.s-mx-otras{margin-top:24px;font-size:18px;line-height:28px;font-weight:500}
.s-mx-otras a{display:inline-flex;align-items:center;gap:8px;color:${AZUL}}

/* La página «MaKo vs X»: los dos logos en el hero, «Elige X si / Elige MaKo si» y el comentario arriba de la tabla. */
.s-ch-vs{display:flex;align-items:center;justify-content:center;gap:20px}
.s-ch-vs-mk{width:96px;height:96px;border-radius:22px}
.s-ch-vs-x{font-size:22px;font-weight:700;color:${GRIS_CLARO}}
.s-ch-vs-app{width:96px;height:96px;border-radius:22px;background:#fff;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px ${TINTA}}
.s-ch-vs-app .s-mx-logo{box-shadow:none}
.s-el{background:#fff;padding:80px 0}
.s-el-dos{display:grid;grid-template-columns:1fr 1fr;gap:32px}
.s-el-col{border:2px solid ${TINTA};border-radius:10px;padding:32px}
.s-el-mk{background:${AZUL_TINTE}}
.s-el-h{${TITULAR};font-size:32px;line-height:36px;color:${TINTA}}
.s-el-col ul{margin:24px 0 0;padding:0;list-style:none;display:grid;gap:14px}
.s-el-col li{display:flex;gap:12px;align-items:flex-start;font-size:18px;line-height:26px;font-weight:500;color:${TINTA}}
.s-el-col:not(.s-el-mk) li::before{content:'';flex:none;width:8px;height:8px;margin-top:9px;border-radius:9999px;background:${TINTA}}
.s-el-col .s-mx-si{flex:none;width:26px;height:26px}
.s-vs-dice{font-style:italic}
/* Las tarjetas «MaKo vs X» con los dos logos y su comentario de una línea. */
.s-vs-logos{display:flex;align-items:center;gap:10px;margin-bottom:20px}
.s-vs-mk{width:44px;height:44px;border-radius:11px}
.s-vs-x{font-size:15px;font-weight:700;color:${GRIS_CLARO}}
.s-vs-logos .s-mx-logo{width:44px;height:44px;border-radius:11px}
.s-vs-com{display:block;margin-top:8px;font-size:15.5px;line-height:23px;font-weight:500;color:#4B4A63}
@media (max-width:767px){
  .s-mx{margin-top:28px}
  .s-mx-t thead th{top:var(--s-barra-alto-tel,64px)}
  .s-mx-t .s-mx-c0{width:124px;min-width:124px;max-width:124px}
  .s-mx-t .s-mx-mk{width:88px;min-width:88px;left:124px}
  .s-mx-t thead th{padding:10px 6px}
  .s-mx-cab{font-size:12px;line-height:16px;gap:6px}
  .s-mx-logo,.s-mx-estrella{width:28px;height:28px;border-radius:7px}
  .s-mx-btn{display:none}
  .s-mx-flechas{padding-top:6px;gap:6px}
  .s-mx-flechas button{width:32px;height:32px;font-size:20px}
  .s-mx-g th span{font-size:15px;padding:8px 10px}
  .s-mx-f th,.s-mx-f td{padding:10px 6px;font-size:12.5px;line-height:17px}
  .s-mx-v{font-size:12px;line-height:16px}
  .s-mx-si{width:24px;height:24px}
  .s-el{padding:48px 0}
  .s-el-dos{grid-template-columns:minmax(0,1fr);gap:20px}
  .s-el-col{padding:22px}
  .s-el-h{font-size:24px;line-height:28px}
  .s-el-col li{font-size:16px;line-height:24px}
  .s-ch-vs-mk,.s-ch-vs-app{width:72px;height:72px;border-radius:16px}
}

/* «beehiiv vs the others»: lavanda, 160 de aire; el título 48/48 y, a 40, la grilla de tres tarjetas de 368 con 40 de separación:
   cara blanca de filete 2 px negro y radio 8, 32 de aire, título 24/32 600 y «Compare →» 20/28 500 a 32; debajo, sus dos capas
   que se separan al pasar el mouse. */
.s-cv{background:${AZUL_TINTE};padding:160px 0}
.s-cv-h2{${TITULAR};font-size:48px;line-height:48px;color:${TINTA}}
.s-cv-grilla{margin-top:40px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;grid-auto-flow:row dense}
/* 14/11/2026, noche (Martín: «mejoraría muchísimo el diseño de las tarjetas, y no quiero que tenga ese hover de esa animación rara»):
   blancas, con borde fino y sombra suave; al pasar el mouse suben 3 px y se marca el borde. */
.s-vs{position:relative;display:block;border-radius:18px;transition:transform .18s ease,box-shadow .18s ease}
.s-vs-cara{position:relative;display:flex;flex-direction:column;height:100%;box-sizing:border-box;background:#fff;border:1px solid rgba(6,4,25,.12);border-radius:18px;padding:26px 26px 22px;box-shadow:0 1px 2px rgba(6,4,25,.05),0 10px 30px -18px rgba(6,4,25,.25);transition:border-color .18s ease,box-shadow .18s ease}
.s-vs:hover{transform:translateY(-3px)}
.s-vs:hover .s-vs-cara{border-color:${AZUL};box-shadow:0 2px 4px rgba(6,4,25,.06),0 18px 40px -20px rgba(47,111,237,.45)}
.s-vs-t{display:block;font-size:22px;line-height:28px;font-weight:700;color:${TINTA}}
.s-vs-a{display:flex;align-items:center;gap:6px;margin-top:auto;padding-top:20px;font-size:16px;line-height:24px;font-weight:600;color:${AZUL}}
/* LA TARJETA ABRE SU PANEL EN EL LUGAR (Martín, 14/11/2026: llevaban a la landing principal en el visor). Sin JavaScript: la tarjeta es
   un label con su casilla adentro, y el panel es el hermano que sigue, en la grilla. El panel ocupa la fila entera (grid-column 1 / -1)
   y grid-auto-flow dense sube las tarjetas que siguen a completar la fila de la que se abrió: el panel cae justo debajo de esa fila.
   La casilla va ADENTRO del label: afuera, al tomar el foco, el navegador saltaba al principio de la grilla (la posición de un
   absoluto en una grilla es su esquina). :target abre el panel también desde un link (el «Comparar» de la tabla) sin JavaScript.
   Abierta, la tarjeta se marca con una sombra (no con el borde: el sol y la luna fija los bordes al cargar). */
.s-vs{cursor:pointer;scroll-margin-top:96px}
.s-vs-ck:focus-visible ~ .s-vs-cara{outline:3px solid ${AZUL};outline-offset:3px}
.s-vs-ck:checked ~ .s-vs-cara{box-shadow:0 0 0 2px ${AZUL},0 18px 40px -20px rgba(47,111,237,.45)}
.s-vs-ck:checked ~ .s-vs-cara .s-vs-a-ver,.s-vs-a-cerrar{display:none}
.s-vs-ck:checked ~ .s-vs-cara .s-vs-a-cerrar{display:inline}
.s-vs-a svg{transition:transform .18s ease}
.s-vs-ck:checked ~ .s-vs-cara .s-vs-a svg{transform:rotate(90deg)}
.s-vs-panel{display:none;grid-column:1/-1;scroll-margin-top:96px;background:#fff;color:${TINTA};border-radius:18px;padding:32px;box-shadow:0 0 0 2px ${AZUL},0 24px 60px -36px rgba(6,4,25,.4)}
.s-vs:has(> .s-vs-ck:checked) + .s-vs-panel,.s-vs-panel:target{display:block;animation:s-vs-abre .24s ease-out}
@keyframes s-vs-abre{from{opacity:0;transform:translateY(-6px)}}
.s-vs-pcab{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.s-vs-pcab .s-vs-logos{margin:0}
.s-vs-pt{flex:1;font-size:28px;line-height:34px;font-weight:800;color:${TINTA}}
.s-vs-cerrar{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:9999px;cursor:pointer;font-size:15px;line-height:20px;font-weight:600;color:${TINTA};box-shadow:inset 0 0 0 1.5px currentColor}
.s-vs-cerrar:hover{color:${AZUL}}
.s-vs-pdice{margin-top:16px;max-width:860px;font-size:19px;line-height:28px;font-weight:500;font-style:italic;color:#4B4A63}
.s-vs-panel .s-el-dos{margin-top:24px;gap:20px}
.s-vs-panel .s-el-col{padding:22px 24px}
.s-vs-panel .s-el-h{font-size:22px;line-height:26px}
.s-vs-panel .s-el-col ul{margin-top:16px;gap:10px}
.s-vs-panel .s-el-col li{font-size:16px;line-height:24px}
.s-vs-panel .s-mx{margin-top:28px}
.s-vs-pie{margin-top:20px;display:flex;justify-content:flex-end}

@media (prefers-reduced-motion:reduce){
  .s-vs,.s-vs-cara{transition:none}
  .s-vs:hover{transform:none}
  .s-mx:not([data-una]) [data-c]{transition:none}
  .s-vs-panel{animation:none}
}
@media (max-width:1023px){
  .s-cv-grilla{grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}
}
@media (max-width:767px){
  .s-ch{padding:64px 20px}
  .s-ch-logo{width:132px;height:132px;border-radius:24px}
  .s-ch-logo-in{width:110px;height:110px;border-radius:18px}
  .s-ch-logo-c{width:88px;height:88px;border-radius:12px}
  .s-ch-h1{font-size:40px;line-height:44px}
  .s-ch-p{font-size:20px;line-height:28px}
  .s-cc{padding:64px 0}
  .s-cc-h2{font-size:36px;line-height:40px;text-align:center}
  .s-cc-p{font-size:20px;line-height:28px;text-align:center}
  .s-tabla-caja{margin-top:40px;padding:12px 8px}
  .s-tabla col.s-col1{width:34%}
  .s-tabla thead th{padding:12px 6px 8px;font-size:14px;line-height:20px}
  .s-th-btn{padding:6px 10px;font-size:13px;line-height:18px;white-space:normal}
  .s-tabla .s-tg td{font-size:16px;line-height:24px;padding:8px}
  .s-tabla .s-tf td{padding:12px 6px;font-size:14px;line-height:20px}
  .s-tabla .s-tf td:first-child{padding-left:8px}
  .s-tilde{flex-direction:column;gap:4px}
  .s-cv{padding:64px 0}
  .s-cv-h2{font-size:36px;line-height:40px}
  .s-cv-grilla{grid-template-columns:minmax(0,1fr);gap:32px}
  .s-vs-panel{padding:20px 16px;border-radius:16px}
  .s-vs-pcab .s-vs-logos{display:none}
  .s-vs-pt{font-size:22px;line-height:28px}
  .s-vs-pdice{font-size:17px;line-height:25px}
  .s-vs-panel .s-el-col{padding:18px}
  .s-vs-panel .s-el-h{font-size:19px;line-height:24px}
}
`;
