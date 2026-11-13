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
const TITULAR = `font-family:'s-archivo','s-figtree',Arial,sans-serif;font-weight:900;font-stretch:88%;text-transform:uppercase`;

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
.s-mega-ind{display:grid;grid-template-columns:362px minmax(0,1fr) 380px;gap:48px}
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
.s-mv-grupo .s-mega-l{margin-left:0;padding:9px 0;line-height:24px}
.s-mv-pie{position:fixed;left:0;right:0;bottom:0;z-index:71;display:flex;align-items:center;gap:8px;padding:16px;background:${FONDO};border-top:1px solid ${LINEA12}}
.s-mv-pie .s-nb{justify-content:center}
.s-mv-pie .s-nb:not(.s-mv-entrar){flex:1 1 auto}
.s-mv-entrar{border-color:transparent!important;color:${GRIS}!important}
html:has(.s-mv[open]){overflow:hidden}
/* Abierto, como el suyo: arriba sólo el logo y la cruz (los botones quedan abajo). */
.s-barra-der:has(.s-mv[open])>.s-nb-lleno{display:none}

/* La barra clara (la de su página de comparaciones): blanca, filete #060419 al 12 %, el botón principal del color de marca. */
.s-claro .s-barra{background:#fff;border-bottom-color:rgba(6,4,25,.12)}
.s-claro .s-nav-a{color:${TINTA}}
.s-claro .s-nav-a:hover,.s-claro .s-nav-it:hover>.s-nav-a,.s-claro .s-nav-it:focus-within>.s-nav-a{background:rgba(6,4,25,.06);color:${TINTA}}
.s-claro .s-nav:hover .s-nav-it:not(:hover)>.s-nav-a{background:transparent;color:${TINTA}}
.s-claro .s-nb{color:${TINTA};border-color:#000}
.s-claro .s-nb:hover{background:rgba(6,4,25,.06)}
.s-claro .s-nb-lleno{background:${AZUL};border-color:${AZUL};color:#fff}
.s-claro .s-nb-lleno:hover{background:#1F57C8;border-color:#1F57C8}
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

@media (prefers-reduced-motion:reduce){
  .s-mega,.s-nav-it:hover>.s-mega,.s-nav-it:focus-within>.s-mega{transition:none;transform:none}
  .s-mv-fila svg{transition:none}
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
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// El pie
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_PIE = `
/* Su pie: filete arriba, 64 de aire; a la izquierda el texto (16/24 700), a la derecha las columnas (títulos 14/20 700, links
   14/20 500 #9393A9 cada 32 px, 40 entre columnas); filete con 48 de aire; los links legales, la estrella y el ©. */
.s-pie{background:${FONDO};border-top:1px solid ${LINEA};padding:64px 0}
.s-pie-in{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;padding-bottom:48px;border-bottom:1px solid ${LINEA}}
.s-pie-logo{margin-bottom:14px}
.s-pie-lema{font-size:16px;line-height:24px;font-weight:700;color:#fff;max-width:300px}
.s-pie-sub{margin-top:12px;font-size:14px;line-height:20px;font-weight:500;color:${GRIS3};max-width:300px}
.s-pie-cols{display:flex;gap:32px;justify-content:space-between}
.s-pie-h{font-size:14px;line-height:20px;font-weight:700;color:#fff;margin-bottom:16px;white-space:nowrap}
.s-pie-col li{font-size:14px;line-height:20px;font-weight:500;padding-bottom:12px}
.s-pie-col a{color:${GRIS3};white-space:nowrap;transition:color .15s}
.s-pie-col a:hover{color:#fff}
.s-pie-base{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-top:32px}
.s-pie-leg{display:flex;flex-wrap:wrap;gap:8px 16px}
.s-pie-leg a{font-size:14px;line-height:20px;font-weight:500;color:${GRIS3};transition:color .15s}
.s-pie-leg a:hover{color:#fff}
.s-pie-c{margin-top:16px;font-size:14px;line-height:20px;font-weight:500;color:${GRIS2}}
.s-claro .s-pie{background:#FCFCFD;border-top-color:rgba(6,4,25,.12)}
.s-claro .s-pie-in{border-bottom-color:rgba(6,4,25,.12)}
.s-claro .s-pie-lema,.s-claro .s-pie-h{color:${TINTA}}
.s-claro .s-pie-sub,.s-claro .s-pie-col a,.s-claro .s-pie-leg a{color:${GRIS_CLARO}}
.s-claro .s-pie-col a:hover,.s-claro .s-pie-leg a:hover{color:${TINTA}}
.s-claro .s-pie-c{color:${GRIS_CLARO2}}
@media (max-width:1279px){
  .s-pie-cols{gap:28px}
}
@media (max-width:1023px){
  .s-pie-in{grid-template-columns:minmax(0,1fr)}
  .s-pie-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 16px}
}
/* A 390: los links en dos columnas, después los legales y el ©, y al final el texto. */
@media (max-width:767px){
  .s-pie{padding:40px 0}
  .s-pie .s-cont{display:flex;flex-direction:column;padding:0 16px}
  .s-pie-in{display:contents}
  .s-pie-cols{order:1;grid-template-columns:repeat(2,minmax(0,1fr));padding-bottom:24px;border-bottom:1px solid ${LINEA}}
  .s-claro .s-pie-cols{border-bottom-color:rgba(6,4,25,.12)}
  .s-pie-col a{white-space:normal}
  .s-pie-base{order:2;padding-top:24px}
  .s-pie-marca{order:3;margin-top:32px}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// La portada (/vsl/sitio)
// ─────────────────────────────────────────────────────────────────────────────
export const CSS_PORTADA = `
/* El hero: 96 arriba y abajo; dos columnas de 576 con 32 de separación; el titular 60/60 en mayúsculas con el último renglón en
   degradado, la bajada 20/28 en 512 px, los dos botones de 50 separados 12, la nota 14/20 #B8B8C8 y el visual de 634 × 475. */
.s-hero{position:relative;padding:96px 0}
.s-hero-in{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:32px;align-items:center}
/* El VSL de Martín en el lugar de la composición de beehiiv (12/11/2026): 16:9, con el halo azul de su composición. */
.s-hero-vsl{position:relative}
.s-hero-vsl::before{content:'';position:absolute;inset:-8% -8% -4%;background:radial-gradient(closest-side,rgba(47,111,237,.32),rgba(47,111,237,0));filter:blur(24px);pointer-events:none}
.s-hero-vsl .mk-vsl-slot{position:relative;width:100%;aspect-ratio:16/9}
.s-hero-vsl .mk-vsl{position:absolute;inset:0;border-radius:14px;overflow:hidden;background:#0B0D12;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 70px -32px rgba(0,0,0,.7)}
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
.s-tira-reemplaza{padding-top:8px;padding-bottom:48px}
.s-tira-reemplaza .s-tira-p{animation-duration:170s}
.s-tira-app img{width:34px;height:34px;flex:none;border-radius:9px;object-fit:contain}
.s-tira-ver{margin-top:20px;text-align:center;padding:0 16px}
.s-tira-ver a{display:inline-flex;align-items:center;gap:8px;font-size:16px;line-height:24px;font-weight:700;color:${DORADO_CLARO}}
.s-tira-ver a:hover{text-decoration:underline}
.s-sitio .s-tira:not(.s-tira-reemplaza){padding-top:64px}
@keyframes s-desliza{to{transform:translateX(-50%)}}

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
.s-zz{margin-top:80px;display:flex;flex-direction:column;gap:112px}
.s-zz-fila{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:72px;align-items:center}
.s-zz-inv{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
.s-zz-inv .s-zz-tx{order:2}
.s-zz-r{font-size:14px;line-height:20px;font-weight:600;color:${DORADO}}
.s-zz-t{margin-top:8px;font-size:36px;line-height:42px;font-weight:700;letter-spacing:-.01em;color:#fff}
.s-zz-p{margin-top:16px;font-size:18px;line-height:28px;font-weight:500;color:${TEXTO}}
.s-zz-a{margin-top:20px;display:inline-flex;align-items:center;gap:6px;font-size:18px;line-height:28px;font-weight:500;color:${DORADO}}
.s-zz-a svg{transition:transform .15s}
.s-zz-a:hover svg{transform:translateX(3px)}
.s-zz-vis{position:relative;border-radius:16px;overflow:hidden;border:1px solid ${LINEA};background:#fff;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.s-zz-vis > .s-panel{border-radius:0;max-height:460px;overflow:hidden}
.s-zz-video video{display:block;width:100%;height:auto}
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
.s-precios-bloques{margin:48px auto 0;max-width:1120px}
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
.s-int-f{display:flex;justify-content:center;gap:14px}
.s-int-f:nth-child(2){transform:translateX(36px)}
.s-int-t{flex:none;position:relative;width:68px;height:68px;border-radius:14px;background:${CARD};border:1px solid ${LINEA};display:flex;align-items:center;justify-content:center}

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
  .s-tira-p{animation:none;width:auto}
  .s-tira-l{flex-wrap:wrap;justify-content:center;gap:16px 40px;padding:0 24px}
  .s-tira-l[aria-hidden]{display:none}
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
  .s-zz{gap:72px;margin-top:48px}
  .s-zz-fila,.s-zz-inv{grid-template-columns:minmax(0,1fr);gap:28px}
  .s-zz-inv .s-zz-tx{order:0}
  .s-zz-t{font-size:28px;line-height:34px}
  .s-zz-gurus{height:340px}
  .s-bento .s-fila > :nth-child(n){flex:none}
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
  .s-tira-r{font-size:12px;line-height:16px}
  .s-tira-i{font-size:20px;line-height:24px;height:40px}
  .s-sec{padding:40px 0}
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
  .s-int-f:nth-child(2){transform:translateX(34px)}
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
.s-ch-logo-c{width:108px;height:108px;border-radius:14px;background:#1A1712;display:flex;align-items:center;justify-content:center}
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

/* «beehiiv vs the others»: lavanda, 160 de aire; el título 48/48 y, a 40, la grilla de tres tarjetas de 368 con 40 de separación:
   cara blanca de filete 2 px negro y radio 8, 32 de aire, título 24/32 600 y «Compare →» 20/28 500 a 32; debajo, sus dos capas
   que se separan al pasar el mouse. */
.s-cv{background:${AZUL_TINTE};padding:160px 0}
.s-cv-h2{${TITULAR};font-size:48px;line-height:48px;color:${TINTA}}
.s-cv-grilla{margin-top:40px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px}
.s-vs{position:relative;display:block;transition:transform .125s ease-out}
.s-vs-cara{position:relative;z-index:10;display:block;height:100%;background:#fff;border:2px solid #000;border-radius:8px;padding:32px;transition:transform .125s ease-out}
.s-vs-c1,.s-vs-c2{position:absolute;inset:0;border:2px solid #0B0D2A;border-radius:12px;transition:transform .125s ease-out}
.s-vs-c1{background:${DORADO_CAPA}}
.s-vs-c2{background:${DORADO}}
.s-vs:hover .s-vs-cara{transform:translate(-12px,-12px)}
.s-vs:hover .s-vs-c1{transform:translate(-8px,-8px)}
.s-vs:hover .s-vs-c2{transform:translate(-4px,-4px)}
.s-vs-t{display:block;font-size:24px;line-height:32px;font-weight:600;color:#000}
.s-vs-a{display:flex;align-items:center;gap:8px;padding-top:32px;font-size:20px;line-height:28px;font-weight:500;color:${AZUL}}

@media (prefers-reduced-motion:reduce){
  .s-vs,.s-vs-cara,.s-vs-c1,.s-vs-c2{transition:none}
  .s-vs:hover .s-vs-cara,.s-vs:hover .s-vs-c1,.s-vs:hover .s-vs-c2{transform:none}
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
  .s-vs:hover .s-vs-cara,.s-vs:hover .s-vs-c1,.s-vs:hover .s-vs-c2{transform:none}
}
`;
