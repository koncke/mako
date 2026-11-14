// =============================================================================
// /vsl/offer con el DISEÑO de su referencia: «Atlas: The Offer Architect» de Done For You (11/11/2026; relevo fiel el 14/11/2026)
// =============================================================================
// Copiado de https://go.doneforyou.com/offer-formula, medido con Chromium a 1440 y a 390 px el 11/11/2026 y otra vez el 14/11/2026
// con video, hovers, `getAnimations()` en cada paso del scroll, MutationObserver e IntersectionObserver (los valores, en
// docs/diseno/landings-competencia/offer.md; el relevo con capturas, en la carpeta de notas de la sesión, referencias-landings/offer/).
// Es una página de GoHighLevel: el hero NEGRO con la cejilla de color, el titular en itálica de 45 px, la bajada de 25 px y dos
// columnas (la franja de color, el video de 730 × 411, su párrafo y el link a mano; la tarjeta blanca de 360 px con la imagen del
// producto y el botón); la tarjeta blanca de 1140 px sobre gris #F0F2F5 con su titular de 50 px, los párrafos de 22 px y la lista
// con el tilde verde; la banda #4B4B4B con «Here's Everything You're Getting», su subtítulo de 42 px, la captura de su app de
// 900 × 550 con notas a mano y la grilla de 3 × 2 tarjetas negras con borde de color y la caja de cada producto; la sección blanca
// de su garantía y la banda final con el botón. Letra: Roboto, Raleway y Caveat, las mismas, bajadas a /vsl-assets/fuentes/.
//
// LO QUE SE MUEVE es lo de la referencia y nada más (medido: ninguna aparición al bajar, ningún hover que se vea en botones,
// tarjetas ni links): su VSL arranca SOLO y sin sonido, y cuando se baja y el video sale de la pantalla, sigue en una ventanita
// flotante abajo a la derecha (280 × 158, a 3 px del borde) que sube con `fadeInUp` en 1 s, con su × para cerrarla 160 px más
// arriba. Aquí es lo mismo con la grabación, en un <script data-visor> (el visor de Martín borra los demás); la × es una casilla
// con su rótulo (un <button> sin onClick lo marca tests/ningun-boton-muerto.test.ts). Con «menos movimiento», el video queda en su
// primer cuadro y no flota.
//
// De MaKo: el logo, el azul de los botones (su amarillo), el dorado de la cejilla y de los bordes, el azul oscuro de su violeta,
// el botón para empezar, las PANTALLAS y el caso de Mauricio:
//   · su VSL es aquí la grabación REAL de Offer (banco C:/dev/bancos-portada/banco-offer, «Cierre Consultivo», el negocio ficticio de
//     las plantillas de la app): MaKo pregunta, se contesta escribiendo y tocando una opción, «Tu oferta» se arma al costado y
//     «Armar mi oferta» saca el PDF con su nota (63/100);
//   · la imagen del producto de su tarjeta, la portada de ese PDF; la captura de su app con notas a mano, la de Offer con la oferta
//     armada; la caja de cada producto, la pantalla de esa pieza en el teléfono.
// Lo que se sacó de la referencia, y por qué:
//   · «Make Sure Your Sound Is Turned ON!», su «Enable sound» y su barra de controles: son del sonido de su VSL; la grabación no
//     tiene sonido. La franja queda, con lo que es el video.
//   · Su precio («Only $147 FREE», «$97 al mes»), «ONLY A FEW DAYS LEFT», las estrellas («4.7 / 5 de 398 alumnos»), su sello, su
//     garantía de 30 días, el pago seguro y las franjas del cupón («34% OFF»): MaKo no escribe un precio a mano, no tiene garantía
//     ni reseñas. Debajo de cada botón va lo que dice la prueba de MaKo (TEXTO_CIERRE).
//   · El «INSTANT ACCESS | INCLUDED» de cada tarjeta y su sección de abajo (su libro en Amazon): son de su producto.
//   · Su página no tiene pie: el de MaKo (el resto de las funciones) copia su barra de arriba.
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, MAKO, TEXTO_CTA, TEXTO_CIERRE, html, otrasFunciones } from '../marca';

const F = '/vsl-assets/fuentes';
const P = 'd-offer';
const A = '/vsl-assets/offer';

/** La grabación del hero (banco-offer, `TAM=960:540 codificar-bucle.sh`) y su póster, el PRIMER cuadro. */
export const VIDEO_OFFER = { video: `${A}/chat.webm`, poster: `${A}/chat.jpg` } as const;
/** La imagen del producto de su tarjeta (328 × 185): la portada del PDF de la oferta, con su nota. */
export const FOTO_TARJETA = `${A}/tarjeta.jpg`;
/** Donde la referencia pone la captura de su app con notas a mano (900 × 550): Offer con la oferta armada. */
export const PANTALLA_OFFER = `${A}/pantalla.jpg`;
/** La «caja» de cada pieza (200 × 250), EN EL ORDEN de las seis piezas de ../offer.ts: la pantalla de esa pieza en el teléfono. */
export const FOTOS_PIEZAS: readonly { src: string; alt: string }[] = [
  { src: `${A}/pieza-plantillas.jpg`, alt: 'Nueva oferta en MaKo, en el teléfono: las plantillas, cada una con su ejemplo' },
  { src: `${A}/pieza-chat.jpg`, alt: 'El chat de Offer en el teléfono: MaKo pregunta por una pieza y ofrece respuestas para tocar' },
  { src: `${A}/pieza-nota.jpg`, alt: 'El diagnóstico de la oferta, con su nota de 63 sobre 100' },
  { src: `${A}/pieza-oferta.jpg`, alt: 'La oferta nueva: su nombre y su frase, con su nota' },
  { src: `${A}/pieza-probar.jpg`, alt: 'Lo primero que cambiaría, cada cambio con su botón «Probarlo»' },
  { src: `${A}/pieza-pdf.jpg`, alt: 'La primera página del PDF de la oferta' },
];
/** Las notas a mano sobre la captura, como las suyas («The brain of the system!», «Your Chat Functionality»), en px de la imagen de
 *  900 × 550 (se dibujan en %): el texto donde la captura tiene lugar y la flecha hacia lo que nombra. */
const NOTAS: readonly { texto: string; x: number; y: number; flecha: { x: number; y: number; w: number; h: number; d: string } }[] = [
  { texto: 'MaKo pregunta', x: 238, y: 214, flecha: { x: 214, y: 244, w: 46, h: 30, d: 'M42 3 C 30 6, 16 14, 5 25 M5 25 L8 13 M5 25 L17 24' } },
  { texto: 'Tu nota y tu PDF', x: 236, y: 372, flecha: { x: 200, y: 330, w: 42, h: 44, d: 'M38 40 C 30 30, 18 18, 6 6 M6 6 L18 8 M6 6 L8 18' } },
  { texto: 'Tu oferta, armándose', x: 664, y: 380, flecha: { x: 606, y: 398, w: 60, h: 30, d: 'M57 4 C 42 8, 24 14, 5 20 M5 20 L15 12 M5 20 L16 27' } },
];

/** El tilde de su lista (Font Awesome «check-circle», #37CA37), como imagen: el sol y la luna no toca los fondos con imagen. */
const TILDE = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#37CA37" d="M504 256c0 137-111 248-248 248S8 393 8 256 119 8 256 8s248 111 248 248zM227 387l184-184c6-6 6-16 0-22l-23-23c-6-6-16-6-22 0L216 308l-70-70c-6-6-16-6-22 0l-23 23c-6 6-6 16 0 22l104 104c6 6 16 6 22 0z"/></svg>')}")`;

const CSS = `
@font-face { font-family: 'D Offer Roboto'; src: url('${F}/roboto/roboto-latin-var.woff2') format('woff2'); font-weight: 400 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Offer Roboto'; src: url('${F}/roboto/roboto-latin-900-italic.woff2') format('woff2'); font-weight: 900; font-style: italic; font-display: swap; }
@font-face { font-family: 'D Offer Raleway'; src: url('${F}/raleway/raleway-latin-var.woff2') format('woff2'); font-weight: 400 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Offer Caveat'; src: url('${F}/caveat/caveat-latin-700.woff2') format('woff2'); font-weight: 700; font-style: normal; font-display: swap; }

.${P}-raiz { --${P}-roboto: 'D Offer Roboto', Roboto, Arial, sans-serif; --${P}-raleway: 'D Offer Raleway', Raleway, Arial, sans-serif; --${P}-caveat: 'D Offer Caveat', Caveat, cursive;
  background: #fff; color: #000; font-family: var(--${P}-raleway); font-size: 16px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
.${P}-raiz *, .${P}-raiz *::before, .${P}-raiz *::after { box-sizing: border-box; }
.${P}-raiz a { text-decoration: none; }
.${P}-raiz :where(p, h1, h2, h3, ul) { margin: 0; }

/* La barra: blanca, 90 px + 2 px, el logo a la izquierda (x = 170) y los links a la derecha (Roboto 20 px, 5 px 21 px; su hover
   pone el fondo blanco sobre blanco en 0,3 s: no se ve). En producción la tapa la barra del sitio (BARRA_PROPIA). */
.${P}-nav { background: #fff; padding-bottom: 2px; }
.${P}-nav-in { max-width: 1100px; height: 90px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
.${P}-logo { font-family: var(--${P}-roboto); }
.${P}-links { display: flex; align-items: center; list-style: none; margin: 0; padding: 0; }
.${P}-links a { display: flex; padding: 5px 21px; font-family: var(--${P}-roboto); font-size: 20px; font-weight: 400; color: #000; transition: background-color .3s; }
.${P}-links a:hover { background: #fff; }

/* El hero: negro, 20 px arriba y 10 abajo. */
.${P}-hero { background: #000; padding: 20px 0 10px; }
.${P}-cejilla { width: 971px; max-width: calc(100% - 20px); margin: 0 auto; padding: 5px; background: ${MAKO.dorado}; text-align: center;
  font-family: var(--${P}-raleway); font-size: 33px; line-height: 33px; font-weight: 900; letter-spacing: -1px; color: #000; }
.${P}-h1 { max-width: 1120px; margin: 25px auto 0; text-align: center; font-family: var(--${P}-roboto); font-size: 45px; line-height: 45px;
  font-weight: 900; font-style: italic; letter-spacing: -1px; color: #fff; }
.${P}-sub { max-width: 1120px; margin: 10px auto 0; text-align: center; font-family: var(--${P}-raleway); font-size: 25px; line-height: 32.5px;
  font-weight: 700; color: #fff; }
.${P}-sub strong { font-weight: 700; }
.${P}-fila { width: 1130px; max-width: calc(100% - 20px); margin: 25px auto 21px; display: flex; gap: 40px; align-items: flex-start; }
.${P}-izq { flex: 0 0 730px; min-width: 0; }
/* La franja de color sobre el video (730 × 31, Roboto 21 px 900, radio 5 5 0 0) y el video, 10 px debajo. */
.${P}-franja { padding: 5px; border-radius: 5px 5px 0 0; background: ${MAKO.azulOscuro}; text-align: center; font-family: var(--${P}-roboto); font-size: 21px;
  line-height: 21px; font-weight: 900; letter-spacing: -1px; color: #fff; }
.${P}-video { position: relative; width: 100%; aspect-ratio: 16 / 9; margin-top: 10px; background: #0B0D12; }
.${P}-video video, .${P}-video-fondo { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
.${P}-video video { background: #0B0D12; }
/* Su ventanita flotante: 280 × 158 a 3 px del borde, sube con fadeInUp en 1 s; la × 160 px arriba, pegada al borde. */
.${P}-video.${P}-flota video { position: fixed; inset: auto 3px 3px auto; width: 280px; height: 158px; z-index: 9999; box-shadow: 0 6px 22px rgba(0, 0, 0, .35);
  animation: ${P}-sube 1s both; }
.${P}-x-casilla { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.${P}-x { display: none; position: fixed; right: 0; bottom: 160px; z-index: 9999; width: 28px; height: 28px; cursor: pointer; animation: ${P}-sube 1s both; }
.${P}-video.${P}-flota .${P}-x { display: block; }
.${P}-x-casilla:focus-visible + .${P}-x { outline: 2px solid ${MAKO.azul}; outline-offset: 2px; border-radius: 50%; }
@keyframes ${P}-sube { from { opacity: 0; transform: translate3d(0, 100%, 0); } to { opacity: 1; transform: none; } }
.${P}-video-p { margin: 30px 0 0; font-family: var(--${P}-raleway); font-size: 22px; line-height: 28.6px; font-weight: 400; color: #fff; }
.${P}-amano { display: block; margin: 40px 0 0; text-align: center; font-family: var(--${P}-caveat); font-size: 60px; line-height: 60px;
  font-weight: 700; letter-spacing: -1px; color: #fff; }
/* La tarjeta: blanca, radio 5, sombra 0 1px 5px .2, padding 0 15px 10px; la imagen del producto (328 × 185) a 6 px de arriba. */
.${P}-tarjeta { flex: 0 0 360px; display: flex; flex-direction: column; align-items: center; padding: 6px 15px 10px; background: #fff; border-radius: 5px;
  border: 1px solid rgba(57, 117, 234, 0); box-shadow: rgba(0, 0, 0, .2) 0 1px 5px 0; }
.${P}-tarjeta-img { display: block; width: 328px; max-width: 100%; height: auto; aspect-ratio: 328 / 185; object-fit: cover; }
.${P}-tarjeta-h { margin-top: 10px; padding: 5px; text-align: center; font-family: var(--${P}-roboto); font-size: 22px; line-height: 22px; font-weight: 900;
  letter-spacing: -1px; color: #161616; }
.${P}-tarjeta-p { margin-top: 10px; text-align: center; font-family: var(--${P}-raleway); font-size: 15px; line-height: 16px; color: #000; }
.${P}-tarjeta-chico { margin-top: 10px; text-align: center; font-family: var(--${P}-raleway); font-size: 15px; line-height: 17px; color: #000; }

/* Los botones: el amarillo de la referencia es aquí el azul de MaKo (Roboto 700, -1 px, 307 × 63, padding 5px 25px, sin radio, sin
   sombra y SIN cambio al pasar el cursor: medido). */
.${P}-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 63px; padding: 5px 18px; background: ${MAKO.azul};
  font-family: var(--${P}-roboto); font-size: clamp(16px, 4.4vw, 21px); line-height: 28px; font-weight: 700; letter-spacing: -.5px; text-transform: uppercase; color: #fff; text-align: center; white-space: nowrap; }
.${P}-btn svg { flex: none; }
.${P}-tarjeta .${P}-btn, .${P}-final .${P}-btn { width: 312px; max-width: 100%; margin-top: 10px; }

/* La tarjeta blanca de 1140 px sobre el gris #F0F2F5. */
.${P}-gris { background: #F0F2F5; padding: 20px 0 10px; }
.${P}-carta { width: 1140px; max-width: calc(100% - 20px); margin: 20px auto 21px; padding: 25px; background: #fff; border: 1px solid #E6E6E6;
  border-radius: 5px; box-shadow: rgba(0, 0, 0, .05) 0 1px 3px 0; }
.${P}-carta-h { text-align: center; font-family: var(--${P}-roboto); font-size: 50px; line-height: 50px; font-weight: 900; letter-spacing: -1px; color: ${MAKO.azulOscuro}; }
.${P}-texto { font-family: var(--${P}-raleway); font-size: 22px; line-height: 28.6px; font-weight: 500; color: #000; }
.${P}-carta .${P}-texto { margin-top: 20px; }
.${P}-carta .${P}-texto + .${P}-texto { margin-top: 28.6px; }
.${P}-lista { list-style: none; margin: 10px 0 0; padding: 0 0 0 33px; }
/* El renglón de 44 px de la referencia, como aire entre ítems y no como interlineado: partido en dos renglones (el teléfono) quedaba una
   línea por renglón (el Cerebro, 14/11/2026). El tilde verde va donde su marcador (20 px, 12 px antes del texto). */
.${P}-lista li { position: relative; padding: 6px 0 6px 11px; font-family: var(--${P}-raleway); font-size: 22px; line-height: 1.45; font-weight: 400; color: #000; }
.${P}-lista li::before { content: ''; position: absolute; left: -21px; top: calc(6px + .725em - 10px); width: 20px; height: 20px; background: ${TILDE} center / contain no-repeat; }
.${P}-carta .${P}-lista + .${P}-texto { margin-top: 30px; }

/* La banda #4B4B4B: titular (Roboto 56/67,2 500), subtítulo (42/50,4 500), la captura y la grilla de 3 × 2. */
.${P}-oscura { background: #4B4B4B; padding: 70px 0 60px; }
.${P}-oscura-h { max-width: 1130px; margin: 0 auto; padding: 0 10px; text-align: center; font-family: var(--${P}-roboto); font-size: 56px; line-height: 67.2px;
  font-weight: 500; letter-spacing: -1px; color: #fff; }
.${P}-oscura-h3 { max-width: 1130px; margin: 11px auto 0; padding: 0 10px; text-align: center; font-family: var(--${P}-roboto); font-size: 42px; line-height: 50.4px;
  font-weight: 500; letter-spacing: -1px; color: #fff; }
.${P}-paquete { position: relative; width: 900px; max-width: calc(100% - 20px); margin: 10px auto 0; }
.${P}-paquete img { display: block; width: 100%; height: auto; aspect-ratio: 900 / 550; }
.${P}-nota { position: absolute; font-family: var(--${P}-caveat); font-size: clamp(14px, 2.6vw, 25px); line-height: 1; font-weight: 700; color: #D0202E;
  white-space: nowrap; pointer-events: none; transform: rotate(-3deg); transform-origin: 0 50%; }
.${P}-flecha { position: absolute; overflow: visible; fill: none; stroke: #D0202E; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.${P}-oscura-p { max-width: 1130px; margin: 30px auto 0; padding: 0 10px; text-align: center; font-family: var(--${P}-raleway); font-size: 22px;
  line-height: 28.6px; font-weight: 500; color: #fff; }
.${P}-grilla { width: 849px; max-width: calc(100% - 20px); margin: 45px auto 0; display: grid; grid-template-columns: repeat(3, 263px); gap: 30px; }
.${P}-pieza { display: flex; flex-direction: column; align-items: center; padding: 10px 5px 21px; background: #161716; border: 1px solid ${MAKO.dorado}; border-radius: 4px; }
/* La caja de su producto: 200 × 250, 11 px por debajo del padding. Aquí, la pantalla de esa pieza. */
.${P}-pieza-img { display: block; width: 200px; height: 250px; margin-top: 11px; border-radius: 3px; object-fit: cover; background: #fff; }
.${P}-pieza-h { margin-top: 10px; padding: 0 5px; text-align: center; font-family: var(--${P}-raleway); font-size: 22px; line-height: 28.6px; font-weight: 700; color: #fff; }
.${P}-pieza-p { margin-top: 10px; padding: 0 5px; text-align: center; font-family: var(--${P}-raleway); font-size: 16px; line-height: 20.8px; font-weight: 500; color: #fff; }
.${P}-pieza-p strong { font-weight: 700; }
.${P}-ancho { display: flex; width: 1130px; max-width: calc(100% - 20px); margin: 55px auto 0; }
.${P}-ancho .${P}-btn { flex: 1; }

/* La sección blanca de su garantía, con el caso de Mauricio. */
.${P}-caso { background: #fff; padding: 40px 0 20px; }
/* El video de Mauricio, donde la referencia tiene su sello: más grande que el sello (Martín, 12/11/2026: el de 200 px no se veía). */
.${P}-caso-video { display: block; width: 320px; max-width: calc(100% - 20px); aspect-ratio: 9 / 16; margin: 0 auto; object-fit: cover; background: #000; border-radius: 12px; }
.${P}-caso-h { max-width: 749px; margin: 50px auto 0; text-align: center; font-family: var(--${P}-roboto); font-size: 36px; line-height: 36px; font-weight: 900;
  letter-spacing: -1px; color: #000; }
.${P}-caso-col { max-width: 749px; margin: 36px auto 0; box-shadow: rgba(0, 0, 0, .05) 0 1px 3px 0; }
.${P}-caso-col .${P}-texto + .${P}-texto { margin-top: 28.6px; }
.${P}-caso-col strong { font-weight: 700; }

/* La banda final: titular Roboto 42/50,4 500, el botón 10 px debajo y, donde van sus estrellas, la prueba de MaKo. */
.${P}-final { background: #4B4B4B; padding: 70px 10px 70px; text-align: center; }
.${P}-final-h { max-width: 1130px; margin: 0 auto; font-family: var(--${P}-roboto); font-size: 42px; line-height: 50.4px; font-weight: 500; letter-spacing: -1px; color: #fff; }
.${P}-final-chico { max-width: 560px; margin: 12px auto 0; font-family: var(--${P}-raleway); font-size: 15px; line-height: 19px; color: #fff; }

/* El pie de MaKo, con la forma de su barra de arriba. */
.${P}-pie { background: #fff; border-top: 1px solid #E6E8EC; padding: 24px 0 28px; }
.${P}-pie-in { max-width: 1100px; margin: 0 auto; padding: 0 10px; display: flex; align-items: flex-start; gap: 24px; }
.${P}-pie-in .${P}-links { flex: 1; flex-wrap: wrap; justify-content: flex-end; }
.${P}-pie-in .${P}-links a { font-size: 18px; }

@media (max-width: 1160px) {
  .${P}-fila { flex-direction: column; align-items: center; }
  .${P}-izq, .${P}-tarjeta { flex: none; width: 100%; max-width: 730px; }
}
@media (max-width: 900px) {
  .${P}-grilla { grid-template-columns: 1fr; gap: 0; width: 370px; }
}
/* A 390 px (la referencia corta a 768 px): barra de 70 px sin links, hero en una columna, todo a 370 px con 10 de margen; sin el
   párrafo ni el link debajo del video, sin la imagen del producto y sin la captura de la banda oscura (las esconde la referencia). */
@media (max-width: 767px) {
  .${P}-nav-in { height: 68px; padding: 0 10px; justify-content: center; }
  .${P}-nav .${P}-links { display: none; }
  .${P}-cejilla { width: 370px; font-size: 17px; line-height: 17px; }
  .${P}-h1 { padding: 0 10px; font-size: 32px; line-height: 32px; }
  .${P}-sub { padding: 0 10px; }
  .${P}-fila { width: 370px; gap: 10px; margin-bottom: 20px; }
  .${P}-video-p, .${P}-amano, .${P}-tarjeta-img, .${P}-paquete { display: none; }
  .${P}-tarjeta { padding: 6px 0 10px; }
  /* A 375 la lista llegaba al borde derecho: 44 px de sangría a la izquierda y 10 a la derecha (el Cerebro, 14/11). El mismo aire de
     los dos lados, como el resto de la página; el tilde queda en la sangría. */
  .${P}-carta { width: 370px; padding: 25px 20px; }
  .${P}-lista { padding-left: 30px; }
  .${P}-lista li { padding-left: 0; font-size: 20px; }
  .${P}-lista li::before { left: -28px; }
  .${P}-carta-h { font-size: 32px; line-height: 32px; }
  .${P}-oscura-h, .${P}-oscura-h3 { font-size: 32px; line-height: 38.4px; }
  .${P}-pieza { padding: 10px 0 21px; }
  .${P}-ancho { width: 370px; margin-top: 50px; }
  .${P}-caso-h { padding: 0 10px; font-size: 28px; line-height: 28px; }
  .${P}-caso-col { margin: 28px 10px 0; }
  .${P}-final { padding: 70px 10px; }
  .${P}-final-h { font-size: 32px; line-height: 38.4px; }
  .${P}-pie-in { flex-direction: column; align-items: center; }
  .${P}-pie-in .${P}-links { justify-content: center; }
  .${P}-pie-in .${P}-links a { font-size: 16px; padding: 4px 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .${P}-video.${P}-flota video { position: absolute; inset: 0; width: 100%; height: 100%; animation: none; box-shadow: none; }
  .${P}-video.${P}-flota .${P}-x { display: none; }
}
`;

/** La flecha de sus botones («➧»), dibujada para que no dependa de la fuente. */
const Flecha = () => (
  <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d="M2 1.5 12.5 9 2 16.5 4.5 9Z" fill="currentColor" /></svg>
);

function Boton({ className = '' }: { className?: string }) {
  return <a href={RUTA_CTA} className={[`${P}-btn`, className].filter(Boolean).join(' ')}>{TEXTO_CTA}<Flecha /></a>;
}

/** Su × de la ventanita (un círculo negro con aro blanco). */
const Cruz = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
    <circle cx="14" cy="14" r="12.5" fill="#111" stroke="#fff" strokeWidth="2" />
    <path d="M9.5 9.5l9 9M18.5 9.5l-9 9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/** Las secciones, en el orden de la landing. El «sin / con» abre la tarjeta blanca y la lista que lo sigue va adentro. */
function secciones(bloques: Bloque[]) {
  const out: ReactNode[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const k = `b${i}`;
    switch (b.tipo) {
      case 'hero':
        out.push(
          <section key={k} className={`${P}-hero`}>
            <p className={`${P}-cejilla`} dangerouslySetInnerHTML={html(b.etiqueta)} />
            <h1 className={`${P}-h1`} dangerouslySetInnerHTML={html(b.titulo)} />
            <h2 className={`${P}-sub`} dangerouslySetInnerHTML={html(b.bajada)} />
            <div className={`${P}-fila`}>
              <div className={`${P}-izq`}>
                <p className={`${P}-franja`} data-tema-fijo="">Grabado en MaKo: así se arma tu oferta</p>
                <div className={`${P}-video`} data-tema-fijo="">
                  {/* Lo que queda en el lugar mientras el video flota: su primer cuadro. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={`${P}-video-fondo`} src={VIDEO_OFFER.poster} alt="" width={960} height={540} decoding="async" />
                  <video src={VIDEO_OFFER.video} poster={VIDEO_OFFER.poster} muted loop playsInline autoPlay preload="metadata"
                    aria-label="Grabado en MaKo: el chat de Offer pregunta por cada pieza, tu oferta se arma al costado y sale el PDF con su nota" />
                  <input type="checkbox" id={`${P}-x`} className={`${P}-x-casilla`} aria-label="Cerrar el video flotante" />
                  <label htmlFor={`${P}-x`} className={`${P}-x`} title="Cerrar"><Cruz /></label>
                </div>
                {b.puntos?.[2] && <p className={`${P}-video-p`} dangerouslySetInnerHTML={html(b.puntos[2])} />}
                <a href={RUTA_CTA} className={`${P}-amano`}>{TEXTO_CTA} &gt;&gt;</a>
              </div>
              <div className={`${P}-tarjeta`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={`${P}-tarjeta-img`} src={FOTO_TARJETA} alt="La portada del PDF de una oferta armada en Offer: su puntaje y lo que más la frena" width={656} height={370} decoding="async" />
                {b.puntos?.[0] && <p className={`${P}-tarjeta-h`} dangerouslySetInnerHTML={html(b.puntos[0])} />}
                {b.puntos?.[1] && <p className={`${P}-tarjeta-p`} dangerouslySetInnerHTML={html(b.puntos[1])} />}
                <Boton />
                <p className={`${P}-tarjeta-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
              </div>
            </div>
          </section>,
        );
        break;
      case 'contraste': {
        const sigue = bloques[i + 1];
        const lista = sigue && sigue.tipo === 'tarjetas' && !sigue.fondo ? (sigue as Tarjetas) : null;
        out.push(
          <section key={k} className={`${P}-gris`}>
            <div className={`${P}-carta`}>
              <h2 className={`${P}-carta-h`} dangerouslySetInnerHTML={html(b.titulo)} />
              <p className={`${P}-texto`}><span dangerouslySetInnerHTML={html(b.sin.titulo)} /> <span dangerouslySetInnerHTML={html(b.sin.texto)} /></p>
              <p className={`${P}-texto`}><span dangerouslySetInnerHTML={html(b.con.titulo)} /> <span dangerouslySetInnerHTML={html(b.con.texto)} /></p>
              {lista && (
                <>
                  <p className={`${P}-texto`} dangerouslySetInnerHTML={html(lista.titulo)} />
                  <ul className={`${P}-lista`}>
                    {lista.items.map((it, j) => <li key={j}><span dangerouslySetInnerHTML={html(it.titulo)} />: <span dangerouslySetInnerHTML={html(it.texto)} /></li>)}
                  </ul>
                  {/* Su párrafo de cierre («People using … are creating profitable offers…»). */}
                  {lista.bajada && <p className={`${P}-texto`} dangerouslySetInnerHTML={html(lista.bajada)} />}
                </>
              )}
            </div>
            {b.cta && <div className={`${P}-ancho`}><Boton /></div>}
          </section>,
        );
        if (lista) i++;
        break;
      }
      case 'tarjetas':
        out.push(
          <section key={k} className={`${P}-oscura`}>
            <h2 className={`${P}-oscura-h`} dangerouslySetInnerHTML={html(b.titulo)} />
            {/* Su subtítulo de 42 px («Inside The Offer Creation Formula + Atlas AI Tool»). */}
            {b.etiqueta && <p className={`${P}-oscura-h3`} dangerouslySetInnerHTML={html(b.etiqueta)} />}
            <div className={`${P}-paquete`} data-tema-fijo="">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PANTALLA_OFFER} alt="Offer en MaKo con la oferta armada: el chat a la izquierda y la oferta, sección por sección, a la derecha" width={1350} height={825} loading="lazy" decoding="async" />
              {NOTAS.map((n) => (
                <span key={n.texto} aria-hidden="true">
                  <span className={`${P}-nota`} style={{ left: `${(n.x / 9).toFixed(2)}%`, top: `${(n.y / 5.5).toFixed(2)}%` }}>{n.texto}</span>
                  <svg className={`${P}-flecha`} viewBox={`0 0 ${n.flecha.w} ${n.flecha.h}`}
                    style={{ left: `${(n.flecha.x / 9).toFixed(2)}%`, top: `${(n.flecha.y / 5.5).toFixed(2)}%`, width: `${(n.flecha.w / 9).toFixed(2)}%`, height: `${(n.flecha.h / 5.5).toFixed(2)}%` }}>
                    <path d={n.flecha.d} vectorEffect="non-scaling-stroke" />
                  </svg>
                </span>
              ))}
            </div>
            {b.bajada && <p className={`${P}-oscura-p`} dangerouslySetInnerHTML={html(b.bajada)} />}
            <div className={`${P}-grilla`}>
              {b.items.map((it, j) => (
                <div key={j} className={`${P}-pieza`}>
                  {FOTOS_PIEZAS[j] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={`${P}-pieza-img`} src={FOTOS_PIEZAS[j].src} alt={FOTOS_PIEZAS[j].alt} width={400} height={500} loading="lazy" decoding="async" data-tema-fijo="" />
                  )}
                  <p className={`${P}-pieza-h`} dangerouslySetInnerHTML={html(it.titulo)} />
                  <p className={`${P}-pieza-p`} dangerouslySetInnerHTML={html(it.texto)} />
                </div>
              ))}
            </div>
            {b.cta && <div className={`${P}-ancho`}><Boton /></div>}
          </section>,
        );
        break;
      case 'caso':
        out.push(
          <section key={k} className={`${P}-caso`}>
            <video className={`${P}-caso-video`} muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en un escenario`} data-tema-fijo="">
              <source src={CASO.video} type="video/mp4" />
            </video>
            <h2 className={`${P}-caso-h`} dangerouslySetInnerHTML={html(CASO.titulo)} />
            <div className={`${P}-caso-col`}>
              {CASO.historia.map((h, j) => <p key={j} className={`${P}-texto`} dangerouslySetInnerHTML={html(h)} />)}
              <p className={`${P}-texto`} dangerouslySetInnerHTML={html(CASO.resultado)} />
              <p className={`${P}-texto`}><strong>{CASO.quien}</strong> · {CASO.rol}.</p>
            </div>
          </section>,
        );
        break;
      default:
        // Esta landing no tiene otros tipos de bloque; si se suman, se dibujan como un párrafo de su tarjeta blanca.
        out.push(
          <section key={k} className={`${P}-gris`}>
            <div className={`${P}-carta`}><h2 className={`${P}-carta-h`} dangerouslySetInnerHTML={html('titulo' in b && b.titulo ? b.titulo : '')} /></div>
          </section>,
        );
    }
  }
  return out;
}

export default function DisenoOffer({ landing }: PropsDiseno) {
  const otras = otrasFunciones(landing.slug);
  return (
    <div className={`${P}-raiz`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className={`${P}-nav`}>
        <div className={`${P}-nav-in`}>
          <LogoMaKo className={`${P}-logo`} tamano={44} />
          <ul className={`${P}-links`}>
            <li><a href={`#${P}-funciones`}>Funciones</a></li>
            <li><a href={RUTA_CTA}>{TEXTO_CTA}</a></li>
          </ul>
        </div>
      </header>
      <main>
        {secciones(landing.bloques)}
        <section className={`${P}-final`}>
          <h2 className={`${P}-final-h`}>{landing.metaTitle}</h2>
          <Boton />
          <p className={`${P}-final-chico`} dangerouslySetInnerHTML={html(TEXTO_CIERRE)} />
        </section>
      </main>
      <footer className={`${P}-pie`} id={`${P}-funciones`}>
        <div className={`${P}-pie-in`}>
          <LogoMaKo className={`${P}-logo`} tamano={30} />
          <ul className={`${P}-links`} aria-label="Las otras funciones de MaKo">
            {otras.map((o) => <li key={o.href}><a href={o.href}>{o.nombre}</a></li>)}
          </ul>
        </div>
      </footer>
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}

// =============================================================================
// El script (data-visor): como su VSL, el video arranca solo y sin sonido y, cuando sale por arriba de la pantalla, sigue en la
// ventanita de abajo a la derecha hasta que se vuelve a ver o se cierra con la ×. Corre sólo mientras se ve (en la ventanita también).
// Con «menos movimiento» queda en su primer cuadro y no flota. Idempotente (`__listo`) y limpia su propio estado: pulir.mjs guarda el
// DOM DESPUÉS de correrlo (docs/hallazgos-landing.md, «Video como Cherry, segunda vuelta»).
// =============================================================================
const SCRIPT = `(function(){
var P='${P}';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function iniciar(){
  var R=document.querySelector('.'+P+'-raiz');if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var caja=R.querySelector('.'+P+'-video'),x=R.querySelector('.'+P+'-x-casilla');
  if(caja)caja.classList.remove(P+'-flota');if(x)x.checked=false;
  var vids=[].slice.call(R.querySelectorAll('video'));
  vids.forEach(function(v){v.muted=true;if(quieto){v.removeAttribute('autoplay');v.pause();}});
  if(quieto||!('IntersectionObserver' in window))return;
  var ob=new IntersectionObserver(function(es){es.forEach(function(e){var v=e.target;if(e.isIntersecting){v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}else if(!v.paused)v.pause();});},{threshold:.25});
  vids.forEach(function(v){ob.observe(v);});
  if(!caja||!x)return;
  var flota=function(si){caja.classList.toggle(P+'-flota',si&&!x.checked);};
  new IntersectionObserver(function(es){es.forEach(function(e){flota(!e.isIntersecting&&e.boundingClientRect.bottom<0);});},{threshold:0}).observe(caja);
  x.addEventListener('change',function(){if(x.checked)caja.classList.remove(P+'-flota');});
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;
