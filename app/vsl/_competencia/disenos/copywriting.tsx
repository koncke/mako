// =============================================================================
// /vsl/copywriting con el DISEÑO de su referencia: «The Copy Machine» de The Operator Stack (11/11/2026)
// =============================================================================
// Copiado de https://theoperatorstack.io/copy-machine, medido con Chromium a 1440 y a 390 px el 11/11/2026 (los valores,
// en docs/diseno/landings-competencia/copywriting.md). Una página editorial sobre papel: fondo crema #F1E8D6, tarjetas
// #FBF6EA con borde #DBCDB0, titulares en DM Serif Display con la segunda mitad en itálica, textos en Libre Franklin y las
// cejillas en Courier Prime; contenedor de 1180 px con 32 de margen (16 a 390). Las tres fuentes son las de la
// referencia, bajadas de Google Fonts a /vsl-assets/fuentes/.
//
// De MaKo: el logo (donde va su «THE OPERATOR STACK»), el azul de los botones y de la palabra de color del titular (su
// naranja quemado #C0491F), el azul oscuro donde la referencia usa su verde petróleo #14514C (cejillas, números, el panel
// de «Your first hour», las itálicas de color), el dorado en el número destacado, el botón de la llamada y el caso de
// Mauricio. Los fondos, los papeles y el rosa de «Who it isn't for» son los de la referencia.
//
// Lo que se sacó de la referencia, y por qué:
//   · La barra de Black Friday, la barra fija de abajo («53 left at $47»), la letra chica del precio, «The math», «The
//     offer» y sus dos agregados, «Already own another Machine?», «Not ready yet? Start free» con su Hook Vault, «Who built
//     it» y la tira de su fundador: son su precio, su escasez, sus otros productos y su persona.
//   · Su frase «You're not getting a prompt…» debajo del hero va traducida (12/11/2026), con los referentes de MaKo.
//   · La imagen de los 14 libros de su tarjeta del hero: desde el 12/11/2026 (Martín: «podemos poner… las caricaturas»)
//     va su titular traducido («Los N referentes… Ahora tu IA puede trabajar con su método.») y la pared de caricaturas de
//     los referentes (lib/asesores/catalogo.ts, public/asesores/), con «Inspirado en» y que ninguno participa ni respalda.
//     El visual de la página con la propuesta de MaKo (../visuales-propios/copywriting.tsx) queda para quien lo use.
//   · Su banda «Three real pages and ads, rewritten» (14/11/2026, mirada otra vez con Chromium: se abre, la franja se va, las
//     filas pasan de 0fr a 1fr; sus pestañas NO cambian al pasar el mouse): en MaKo, dos piezas reales de Alex Hormozi y lo que
//     escribió «Replicar» (../copywriting.ts → REPLICAS). La del short es la animación de la portada (el reel y su guion en un
//     mismo cuadro, así que va en UN panel a lo ancho); la del anuncio, sus dos paneles («Original» / «Lo que escribió MaKo»),
//     con su selector en el teléfono. Dos pestañas y no tres: no hay otra réplica de Hormozi limpia.
//   · Sus 12 reseñas: en su riel va el caso de Mauricio en tres tarjetas (su historia, su resultado y su video), sin
//     comillas (el texto no es una cita suya). El riel es como el suyo: sin fin (una copia a cada lado), con sus flechas.
//   · El estante de libros de su renglón 6: las caricaturas de 16 referentes.
//   · La conversación de ejemplo de su «Chief» dentro del renglón 3 de «What you get» («Teaching example. Fictional product
//     brief»): el renglón queda destacado, sin la demo (sería una charla de MaKo dibujada a mano).
//   · Sus preguntas viven en una tarjeta de 372 px al lado de la de su precio: sin el precio, la tarjeta ocupa el ancho.
//   · El cierre «Traffic is an expensive place to find the weak line.» va traducido tal cual (12/11/2026), con la llamada.
//   · El pie: su fila de productos lleva el resto de las funciones de MaKo; abajo, «© MaKo» y los términos y la privacidad.
// Server component: «What's inside» y las preguntas son <details> (las preguntas con `name`: una abierta a la vez, como su
// acordeón), la banda de ejemplos es una casilla con su rótulo, las pestañas y el selector del teléfono son radios con :checked,
// y lo que necesita JavaScript (el riel sin fin, el video que corre sólo a la vista, el link del hero que abre la banda) es un
// <script data-visor> chico (SCRIPT, abajo). Todo se apaga con «reducir movimiento».
// =============================================================================

import type { ReactNode } from 'react';
import type { PropsDiseno } from '.';
import type { Bloque } from '../tipos';
import { RUTA_CTA, CASO, LogoMaKo, MAKO, TEXTO_CTA, html, otrasFunciones } from '../marca';
import { ASESORES, inspiradoEn } from '@/lib/asesores/catalogo';
import { REPLICAS } from '../copywriting';

const F = '/vsl-assets/fuentes';
const AZUL = MAKO.azul;
const PETROLEO = MAKO.azulOscuro;

const CSS = `
@font-face { font-family: 'D Copy Serif'; src: url('${F}/dm-serif-display/dm-serif-display-latin-400.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Copy Serif'; src: url('${F}/dm-serif-display/dm-serif-display-latin-400-italic.woff2') format('woff2'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'D Copy Franklin'; src: url('${F}/libre-franklin/libre-franklin-latin-var.woff2') format('woff2'); font-weight: 400 800; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Copy Courier'; src: url('${F}/courier-prime/courier-prime-latin-400.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'D Copy Courier'; src: url('${F}/courier-prime/courier-prime-latin-700.woff2') format('woff2'); font-weight: 700; font-style: normal; font-display: swap; }

.d-copywriting-raiz { --serif: 'D Copy Serif', 'DM Serif Display', Georgia, serif; --ui: 'D Copy Franklin', 'Libre Franklin', Helvetica, Arial, sans-serif;
  --mono: 'D Copy Courier', 'Courier Prime', 'Courier New', monospace; --papel: #FBF6EA; --papel-2: #F6EFDD; --linea: #DBCDB0; --linea-2: #ECE2CA;
  --tinta: #191512; --cuerpo: #3F382F; --gris: #5C534A; --crema: #F7EFDD;
  background: #F1E8D6; color: var(--tinta); font-family: var(--ui); font-size: 16px; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
.d-copywriting-raiz *, .d-copywriting-raiz *::before, .d-copywriting-raiz *::after { box-sizing: border-box; }
.d-copywriting-raiz :where(p, h1, h2, h3, ul, blockquote, figure) { margin: 0; }
.d-copywriting-raiz :where(ul) { padding: 0; list-style: none; }
.d-copywriting-raiz :where(a) { color: inherit; }
.d-copywriting-cont { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
/* Su .ex-container (la banda de ejemplos, las reseñas y «Start with…»): 24 de margen, 1132 de contenido a 1440. */
.d-copywriting-cont.d-copywriting-excont { padding-inline: 24px; }
.d-copywriting-serif { font-family: var(--serif); font-weight: 400; }
.d-copywriting-raiz em { font-style: italic; }

/* La barra: sólo la marca, 34 px de alto. */
.d-copywriting-barra { padding: 22px 0 22px; }
.d-copywriting-logo { font-family: var(--ui); }

/* Botones: la píldora naranja de la referencia es el azul de MaKo; al pasar el cursor, más oscuro (.14 s). */
.d-copywriting-btn { display: inline-block; padding: 16px 28px; border-radius: 999px; background: ${AZUL}; color: #FBF6EA; text-decoration: none;
  font-family: var(--ui); font-size: 14px; line-height: 17.5px; font-weight: 700; white-space: nowrap; text-align: center; transition: background .14s, color .14s; }
.d-copywriting-btn:hover { background: ${PETROLEO}; }
.d-copywriting-link { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: ${PETROLEO}; text-decoration: underline;
  text-underline-offset: 4px; text-decoration-thickness: 1px; transition: color .14s; }
.d-copywriting-link:hover { color: ${AZUL}; }

/* El hero: dos columnas, 592 + 480, 44 de separación. */
.d-copywriting-hero { display: grid; grid-template-columns: 592px 480px; column-gap: 44px; justify-content: space-between; align-items: start; padding-top: 30px; padding-bottom: 52px; }
.d-copywriting-pildora { display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px; border-radius: 999px; background: #E3EBFC; color: ${PETROLEO};
  font-size: 11.5px; font-weight: 700; letter-spacing: 1.38px; text-transform: uppercase; }
.d-copywriting-pildora::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.d-copywriting-h1 { margin-top: 22px; font-family: var(--serif); font-size: 62px; line-height: 62px; font-weight: 400; letter-spacing: -0.93px; color: var(--tinta); }
.d-copywriting-h1 strong { font-weight: 400; color: ${AZUL}; }
.d-copywriting-bajada { margin-top: 27px; max-width: 573px; font-size: 18.5px; line-height: 29.6px; color: var(--cuerpo); }
.d-copywriting-bajada strong { font-weight: 700; color: var(--tinta); }
.d-copywriting-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 32px; }
.d-copywriting-checks { margin-top: 13px; display: flex; flex-direction: column; gap: 10px; max-width: 592px; }
.d-copywriting-checks li { position: relative; padding-left: 31px; font-size: 16px; line-height: 23.2px; color: var(--cuerpo); }
.d-copywriting-checks li strong { font-weight: 600; color: var(--tinta); }
.d-copywriting-checks li::before { content: ''; position: absolute; left: 0; top: 2px; width: 20px; height: 20px; border-radius: 50%; background: ${PETROLEO}; }
.d-copywriting-checks li::after { content: ''; position: absolute; left: 7px; top: 6px; width: 5px; height: 9px; border: solid #FBF6EA; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.d-copywriting-noprompt { margin-top: 34px; max-width: 552px; font-family: var(--serif); font-size: 23px; line-height: 28.06px; letter-spacing: -0.115px; color: rgba(25,21,18,.62); }
.d-copywriting-noprompt strong { font-weight: 400; color: var(--tinta); }
.d-copywriting-tarjeta { background: var(--papel); border: 1px solid var(--linea); border-radius: 16px; padding: 20px 18px; }
/* Como su imagen de 442 × 548: el titular arriba, la raya de color con la línea mono, la «foto» (aquí la pared) que llena el medio
   y el pie mono abajo. */
.d-copywriting-cuadro { min-height: 548px; border-radius: 8px; background: #F3E9D6; display: flex; align-items: stretch; padding: 16px 20px 12px; }
.d-copywriting-cuadro > * { width: 100%; }
.d-copywriting-tarjeta .d-copywriting-btn { display: block; margin-top: 16px; padding: 13px 20px; }
.d-copywriting-vistazo { margin-top: 14px; border-top: 1px solid var(--linea-2); }
.d-copywriting-vistazo summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 2px 10px;
  font-family: var(--mono); font-size: 11.5px; font-weight: 700; letter-spacing: 1.84px; text-transform: uppercase; color: var(--tinta); }
.d-copywriting-vistazo summary::-webkit-details-marker { display: none; }
.d-copywriting-mas { flex: none; width: 22px; height: 22px; border: 1px solid var(--tinta); border-radius: 99px; display: flex; align-items: center; justify-content: center;
  font-family: var(--ui); font-size: 14px; line-height: 14px; transition: transform .14s ease; }
.d-copywriting-mas::before { content: '+'; }
.d-copywriting-vistazo summary:hover .d-copywriting-mas { background: var(--tinta); color: var(--papel); }
.d-copywriting-vistazo[open] .d-copywriting-mas { transform: rotate(45deg); }
.d-copywriting-celdas { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; padding: 12px 0 2px; }
.d-copywriting-celda { padding: 10px 12px; border: 1px solid var(--linea); border-radius: 8px; background: var(--papel); }
.d-copywriting-celda:first-child, .d-copywriting-celda:last-child:nth-child(even) { grid-column: 1 / -1; }
.d-copywriting-celda-l { display: block; font-family: var(--mono); font-size: 10.5px; font-weight: 700; letter-spacing: 1.365px; color: var(--gris); }
.d-copywriting-celda-v { display: block; margin-top: 2px; font-size: 13px; line-height: 17.55px; font-weight: 600; color: var(--tinta); }

/* La banda de los ejemplos (su examples.css): cerrada, una franja salvia del ancho de la página con la franja que se toca adentro
   del contenedor; abierta, la franja se va, el fondo pasa a #FFFDF7 y se abre lo de adentro (filas 0fr → 1fr). */
.d-copywriting-ejemplos { position: relative; background: #E8ECDF; border-top: 1px solid #CBD1BF; border-bottom: 1px solid #CBD1BF; scroll-margin-top: 24px; }
.d-copywriting-ejemplos:has(> .d-copywriting-abre:checked) { background: #FFFDF7; border-color: var(--linea); padding-bottom: 40px; }
.d-copywriting-abre { position: absolute; top: 24px; left: 50%; width: 1px; height: 1px; margin: 0; opacity: 0; pointer-events: none; }
.d-copywriting-toggle { display: flex; align-items: center; gap: 26px; padding-block: 24px; cursor: pointer; color: #153F39; }
.d-copywriting-abre:checked ~ .d-copywriting-toggle { display: none; }
.d-copywriting-abre:focus-visible ~ .d-copywriting-toggle { outline: 3px solid ${PETROLEO}; outline-offset: 4px; }
.d-copywriting-caras { display: flex; flex: none; padding-left: 8px; }
.d-copywriting-cara { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--papel); color: ${PETROLEO};
  border: 3px solid #E8ECDF; margin-left: -8px; }
.d-copywriting-cara img { display: block; width: 100%; height: 100%; object-fit: cover; }
.d-copywriting-toggle-t { flex: 1; min-width: 0; }
.d-copywriting-toggle-h { display: block; font-family: var(--serif); font-weight: 400; font-size: 29px; line-height: 34.8px; letter-spacing: -0.5px; color: #153A6E; }
.d-copywriting-toggle-s { display: block; margin-top: 8px; font-size: 12px; color: #526355; }
.d-copywriting-toggle-a { flex: none; display: flex; align-items: center; gap: 15px; font-size: 11px; font-weight: 600; color: ${PETROLEO}; }
.d-copywriting-flecha { position: relative; width: 40px; height: 40px; border-radius: 50%; background: ${AZUL}; color: #FBF6EA; display: flex; align-items: center; justify-content: center;
  animation: dCopyPulso 3.2s ease-in-out infinite; }
.d-copywriting-flecha svg { display: block; animation: dCopyFlecha 3.2s ease-in-out infinite; }
.d-copywriting-toggle:hover .d-copywriting-flecha { background: ${PETROLEO}; }
@keyframes dCopyPulso { 0%, 65%, 100% { box-shadow: 0 0 0 0 rgba(47,111,237,0); } 30% { box-shadow: 0 0 0 5px rgba(47,111,237,.094); } }
@keyframes dCopyFlecha { 0%, 65%, 100% { transform: translateY(-1px); } 28%, 42% { transform: translateY(2px); } }
.d-copywriting-revela { display: grid; grid-template-rows: 0fr; opacity: 0; visibility: hidden;
  transition: grid-template-rows .55s cubic-bezier(.22,1,.36,1), opacity .35s, visibility 0s linear .55s; }
.d-copywriting-abre:checked ~ .d-copywriting-revela { grid-template-rows: 1fr; opacity: 1; visibility: visible; transition-delay: 0s; }
.d-copywriting-revela-in { overflow: hidden; min-height: 0; }
.d-copywriting-exh { padding-top: 48px; margin-bottom: 30px; }
.d-copywriting-exh h2 { max-width: 850px; margin: 0 0 20px; font-family: var(--serif); font-weight: 400; font-size: 46px; line-height: 51.52px; letter-spacing: -1.2px; color: var(--tinta); text-wrap: balance; }
.d-copywriting-exh h2:focus { outline: none; }
.d-copywriting-exh h2 em { color: ${PETROLEO}; }
.d-copywriting-intro { max-width: 730px; font-size: 16px; line-height: 26.4px; color: var(--cuerpo); }
.d-copywriting-tabs > .d-copywriting-radio { position: absolute; opacity: 0; pointer-events: none; }
.d-copywriting-pestanas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 22px; }
.d-copywriting-pestana { display: flex; align-items: center; gap: 13px; min-height: 85px; padding: 18px; border: 1px solid var(--linea); border-radius: 8px; background: var(--papel); color: var(--tinta);
  cursor: pointer; transition: background .16s, box-shadow .16s; }
.d-copywriting-pestana-i { flex: none; width: 44px; height: 44px; border-radius: 50%; background: #E3EBFC; color: ${PETROLEO}; display: flex; align-items: center; justify-content: center; }
.d-copywriting-pestana strong { display: block; font-size: 16px; font-weight: 700; }
.d-copywriting-pestana small { display: block; margin-top: 5px; font-size: 14px; opacity: .75; }
#d-copywriting-t0:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t0"],
#d-copywriting-t1:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t1"],
#d-copywriting-t2:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t2"] { background: var(--tinta); border-color: var(--tinta); color: #FBF6EA; }
#d-copywriting-t0:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t0"] .d-copywriting-pestana-i,
#d-copywriting-t1:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t1"] .d-copywriting-pestana-i,
#d-copywriting-t2:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t2"] .d-copywriting-pestana-i { background: ${AZUL}; color: #FBF6EA; }
.d-copywriting-tabs > .d-copywriting-radio:focus-visible ~ .d-copywriting-pestanas { outline: 3px solid ${PETROLEO}; outline-offset: 4px; }
/* Las pestañas llevan data-tema-fijo (el sol y la luna lee los colores al cargar y dejaba la elegida clara para siempre): su modo
   oscuro va aquí, al revés que en el claro (la elegida en crema sobre la página oscura). */
html[data-sitio-modo="oscuro"] .d-copywriting-pestana { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.16); color: #E8EAF0; }
html[data-sitio-modo="oscuro"] #d-copywriting-t0:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t0"],
html[data-sitio-modo="oscuro"] #d-copywriting-t1:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t1"],
html[data-sitio-modo="oscuro"] #d-copywriting-t2:checked ~ .d-copywriting-pestanas label[for="d-copywriting-t2"] { background: var(--crema); border-color: var(--crema); color: var(--tinta); }
.d-copywriting-panel { display: none; }
#d-copywriting-t0:checked ~ .d-copywriting-p0, #d-copywriting-t1:checked ~ .d-copywriting-p1, #d-copywriting-t2:checked ~ .d-copywriting-p2 { display: block; }
/* La comparación (su .compare-grid): dos paneles blancos de borde fino; el de la reescritura con el borde de color. */
.d-copywriting-cmpgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
.d-copywriting-cmp { min-width: 0; border: 1px solid #D9D1C2; border-radius: 10px; overflow: hidden; background: #fff; }
.d-copywriting-cmp--mako, .d-copywriting-cmp--video { border-color: #8FA6C9; }
.d-copywriting-cmp header { height: 51px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #E7E2D9; background: #FFFCF6; }
.d-copywriting-cmp header > span { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; color: var(--tinta); }
.d-copywriting-cmp header i { width: 6px; height: 6px; border: 1px solid #877B69; border-radius: 50%; }
.d-copywriting-cmp--mako header { background: #E9EEF6; }
.d-copywriting-cmp--mako header i, .d-copywriting-cmp-der i { border-color: ${PETROLEO}; background: ${PETROLEO}; }
.d-copywriting-cmp .d-copywriting-lienzo { height: 570px; overflow: auto; background: #fff; scrollbar-width: thin; scrollbar-color: #CCC3B4 transparent; }
.d-copywriting-cmp footer { min-height: 42px; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid #E7E2D9;
  font-family: var(--mono); font-size: 10px; color: #696053; background: #FFFCF6; }
/* El video es la comparación entera: centrado en el alto de su lienzo (570), sobre el mismo gris claro de la grabación. */
.d-copywriting-cmp--video .d-copywriting-lienzo { display: flex; align-items: center; justify-content: center; overflow: hidden; background: #F6F7F9; }
.d-copywriting-cmp--video video { display: block; height: 100%; max-width: 100%; aspect-ratio: 960 / 600; object-fit: contain; }
/* El original: su anuncio como se lee en la Biblioteca de Meta (el texto, el destino y su título). */
.d-copywriting-aviso { max-width: 440px; margin: 0 auto; padding: 34px 28px; text-align: left; color: #1C1E21; font-family: Helvetica, Arial, sans-serif; }
.d-copywriting-aviso-de { display: flex; align-items: center; gap: 10px; }
.d-copywriting-aviso-av { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: #E4E6EB; color: #1C1E21; font-size: 14px; font-weight: 700; }
.d-copywriting-aviso-de strong { display: block; font-size: 15px; }
.d-copywriting-aviso-de small { display: block; margin-top: 2px; font-size: 12px; color: #65676B; }
.d-copywriting-aviso-t { margin-top: 14px; font-size: 16px; line-height: 1.5; }
.d-copywriting-aviso-pie { margin-top: 18px; padding: 12px 14px; border-radius: 8px; background: #F0F2F5; }
.d-copywriting-aviso-pie small { display: block; font-size: 12px; text-transform: uppercase; color: #65676B; }
.d-copywriting-aviso-pie strong { display: block; margin-top: 3px; font-size: 16px; }
/* Lo que escribió MaKo, como su «My rewrite»: el texto en Georgia, con el nombre de cada sección arriba. */
.d-copywriting-reescrito { padding: 34px 30px 30px; background: #F6F2E9; min-height: 100%; color: #292820; }
.d-copywriting-reescrito-e { font-size: 12px; line-height: 19.2px; letter-spacing: 1.4px; text-transform: uppercase; color: #907438; }
.d-copywriting-reescrito h3 { margin: 12px 0 22px; font-family: Georgia, serif; font-weight: 400; font-size: 34px; line-height: 38.42px; letter-spacing: -0.6px; }
.d-copywriting-reescrito-s { margin-top: 18px; font-size: 12px; line-height: 19.2px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: ${PETROLEO}; }
.d-copywriting-reescrito-t { margin-top: 4px; font-family: Georgia, serif; font-size: 17px; line-height: 1.6; }
.d-copywriting-lado-r { position: absolute; opacity: 0; pointer-events: none; }
.d-copywriting-tel { display: none; }
.d-copywriting-lados { display: none; }
/* Su «What changed»: la raya de color a la izquierda y el rótulo en mono. */
.d-copywriting-cambio { margin-top: 18px; padding: 14px 18px; border-left: 3px solid ${PETROLEO}; background: rgba(31,87,200,.05); font-size: 16px; line-height: 1.6; color: var(--cuerpo); }
.d-copywriting-cambio > span:first-child { display: block; margin-bottom: 2px; font-family: var(--mono); font-size: 11px; line-height: 1.6; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${PETROLEO}; }
.d-copywriting-exfin { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--linea); }
.d-copywriting-exfin p { font-size: 12px; line-height: 19.2px; color: #7A7062; }

/* El caso: su «What buyers wrote back», papel #FBF6EA, la cabecera con las flechas y el riel de tarjetas sin fin. */
.d-copywriting-caso { background: var(--papel); border-bottom: 1px solid var(--linea); padding: 46px 0 34px; overflow: hidden; }
.d-copywriting-caso-cab { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 26px; }
.d-copywriting-caso-h { margin: 12px 0 10px; max-width: 640px; font-family: var(--serif); font-weight: 400; font-size: 40px; line-height: 43.2px; letter-spacing: -0.7px; }
.d-copywriting-caso-p { max-width: 58ch; font-size: 15px; line-height: 24px; color: var(--cuerpo); }
.d-copywriting-flechas { display: flex; gap: 8px; flex-shrink: 0; padding-bottom: 6px; }
.d-copywriting-flechita { width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--tinta); display: grid; place-items: center; color: var(--tinta); font-size: 20px; line-height: 1;
  cursor: pointer; user-select: none; transition: background .15s, color .15s, opacity .15s; }
.d-copywriting-flechita:hover { background: var(--tinta); color: var(--crema); }
.d-copywriting-fichas { position: relative; display: flex; gap: 16px; margin: 0 -32px; padding: 4px 32px 10px; overflow-x: auto; scroll-snap-type: x proximity; scroll-padding-left: 32px;
  scrollbar-width: none; overscroll-behavior-x: contain;
  --borde: 32px; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 var(--borde), #000 calc(100% - var(--borde)), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 var(--borde), #000 calc(100% - var(--borde)), transparent 100%); }
.d-copywriting-fichas::-webkit-scrollbar { display: none; }
.d-copywriting-fichas:focus-visible { outline: 2px solid ${PETROLEO}; outline-offset: 4px; border-radius: 8px; }
.d-copywriting-ficha { position: relative; flex: 0 0 372px; min-height: 452px; margin: 0; display: flex; flex-direction: column; gap: 18px; padding: 28px 24px 22px; border-radius: 16px;
  background: var(--papel-2); border: 1px solid var(--linea); scroll-snap-align: start; }
.d-copywriting-ficha--tinta { background: var(--tinta); border-color: var(--tinta); color: var(--crema); }
.d-copywriting-ficha blockquote { flex: 1; margin: 0; padding-top: 20px; font-size: 15px; line-height: 24px; }
.d-copywriting-ficha blockquote p + p { margin-top: 12px; }
.d-copywriting-ficha blockquote strong { font-weight: 700; }
.d-copywriting-ficha figcaption { display: flex; align-items: center; gap: 12px; padding-top: 16px; border-top: 1px solid var(--linea-2); }
.d-copywriting-ficha--tinta figcaption { border-top-color: #3A332B; }
.d-copywriting-mono { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: #E3EBFC; color: ${PETROLEO};
  font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: .72px; }
.d-copywriting-ficha--tinta .d-copywriting-mono { background: ${AZUL}; color: #FBF6EA; }
.d-copywriting-quien { display: block; font-size: 14px; line-height: 18.2px; font-weight: 700; }
.d-copywriting-rol { display: block; margin-top: 3px; font-family: var(--mono); font-size: 12px; line-height: 18px; color: var(--gris); }
.d-copywriting-ficha--tinta .d-copywriting-rol { color: #B6A98D; }
.d-copywriting-ficha--video { padding: 0; overflow: hidden; background: var(--tinta); }
/* El video no pone el alto de la fila (es vertical): llena la tarjeta, que mide lo que las otras. */
.d-copywriting-ficha--video video { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }

/* «Empieza por el copy…»: columnas con un filete entre ellas. */
.d-copywriting-usos { padding: 48px 0; }
.d-copywriting-cejilla { font-family: var(--mono); font-size: 12px; line-height: 19.2px; font-weight: 700; letter-spacing: 1.56px; text-transform: uppercase; color: ${PETROLEO}; }
.d-copywriting-usos .d-copywriting-cejilla, .d-copywriting-usos-h { text-align: center; }
.d-copywriting-usos-h { margin-top: 15px; font-family: var(--serif); font-size: 36px; line-height: 43.2px; letter-spacing: -0.5px; }
.d-copywriting-cols { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin-top: 31px; }
.d-copywriting-col { padding: 0 26px 0 25px; border-left: 1px solid var(--linea); }
.d-copywriting-col:first-child { padding-left: 0; border-left: 0; }
.d-copywriting-simbolo { width: 38px; height: 38px; border-radius: 8px; background: #EEE9DB; color: ${PETROLEO}; display: inline-grid; place-items: center; margin-bottom: 17px; }
.d-copywriting-col h3 { font-family: var(--serif); font-size: 20px; line-height: 24px; font-weight: 400; margin-bottom: 10px; }
.d-copywriting-col p { font-size: 16px; line-height: 26.4px; color: #5B5245; margin-bottom: 13px; }
.d-copywriting-col small { display: block; font-size: 12px; line-height: 19.2px; color: #847763; }
.d-copywriting-otro { margin-top: 30px; padding-top: 22px; border-top: 1px solid var(--linea); text-align: center; font-size: 14px; line-height: 23.8px; color: var(--gris); }

/* La banda de tinta: tres columnas (400 / 364 / 280). */
.d-copywriting-tinta { background: var(--tinta); color: var(--crema); padding: 34px 0; }
.d-copywriting-tinta-grid { display: grid; grid-template-columns: 400px 364px 280px; gap: 36px; align-items: center; justify-content: space-between; }
.d-copywriting-tinta-l { font-size: 11px; font-weight: 800; letter-spacing: 2.86px; text-transform: uppercase; color: #D8CDB3; margin-bottom: 12px; }
.d-copywriting-tinta-h { font-family: var(--serif); font-size: 29px; line-height: 36.25px; font-weight: 400; color: var(--crema); }
.d-copywriting-tinta-p { font-size: 15.5px; line-height: 25.575px; color: #D8CDB3; }
.d-copywriting-tinta-p strong { color: var(--crema); font-weight: 700; }
.d-copywriting-muro { width: 280px; height: 280px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 14px; padding: 8px 6px;
  /* Su «papel tapiz»: las juntas entre los bloques, finas y claras (dos verticales y tres horizontales, en el medio de cada hueco). */
  background:
    linear-gradient(90deg, transparent 92.5px, rgba(247,239,221,.42) 92.5px 93.5px, transparent 93.5px 186.5px, rgba(247,239,221,.42) 186.5px 187.5px, transparent 187.5px),
    linear-gradient(180deg, transparent 71px, rgba(247,239,221,.42) 71px 72px, transparent 72px 134.5px, rgba(247,239,221,.42) 134.5px 135.5px, transparent 135.5px 198px, rgba(247,239,221,.42) 198px 199px, transparent 199px); }
.d-copywriting-muro span { position: relative; border-radius: 6px; background: #F7EFDD; box-shadow: 0 6px 0 -5px #6B6155; }
.d-copywriting-muro span::before { content: ''; position: absolute; left: 8px; right: 8px; top: 9px; height: 26px;
  background: linear-gradient(#E2CFA7 0 6px, transparent 6px 10px, #E2CFA7 10px 16px, transparent 16px 20px, #E2CFA7 20px 26px) no-repeat; background-size: 85% 100%; }
.d-copywriting-muro span.d-copywriting-muro-uno { background: ${AZUL}; }
.d-copywriting-muro span.d-copywriting-muro-uno::before { background: linear-gradient(-14deg, transparent 40%, #1F57C8 40% 60%, transparent 60%); left: 10px; right: 10px; top: 14px; height: 18px; background-size: 100% 100%; }

/* «Lo que incluye»: la lista numerada en una tarjeta. */
.d-copywriting-seccion { padding-top: 56px; }
.d-copywriting-cabeza { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 3px double var(--tinta); }
.d-copywriting-cabeza h2 { font-family: var(--serif); font-size: 44px; line-height: 44px; font-weight: 400; }
.d-copywriting-kicker { font-size: 11px; font-weight: 700; letter-spacing: 2.42px; text-transform: uppercase; color: var(--gris); padding-bottom: 6px; text-align: right; }
.d-copywriting-lista { margin-top: 23px; background: var(--papel); border: 1px solid var(--linea); border-radius: 16px; overflow: hidden; }
.d-copywriting-fila { display: grid; grid-template-columns: 36px 1fr; column-gap: 38px; padding: 22px 26px; }
.d-copywriting-fila + .d-copywriting-fila { border-top: 1px solid var(--linea); }
.d-copywriting-fila--feature { background: var(--papel-2); }
/* Su renglón 6 con el estante de libros a la derecha (una imagen de 147 px centrada en una columna de 210): aquí, 16 caricaturas
   de los referentes en una grilla de 4. */
.d-copywriting-fila--visual { grid-template-columns: 36px 1fr 210px; align-items: start; }
.d-copywriting-estante { align-self: center; justify-self: center; width: 147px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 8px; border-radius: 10px;
  background: linear-gradient(180deg, #ECE3D0 0%, #E4D7BE 100%); box-shadow: inset 0 -10px 18px rgba(120,90,50,.08); }
.d-copywriting-estante li { aspect-ratio: 1; border-radius: 6px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(50,40,25,.18); }
.d-copywriting-estante img { display: block; width: 100%; height: 100%; object-fit: cover; }
.d-copywriting-num { width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: ${PETROLEO}; color: var(--crema);
  font-family: var(--serif); font-size: 17px; }
.d-copywriting-fila--feature .d-copywriting-num { background: ${MAKO.dorado}; color: var(--tinta); }
.d-copywriting-fila h3 { font-family: var(--serif); font-size: 27px; line-height: 29.7px; font-weight: 400; margin-bottom: 8px; }
.d-copywriting-fila p { max-width: 949px; font-size: 15px; line-height: 24.75px; color: var(--cuerpo); }
.d-copywriting-fila p strong { color: var(--tinta); font-weight: 700; }

/* La fila de tres: el panel azul (su petróleo), «para quién es» y «para quién no es». */
.d-copywriting-tres { display: grid; grid-template-columns: 412px 330px 330px; gap: 22px; justify-content: space-between; align-items: stretch; }
.d-copywriting-panelazul { background: ${PETROLEO}; color: var(--crema); border-radius: 20px; padding: 34px 32px; }
.d-copywriting-panelazul-l { font-size: 11px; line-height: 18.15px; font-weight: 800; letter-spacing: 2.86px; text-transform: uppercase; color: #BFD2F7; margin-bottom: 16px; }
.d-copywriting-panelazul-h { font-family: var(--serif); font-size: 30px; line-height: 36px; margin-bottom: 16px; }
.d-copywriting-panelazul-p { font-size: 15.5px; line-height: 25.575px; color: #D9E4FA; }
.d-copywriting-panelazul-p + .d-copywriting-panelazul-p { margin-top: 12px; }
.d-copywriting-panelazul-p strong { color: var(--crema); font-weight: 700; }
.d-copywriting-card { background: var(--papel); border: 1px solid var(--linea); border-radius: 16px; padding: 26px 24px; }
.d-copywriting-card-l { font-size: 10.5px; font-weight: 800; letter-spacing: 2.52px; text-transform: uppercase; color: var(--gris); margin-bottom: 14px; }
.d-copywriting-card p { font-size: 14.5px; line-height: 23.2px; color: var(--cuerpo); }
.d-copywriting-card p + p { margin-top: 14px; }
.d-copywriting-card p.d-copywriting-inset { margin-top: 18px; padding: 13px 15px; border-radius: 10px; background: #E3EBFC; color: #153A6E; font-size: 13.5px; line-height: 21.6px; }
.d-copywriting-card p strong { color: var(--tinta); font-weight: 700; }
.d-copywriting-card--no { background: #F7E3D8; border-color: rgba(192, 73, 31, .28); }
.d-copywriting-card--no .d-copywriting-card-l { color: #A03D16; }
.d-copywriting-card--no p:not(.d-copywriting-card-l) { position: relative; padding-left: 28px; }
.d-copywriting-card--no p strong { color: #8F2418; }
.d-copywriting-card--no p:not(.d-copywriting-card-l)::before { content: '×'; position: absolute; left: 0; top: 3px; width: 16px; height: 16px; border: 1.5px solid #C0491F; border-radius: 50%; color: #C0491F;
  font-size: 13px; line-height: 13px; font-weight: 700; text-align: center; }

/* Las preguntas: su tarjeta «Questions». */
.d-copywriting-faq { background: var(--papel); border: 1px solid var(--linea); border-radius: 16px; padding: 24px 22px; }
.d-copywriting-faq-l { font-size: 10.5px; font-weight: 800; letter-spacing: 2.52px; text-transform: uppercase; color: var(--gris); padding-bottom: 14px; border-bottom: 2px solid var(--tinta); }
.d-copywriting-faq details { border-bottom: 1px solid var(--linea-2); }
.d-copywriting-faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0;
  font-size: 13.5px; line-height: 18px; font-weight: 600; color: var(--tinta); }
.d-copywriting-faq summary::-webkit-details-marker { display: none; }
.d-copywriting-faq summary::after { content: '+'; flex: none; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--linea); display: grid; place-items: center;
  font-size: 13px; line-height: 1; font-weight: 600; color: var(--gris); transition: background .14s, color .14s; }
.d-copywriting-faq details[open] summary::after { content: '−'; background: ${AZUL}; border-color: ${AZUL}; color: #FBF6EA; }
.d-copywriting-faq-r { padding-bottom: 13px; font-size: 13px; line-height: 20.15px; color: var(--cuerpo); }

/* El cierre. */
.d-copywriting-cierre { padding: 40px 0 64px; text-align: center; }
.d-copywriting-cierre h2 { margin-top: 33px; font-family: var(--serif); font-size: 40px; line-height: 42px; letter-spacing: -0.4px; font-weight: 400; }
.d-copywriting-cierre p { max-width: 560px; margin: 10px auto 20px; font-size: 16px; color: var(--cuerpo); }

/* La tarjeta del hero (12/11/2026): donde la referencia pone «The 14 books great copywriters learned from. Now your AI works
   from them too.» y la foto de la pila de libros, van los referentes de MaKo: el titular de su tarjeta (serif, la palabra de
   color), la línea mono con su regla, la pared de caricaturas (public/asesores/<id>.png) y su pie mono con «Inspirado en». */
.d-copywriting-refs { display: flex; flex-direction: column; gap: 0; width: 100%; }
.d-copywriting-refs-h { font-family: var(--serif); font-size: 31px; line-height: 31px; letter-spacing: -0.4px; color: var(--tinta); }
.d-copywriting-refs-h em { font-style: normal; color: ${AZUL}; }
.d-copywriting-refs-sub { margin-top: 14px; padding-top: 7px; border-top: 1.5px solid ${AZUL}; font-family: var(--mono); font-size: 11px; line-height: 14px;
  letter-spacing: .6px; text-transform: uppercase; color: var(--tinta); }
.d-copywriting-refs-pared { flex: 1; align-content: center; margin: 16px -20px 0; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; padding: 22px 20px; border-radius: 0;
  background: linear-gradient(180deg, #ECE3D0 0%, #E4D7BE 100%); box-shadow: inset 0 -10px 18px rgba(120,90,50,.08); }
.d-copywriting-refs-pared li { aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 1px 2px rgba(50,40,25,.18), 0 3px 8px rgba(50,40,25,.08); }
.d-copywriting-refs-pared img { display: block; width: 100%; height: 100%; object-fit: cover; }
.d-copywriting-refs-pie { margin-top: 12px; font-family: var(--mono); font-size: 10.5px; line-height: 14px; letter-spacing: .6px; text-transform: uppercase; color: var(--gris); }

/* El pie: la fila de productos (aquí, las funciones de MaKo) y la línea de abajo. */
.d-copywriting-pie { border-top: 1px solid var(--linea); }
.d-copywriting-productos { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 18px; padding: 27px 0 16px; border-bottom: 1px solid var(--linea); }
.d-copywriting-productos a { font-size: 11.5px; font-weight: 700; color: var(--cuerpo); text-decoration: none; transition: color .14s; }
.d-copywriting-productos a:hover { color: ${AZUL}; }
.d-copywriting-legal { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 21px 0 40px; font-family: var(--mono); font-size: 13px; color: var(--cuerpo); }
.d-copywriting-legal nav { display: flex; gap: 8px; }
.d-copywriting-legal nav a { color: ${PETROLEO}; text-underline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .d-copywriting-flecha, .d-copywriting-flecha svg { animation: none; }
  .d-copywriting-btn, .d-copywriting-link, .d-copywriting-faq summary::after, .d-copywriting-productos a, .d-copywriting-mas,
  .d-copywriting-revela, .d-copywriting-pestana, .d-copywriting-flechita { transition: none; }
}

@media (max-width: 1180px) {
  .d-copywriting-hero { grid-template-columns: minmax(0, 1fr) minmax(0, 420px); }
  .d-copywriting-tinta-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 280px; }
  .d-copywriting-tres { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr); }
}
@media (max-width: 900px) {
  .d-copywriting-cont { padding: 0 16px; }
  .d-copywriting-cont.d-copywriting-excont { padding-inline: 16px; }
  .d-copywriting-hero { grid-template-columns: minmax(0, 1fr); row-gap: 32px; }
  .d-copywriting-tinta-grid, .d-copywriting-tres { grid-template-columns: minmax(0, 1fr); }
  .d-copywriting-cols { grid-auto-flow: row; grid-template-columns: 1fr 1fr; gap: 28px 18px; }
  .d-copywriting-col, .d-copywriting-col:first-child { padding: 0; border-left: 0; }
}
/* A 390 px: una columna, 16 de margen, sus tamaños de teléfono. */
@media (max-width: 767px) {
  .d-copywriting-barra { padding: 14px 0; }
  .d-copywriting-pildora { padding: 5px 11px; font-size: 10.5px; letter-spacing: 1.26px; }
  .d-copywriting-h1 { font-size: 42.9px; line-height: 42.9px; letter-spacing: -0.64px; }
  /* Su orden a 390: el botón a lo ancho, los checks y después el link. */
  .d-copywriting-izq { display: flex; flex-direction: column; }
  .d-copywriting-izq .d-copywriting-pildora { align-self: flex-start; }
  .d-copywriting-acciones { display: contents; }
  .d-copywriting-acciones .d-copywriting-btn { order: 4; margin-top: 32px; padding: 16px 12px; }
  .d-copywriting-checks { order: 5; }
  .d-copywriting-acciones .d-copywriting-link { order: 6; align-self: center; margin-top: 14px; }
  .d-copywriting-noprompt { order: 7; margin-top: 26px; font-size: 21px; line-height: 26px; }
  .d-copywriting-checks li { font-size: 15px; line-height: 21.75px; }
  .d-copywriting-tarjeta { padding: 26px 24px; }
  .d-copywriting-cuadro { min-height: 0; padding: 14px 10px; }
  .d-copywriting-refs-h { font-size: 26px; line-height: 27px; }
  .d-copywriting-refs-pared { gap: 4px; padding: 10px 10px; margin: 12px -10px 0; }
  .d-copywriting-refs-pared li { border-radius: 6px; }
  /* Su franja en el teléfono: las caras y el botón arriba, el titular debajo a lo ancho. */
  .d-copywriting-toggle { flex-wrap: wrap; gap: 17px; padding-block: 20px; }
  .d-copywriting-caras { order: 0; margin-bottom: 9px; }
  .d-copywriting-toggle-a { order: 1; margin-left: auto; }
  .d-copywriting-toggle-t { order: 2; flex: 1 1 100%; }
  .d-copywriting-toggle-h { font-size: 25px; line-height: 28.75px; }
  .d-copywriting-toggle-s { font-size: 14px; line-height: 21px; }
  .d-copywriting-exh { padding-top: 32px; margin-bottom: 26px; }
  .d-copywriting-exh h2 { font-size: 36px; line-height: 41.4px; letter-spacing: -0.8px; }
  .d-copywriting-exh h2 br { display: none; }
  .d-copywriting-exh h2 em { display: block; }
  .d-copywriting-ancho { display: none; }
  .d-copywriting-tel { display: inline; }
  .d-copywriting-pestanas { gap: 6px; margin-bottom: 16px; }
  .d-copywriting-pestana { display: block; min-height: 120px; padding: 14px 8px; text-align: center; }
  .d-copywriting-pestana-i { width: 38px; height: 38px; margin: 0 auto 9px; }
  .d-copywriting-pestana strong { font-size: 14px; }
  .d-copywriting-pestana small { margin-top: 4px; font-size: 12px; line-height: 1.35; }
  /* Su «Original | My rewrite» del teléfono: dos pestañas con la raya abajo; se ve un lado a la vez. */
  .d-copywriting-lados { display: flex; margin: 0 0 16px; border-bottom: 2px solid #D7CFBF; }
  .d-copywriting-lados label { flex: 1; min-height: 48px; display: flex; align-items: center; justify-content: center; margin-bottom: -2px; border-bottom: 3px solid transparent;
    font-size: 15px; font-weight: 600; color: #776D5F; cursor: pointer; }
  .d-copywriting-lado-o:checked ~ .d-copywriting-lados label:first-child, .d-copywriting-lado-m:checked ~ .d-copywriting-lados label:last-child { color: ${PETROLEO}; border-bottom-color: ${PETROLEO}; }
  .d-copywriting-lado-r:focus-visible ~ .d-copywriting-lados { outline: 2px solid ${PETROLEO}; outline-offset: 3px; }
  .d-copywriting-cmpgrid { grid-template-columns: 1fr; gap: 0; }
  .d-copywriting-lado-m:checked ~ .d-copywriting-cmpgrid .d-copywriting-cmp--orig, .d-copywriting-lado-o:checked ~ .d-copywriting-cmpgrid .d-copywriting-cmp--mako { display: none; }
  .d-copywriting-cmp header { padding: 0 13px; }
  .d-copywriting-cmp:not(.d-copywriting-cmp--video) .d-copywriting-lienzo { height: auto; max-height: 760px; min-height: 460px; }
  .d-copywriting-cmp footer { font-size: 9px; gap: 8px; }
  .d-copywriting-cmp--video header > span { font-size: 12px; }
  .d-copywriting-cmp--video .d-copywriting-lienzo { height: auto; }
  .d-copywriting-cmp--video video { width: 100%; height: auto; }
  .d-copywriting-reescrito { padding: 25px 20px 24px; }
  .d-copywriting-reescrito h3 { font-size: 30px; line-height: 34px; }
  .d-copywriting-aviso { padding: 26px 20px; }
  .d-copywriting-cambio { padding: 12px 14px; font-size: 15px; line-height: 24px; }
  .d-copywriting-ejemplos:has(> .d-copywriting-abre:checked) { padding-bottom: 28px; }
  .d-copywriting-caso { padding: 40px 0 32px; }
  .d-copywriting-caso-h { font-size: 31px; line-height: 33.48px; }
  .d-copywriting-caso-p { font-size: 14px; line-height: 22.4px; }
  .d-copywriting-caso-cab { flex-direction: column; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
  .d-copywriting-flechas { display: none; }
  .d-copywriting-fichas { --borde: 16px; gap: 12px; padding: 4px 16px 8px; margin: 0 -16px; scroll-padding-left: 16px; }
  .d-copywriting-ficha { flex-basis: min(84vw, 340px); padding: 24px 20px 20px; }
  .d-copywriting-ficha blockquote { font-size: 14.5px; }
  .d-copywriting-ficha--video { padding: 0; }
  .d-copywriting-usos { padding: 36px 0; }
  .d-copywriting-usos .d-copywriting-cejilla, .d-copywriting-usos-h { text-align: left; }
  .d-copywriting-usos-h { font-size: 28px; line-height: 33.6px; }
  .d-copywriting-col h3 { font-size: 22px; line-height: 26.4px; }
  .d-copywriting-otro { text-align: left; }
  .d-copywriting-tinta-grid { gap: 14px; }
  .d-copywriting-seccion { padding-top: 32px; }
  .d-copywriting-cabeza { flex-direction: column; align-items: flex-start; gap: 8px; }
  .d-copywriting-cabeza h2 { font-size: 32px; line-height: 34px; }
  .d-copywriting-kicker { text-align: left; padding-bottom: 0; }
  .d-copywriting-fila { padding: 18px 16px; column-gap: 22px; }
  .d-copywriting-fila--visual { grid-template-columns: 36px 1fr; }
  .d-copywriting-estante { grid-column: 1 / -1; justify-self: center; width: 100%; max-width: 240px; margin-top: 14px; }
  .d-copywriting-cierre { padding: 32px 0 48px; }
  .d-copywriting-cierre h2 { font-size: 30px; line-height: 31.5px; letter-spacing: -0.3px; }
  .d-copywriting-legal { flex-direction: column; align-items: flex-start; }
}
`;

type Tarjetas = Extract<Bloque, { tipo: 'tarjetas' }>;

/**
 * Los referentes, en el cuadro de la tarjeta del hero (donde la referencia pone su pila de 14 libros). Contados del catálogo
 * (lib/asesores/catalogo.ts), con su caricatura y «Inspirado en»: ninguno participa en MaKo ni la respalda. Que su método
 * llega a tu IA es el chat con un referente (lib/asesores/contexto.ts → contextoDeReferente, en cada mensaje).
 */
function Referentes() {
  return (
    <div className="d-copywriting-refs">
      <p className="d-copywriting-refs-h">Los {ASESORES.length} referentes del marketing que MaKo estudió. Ahora <em>tu IA</em> puede trabajar con su método.</p>
      {/* Su «WHAT THEY TEACH, IN 424,000 WORDS. INSTALLED IN 5 MINUTES.» bajo la raya de color. */}
      <p className="d-copywriting-refs-sub">Lo que enseñan, destilado de sus cursos.</p>
      <ul className="d-copywriting-refs-pared">
        {ASESORES.map((a) => (
          // eslint-disable-next-line @next/next/no-img-element
          <li key={a.id} title={`${inspiradoEn(a)} · ${a.especialidad}`}><img src={`/asesores/${a.id}.png`} alt={inspiradoEn(a)} width={200} height={200} loading="lazy" decoding="async" /></li>
        ))}
      </ul>
      <p className="d-copywriting-refs-pie">Inspirado en su método · Ninguno participa en MaKo ni la respalda</p>
    </div>
  );
}

function Icono({ paths, tam = 20 }: { paths?: string[]; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(paths ?? []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function Boton() {
  return <a href={RUTA_CTA} className="d-copywriting-btn">{TEXTO_CTA}</a>;
}

/** Un renglón «titulo texto» con el comienzo en negrita, como sus checks y sus «Who it's for». */
const renglon = (it: { titulo: string; texto: string }) => html(`<strong>${it.titulo}</strong> ${it.texto}`);
const sinEtiquetas = (s: string) => s.replace(/<[^>]+>/g, '');

const FLECHA_ABAJO = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/**
 * La banda de ejemplos, como su «Three real pages and ads, rewritten» (examples.js de la referencia): cerrada es una franja salvia
 * con las caras, el titular y un botón redondo que late; al tocarla la franja se va y se abre (las filas de 0fr a 1fr en ,55 s y la
 * opacidad en ,35 s) «Mira lo que hace Copywriting con una pieza real», con sus pestañas y la comparación del original con lo que
 * escribió MaKo. Sin JavaScript también anda: la franja es el rótulo de una casilla (un <button> sin onClick lo marca
 * tests/ningun-boton-muerto) y las pestañas son radios. El script sólo la abre desde el link del hero, pone el foco en el titular
 * y corre el video de la pestaña que se ve. Las piezas son reales: ../copywriting.ts → REPLICAS.
 */
function Ejemplos({ b }: { b: Tarjetas }) {
  const reps = b.items.map((it) => REPLICAS.find((r) => r.titulo === sinEtiquetas(it.titulo)));
  return (
    <section className="d-copywriting-ejemplos" id="d-copywriting-ejemplos" aria-label={sinEtiquetas(b.titulo)}>
      <input type="checkbox" id="d-copywriting-abre" className="d-copywriting-abre" aria-controls="d-copywriting-revela" aria-label={`${sinEtiquetas(b.titulo)}: ver los ejemplos`} />
      <label htmlFor="d-copywriting-abre" className="d-copywriting-cont d-copywriting-excont d-copywriting-toggle">
        <span className="d-copywriting-caras" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="d-copywriting-cara"><img src="/asesores/hormozi.png" alt="" width={44} height={44} /></span>
          {b.items.map((it, j) => <span key={j} className="d-copywriting-cara"><Icono paths={it.icono} tam={18} /></span>)}
        </span>
        <span className="d-copywriting-toggle-t">
          <strong className="d-copywriting-toggle-h" dangerouslySetInnerHTML={html(b.titulo)} />
          <small className="d-copywriting-toggle-s" dangerouslySetInnerHTML={html(b.etiqueta ?? '')} />
        </span>
        <span className="d-copywriting-toggle-a"><span className="d-copywriting-toggle-l">Ver los ejemplos</span><span className="d-copywriting-flecha">{FLECHA_ABAJO}</span></span>
      </label>
      <div className="d-copywriting-revela" id="d-copywriting-revela">
        <div className="d-copywriting-revela-in">
          <div className="d-copywriting-cont d-copywriting-excont">
            <div className="d-copywriting-exh">
              {/* Su «See what the Copy Machine does to a real page.», con la segunda mitad en itálica de color. */}
              <h2 id="d-copywriting-ej-h" tabIndex={-1}>Mira lo que hace Copywriting<br /> <em>con una pieza real.</em></h2>
              {/* Su intro termina distinto en la computadora y en el teléfono («Original on the left…» / «Tap Original or My rewrite…»). */}
              <p className="d-copywriting-intro"><span dangerouslySetInnerHTML={html(b.bajada ?? '')} /> <span className="d-copywriting-ancho">El original a la izquierda, lo que escribió MaKo a la derecha.</span><span className="d-copywriting-tel">Toca cada pestaña para ver el original y lo que escribió MaKo.</span></p>
            </div>
            <div className={`d-copywriting-tabs d-copywriting-tabs--${b.items.length}`}>
              {b.items.map((it, j) => <input key={j} type="radio" name="d-copywriting-tab" id={`d-copywriting-t${j}`} className="d-copywriting-radio" defaultChecked={j === 0} aria-label={sinEtiquetas(it.titulo)} />)}
              {/* data-tema-fijo: la pestaña elegida es de tinta en los dos modos (el sol y la luna la aclaraba al cargar y quedaba clara). */}
              <div className="d-copywriting-pestanas" aria-hidden="true" data-tema-fijo="">
                {b.items.map((it, j) => (
                  <label key={j} htmlFor={`d-copywriting-t${j}`} className="d-copywriting-pestana">
                    <span className="d-copywriting-pestana-i"><Icono paths={it.icono} /></span>
                    <span><strong dangerouslySetInnerHTML={html(it.titulo)} /><small dangerouslySetInnerHTML={html(it.meta ?? '')} /></span>
                  </label>
                ))}
              </div>
              {b.items.map((it, j) => {
                const r = reps[j];
                return (
                  <div key={j} className={`d-copywriting-panel d-copywriting-p${j}`}>
                    {r?.video ? (
                      // El video ES la comparación: el reel original a la izquierda y lo que escribió MaKo a la derecha. Queda claro en
                      // los dos modos (es una pantalla, como su captura del original).
                      <article className="d-copywriting-cmp d-copywriting-cmp--video" data-tema-fijo="">
                        <header><span><i /> {r.original.rotulo}</span><span className="d-copywriting-cmp-der"><i /> {r.mako.rotulo}</span></header>
                        <div className="d-copywriting-lienzo">
                          <video data-ej="" muted loop playsInline preload="none" poster={r.video.poster} aria-label={`${r.original.rotulo} y ${r.mako.rotulo.toLowerCase()}`}><source src={r.video.src} type="video/webm" /></video>
                        </div>
                        <footer><span>{r.original.pie}</span><span>{r.mako.pie}</span></footer>
                      </article>
                    ) : r ? (
                      <>
                        {/* En el teléfono, su «Original | My rewrite»: dos radios que eligen qué lado se ve. */}
                        <input type="radio" name={`d-copywriting-lado${j}`} id={`d-copywriting-lo${j}`} className="d-copywriting-lado-r d-copywriting-lado-o" aria-label="Ver el original" />
                        <input type="radio" name={`d-copywriting-lado${j}`} id={`d-copywriting-lm${j}`} className="d-copywriting-lado-r d-copywriting-lado-m" aria-label="Ver lo que escribió MaKo" defaultChecked />
                        <div className="d-copywriting-lados" aria-hidden="true">
                          <label htmlFor={`d-copywriting-lo${j}`}>Original</label>
                          <label htmlFor={`d-copywriting-lm${j}`}>Lo que escribió MaKo</label>
                        </div>
                        <div className="d-copywriting-cmpgrid">
                          <article className="d-copywriting-cmp d-copywriting-cmp--orig">
                            <header><span><i /> {r.original.rotulo}</span></header>
                            <div className="d-copywriting-lienzo">
                              <div className="d-copywriting-aviso">
                                <div className="d-copywriting-aviso-de"><span className="d-copywriting-aviso-av" aria-hidden="true">AH</span><span><strong>Alex Hormozi</strong><small>Publicidad</small></span></div>
                                {r.original.texto?.map((t, n) => <p key={n} className="d-copywriting-aviso-t">{t}</p>)}
                                <div className="d-copywriting-aviso-pie"><small>{r.original.destino}</small><strong>{r.original.titulo}</strong></div>
                              </div>
                            </div>
                            <footer><span>{r.original.pie}</span><span>El original</span></footer>
                          </article>
                          <article className="d-copywriting-cmp d-copywriting-cmp--mako">
                            <header><span><i /> {r.mako.rotulo}</span></header>
                            <div className="d-copywriting-lienzo">
                              <div className="d-copywriting-reescrito">
                                <p className="d-copywriting-reescrito-e">{r.mako.pie}</p>
                                <h3>{r.mako.titulo}</h3>
                                {r.mako.secciones?.map(([s, t], n) => <div key={n}><p className="d-copywriting-reescrito-s">{s}</p><p className="d-copywriting-reescrito-t">{t}</p></div>)}
                              </div>
                            </div>
                            <footer><span>Copywriting de MaKo · 13/11/2026</span><span>Su versión</span></footer>
                          </article>
                        </div>
                      </>
                    ) : null}
                    <p className="d-copywriting-cambio"><span>Qué cambió</span> <span dangerouslySetInnerHTML={html(it.texto)} /></p>
                  </div>
                );
              })}
            </div>
            <div className="d-copywriting-exfin"><p>Piezas reales de Alex Hormozi, leídas por Competitor Spy. Lo escrito es de MaKo, para ofertas de MaKo: no son clientes ni resultados medidos.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function secciones(bloques: Bloque[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const k = `b${i}`;
    switch (b.tipo) {
      case 'hero': {
        // El «de un vistazo» vive dentro de la tarjeta del hero, como su «What's inside, at a glance».
        const sigue = bloques[i + 1];
        const vistazo = sigue && sigue.tipo === 'cifras' ? sigue : null;
        out.push(
          <section key={k} className="d-copywriting-cont d-copywriting-hero">
            <div className="d-copywriting-izq">
              <span className="d-copywriting-pildora" dangerouslySetInnerHTML={html(b.etiqueta)} />
              <h1 className="d-copywriting-h1" dangerouslySetInnerHTML={html(b.titulo)} />
              <p className="d-copywriting-bajada" dangerouslySetInnerHTML={html(b.bajada)} />
              <div className="d-copywriting-acciones">
                <Boton />
                <a href="#d-copywriting-ejemplos" className="d-copywriting-link">Ver los ejemplos <span aria-hidden="true">→</span></a>
              </div>
              {b.puntos && b.puntos.length > 0 && (
                <ul className="d-copywriting-checks">{b.puntos.map((p, j) => <li key={j} dangerouslySetInnerHTML={html(p)} />)}</ul>
              )}
              {/* Su «You're not getting a prompt. You're getting the thinking behind the best ads and sales pages ever written,
                  working inside your own AI.», traducido con lo que MaKo tiene: los referentes (la tarjeta de la derecha). */}
              <p className="d-copywriting-noprompt"><strong>No te llevas un prompt.</strong> Te llevas el método de {ASESORES.length} referentes del marketing, trabajando dentro de tu propia IA.</p>
            </div>
            <aside className="d-copywriting-tarjeta">
              <div className="d-copywriting-cuadro"><Referentes /></div>
              <Boton />
              {vistazo && (
                <details className="d-copywriting-vistazo">
                  <summary><span dangerouslySetInnerHTML={html(vistazo.titulo ?? '')} /><span className="d-copywriting-mas" aria-hidden="true" /></summary>
                  <div className="d-copywriting-celdas">
                    {vistazo.items.map((c, j) => (
                      <div key={j} className="d-copywriting-celda">
                        <span className="d-copywriting-celda-l">{c.valor}</span>
                        <span className="d-copywriting-celda-v" dangerouslySetInnerHTML={html(c.label)} />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </aside>
          </section>,
        );
        if (vistazo) i++;
        break;
      }
      case 'cifras':
        out.push(
          <section key={k} className="d-copywriting-cont d-copywriting-seccion">
            {b.titulo && <p className="d-copywriting-cejilla" dangerouslySetInnerHTML={html(b.titulo)} />}
            <div className="d-copywriting-celdas">
              {b.items.map((c, j) => <div key={j} className="d-copywriting-celda"><span className="d-copywriting-celda-l">{c.valor}</span><span className="d-copywriting-celda-v" dangerouslySetInnerHTML={html(c.label)} /></div>)}
            </div>
          </section>,
        );
        break;
      case 'caso':
        // Su «What buyers wrote back»: la cabecera con las flechas a la derecha y el riel de tarjetas que sigue sin fin (el script
        // pone una copia del juego a cada lado). Las flechas son de adorno para el lector de pantalla (como las suyas, aria-hidden):
        // el riel se recorre con el dedo, la rueda o el teclado.
        out.push(
          <section key={k} className="d-copywriting-caso">
            <div className="d-copywriting-cont d-copywriting-excont">
              <div className="d-copywriting-caso-cab">
                <div>
                  <p className="d-copywriting-cejilla">El caso de {CASO.quien}</p>
                  <h2 className="d-copywriting-caso-h" dangerouslySetInnerHTML={html(CASO.titulo)} />
                  <p className="d-copywriting-caso-p">{CASO.sub}</p>
                </div>
                <div className="d-copywriting-flechas" aria-hidden="true">
                  <span className="d-copywriting-flechita" data-va="-1">←</span>
                  <span className="d-copywriting-flechita" data-va="1">→</span>
                </div>
              </div>
              <div className="d-copywriting-fichas" tabIndex={0} role="region" aria-label={`El caso de ${CASO.quien}: deslízalo o usa las flechas del teclado`}>
                <figure className="d-copywriting-ficha d-copywriting-ficha--tinta" data-tema-fijo="">
                  <blockquote>{CASO.historia.map((h, j) => <p key={j} dangerouslySetInnerHTML={html(h)} />)}</blockquote>
                  <figcaption><span className="d-copywriting-mono" aria-hidden="true">M</span><span><span className="d-copywriting-quien">{CASO.quien}</span><span className="d-copywriting-rol">{CASO.rol}</span></span></figcaption>
                </figure>
                <figure className="d-copywriting-ficha">
                  <blockquote><p dangerouslySetInnerHTML={html(CASO.resultado)} /></blockquote>
                  <figcaption><span className="d-copywriting-mono" aria-hidden="true">M</span><span><span className="d-copywriting-quien">{CASO.quien}</span><span className="d-copywriting-rol">{CASO.meses.map((m) => `${m.mes} ${m.monto}`).join(' · ')}</span></span></figcaption>
                </figure>
                <figure className="d-copywriting-ficha d-copywriting-ficha--video" data-tema-fijo="">
                  <video muted autoPlay loop playsInline preload="metadata" aria-label={`${CASO.quien}, en un escenario`}><source src={CASO.video} type="video/mp4" /></video>
                </figure>
              </div>
            </div>
          </section>,
        );
        break;
      case 'contraste':
        out.push(
          <section key={k} className="d-copywriting-tinta" data-tema-fijo="">
            <div className="d-copywriting-cont d-copywriting-tinta-grid">
              <div>
                {b.etiqueta && <p className="d-copywriting-tinta-l" dangerouslySetInnerHTML={html(b.etiqueta)} />}
                <h2 className="d-copywriting-tinta-h" dangerouslySetInnerHTML={html(b.titulo)} />
              </div>
              <p className="d-copywriting-tinta-p" dangerouslySetInnerHTML={html(`${b.sin.titulo} ${b.sin.texto} ${b.con.titulo} ${b.con.texto}`)} />
              <div className="d-copywriting-muro" aria-hidden="true">
                {Array.from({ length: 12 }, (_, j) => <span key={j} className={j === 4 ? 'd-copywriting-muro-uno' : undefined} />)}
              </div>
            </div>
            {b.cta && <div className="d-copywriting-cont" style={{ marginTop: 24 }}><Boton /></div>}
          </section>,
        );
        break;
      case 'pasos': {
        // Su fila de tres: «Your first hour» con «Who it's for» y «Who it isn't for» (los dos bloques que siguen).
        const sigue: Tarjetas[] = [];
        for (let j = i + 1; j < bloques.length && sigue.length < 2; j++) {
          const x = bloques[j];
          if (x.tipo === 'tarjetas' && !x.fondo && !x.cta) sigue.push(x); else break;
        }
        out.push(
          <section key={k} className="d-copywriting-cont d-copywriting-seccion">
            <div className="d-copywriting-tres">
              <div className="d-copywriting-panelazul">
                <p className="d-copywriting-panelazul-l" dangerouslySetInnerHTML={html(b.titulo)} />
                {b.bajada && <p className="d-copywriting-panelazul-h" dangerouslySetInnerHTML={html(b.bajada)} />}
                {b.pasos.map((p, j) => <p key={j} className="d-copywriting-panelazul-p" dangerouslySetInnerHTML={html(`<strong>${j + 1}. ${p.titulo}.</strong> ${p.texto}`)} />)}
              </div>
              {sigue.map((t, j) => (
                <div key={j} className={j === 0 ? 'd-copywriting-card' : 'd-copywriting-card d-copywriting-card--no'}>
                  <p className="d-copywriting-card-l" dangerouslySetInnerHTML={html(t.titulo)} />
                  {/* Como su «Who it's for»: el último punto va en un recuadro de color, sin negrita (su .inset--trust). */}
                  {t.items.map((it, n) => (j === 0 && n === t.items.length - 1 && t.items.length > 2
                    ? <p key={n} className="d-copywriting-inset" dangerouslySetInnerHTML={html(`${it.titulo} ${it.texto}`)} />
                    : <p key={n} dangerouslySetInnerHTML={renglon(it)} />))}
                </div>
              ))}
            </div>
          </section>,
        );
        i += sigue.length;
        break;
      }
      case 'tarjetas': {
        // Tres formas, según el bloque: la banda de los ejemplos (con `meta` en cada uno y etiqueta), las columnas de
        // «Empieza por…» (con `meta` y bajada) y la lista numerada de «Lo que incluye» (sin `meta`).
        const conMeta = b.items.every((it) => it.meta);
        if (conMeta && b.bajada && b.items.length <= 3 && b.etiqueta) {
          out.push(<Ejemplos key={k} b={b} />);
        } else if (conMeta) {
          out.push(
            <section key={k} className="d-copywriting-usos">
              <div className="d-copywriting-cont d-copywriting-excont">
                {b.etiqueta && <p className="d-copywriting-cejilla" dangerouslySetInnerHTML={html(b.etiqueta)} />}
                <h2 className="d-copywriting-usos-h" dangerouslySetInnerHTML={html(b.titulo)} />
                <div className="d-copywriting-cols">
                  {b.items.map((it, j) => (
                    <div key={j} className="d-copywriting-col">
                      <span className="d-copywriting-simbolo"><Icono paths={it.icono} /></span>
                      <h3 dangerouslySetInnerHTML={html(it.titulo)} />
                      <p dangerouslySetInnerHTML={html(it.texto)} />
                      <small dangerouslySetInnerHTML={html(it.meta ?? '')} />
                    </div>
                  ))}
                </div>
                {b.bajada && <p className="d-copywriting-otro" dangerouslySetInnerHTML={html(b.bajada)} />}
              </div>
            </section>,
          );
        } else {
          out.push(
            <section key={k} className="d-copywriting-cont d-copywriting-seccion">
              <div className="d-copywriting-cabeza">
                <h2 dangerouslySetInnerHTML={html(b.titulo)} />
                {b.etiqueta && <span className="d-copywriting-kicker" dangerouslySetInnerHTML={html(b.etiqueta)} />}
              </div>
              {b.bajada && <p className="d-copywriting-intro" style={{ marginTop: 16 }} dangerouslySetInnerHTML={html(b.bajada)} />}
              <div className="d-copywriting-lista">
                {b.items.map((it, j) => (
                  <div key={j} className={j === 2 ? 'd-copywriting-fila d-copywriting-fila--feature' : j === 5 ? 'd-copywriting-fila d-copywriting-fila--visual' : 'd-copywriting-fila'}>
                    <span className="d-copywriting-num">{j + 1}</span>
                    <div><h3 dangerouslySetInnerHTML={html(it.titulo)} /><p dangerouslySetInnerHTML={html(it.texto)} /></div>
                    {/* Su renglón 6 lleva a la derecha el estante de sus libros (210 px): aquí, las caricaturas de los referentes. */}
                    {j === 5 && (
                      <ul className="d-copywriting-estante" aria-hidden="true">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {ASESORES.slice(0, 16).map((a) => <li key={a.id}><img src={`/asesores/${a.id}.png`} alt="" width={48} height={48} loading="lazy" decoding="async" /></li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              {b.cta && <div style={{ marginTop: 24 }}><Boton /></div>}
            </section>,
          );
        }
        break;
      }
      case 'preguntas':
        out.push(
          <section key={k} className="d-copywriting-cont d-copywriting-seccion">
            <div className="d-copywriting-faq">
              <h2 className="d-copywriting-faq-l" dangerouslySetInnerHTML={html(b.titulo)} />
              {b.items.map((q, j) => (
                // Como su acordeón: una abierta a la vez (el `name` compartido lo hace el navegador, sin JavaScript).
                <details key={j} open={j === 0} name="d-copywriting-faq">
                  <summary dangerouslySetInnerHTML={html(q.p)} />
                  <p className="d-copywriting-faq-r" dangerouslySetInnerHTML={html(q.r)} />
                </details>
              ))}
            </div>
          </section>,
        );
        break;
      default:
        out.push(
          <section key={k} className="d-copywriting-cont d-copywriting-seccion">
            <h2 className="d-copywriting-usos-h" dangerouslySetInnerHTML={html('titulo' in b && b.titulo ? b.titulo : '')} />
          </section>,
        );
    }
  }
  return out;
}

// =============================================================================
// LO QUE SE MUEVE CON JAVASCRIPT (lo de sus scripts, reescrito): un <script data-visor> porque el visor de Martín borra los demás.
// Corre cuando React ya tomó la página, o en el acto sin Next (el visor), y empieza limpiando lo que pudo quedar congelado en una
// foto del DOM (pulir.mjs guarda la página DESPUÉS de correrlo: las copias del riel, el scroll del riel).
//   · la banda de ejemplos: el link «Ver los ejemplos» del hero la abre y baja hasta ella (su openExamples('hero')); al abrirse,
//     el foco va al titular; el video de la pestaña elegida corre sólo con la banda abierta y en pantalla;
//   · el riel del caso, como su carrusel sin fin: una copia del juego a cada lado (aria-hidden e inert), las flechas corren una
//     tarjeta con scroll suave, y cuando el riel se queda quieto en una copia salta en silencio al juego de verdad.
// Con «menos movimiento»: el scroll del riel es seco y el video no corre solo (queda su póster, el primer cuadro).
// =============================================================================
const SCRIPT = `(function(){
var P='d-copywriting';
function trasHidratar(fn){if(!document.querySelector('script[src*="/_next/"]'))return fn();var t0=Date.now();(function mira(){var h=Object.keys(document.body).some(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactProps')===0;});if(h||Date.now()-t0>6000)fn();else setTimeout(mira,60);})();}
function qa(r,s){return [].slice.call(r.querySelectorAll(s));}
function iniciar(){
  var R=document.querySelector('.'+P+'-raiz');if(!R||R.__listo)return;R.__listo=1;
  var quieto=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches),IO='IntersectionObserver' in window;
  var abre=R.querySelector('#'+P+'-abre'),banda=R.querySelector('#'+P+'-ejemplos'),enVista=false;
  var videos=qa(R,'video[data-ej]');
  videos.forEach(function(v){v.muted=true;if(!v.paused)v.pause();});
  var correr=function(){videos.forEach(function(v){var panel=v.closest('.'+P+'-panel');var ver=!!(abre&&abre.checked&&enVista&&!document.hidden&&!quieto&&panel&&panel.offsetParent!==null);
    if(ver){if(v.paused){if(v.preload!=='auto')v.preload='auto';var p=v.play();if(p&&p.catch)p.catch(function(){});}}else if(!v.paused)v.pause();});};
  if(abre){
    abre.addEventListener('change',function(){if(abre.checked){var h=R.querySelector('#'+P+'-ej-h');if(h&&h.focus)h.focus({preventScroll:true});}setTimeout(correr,80);});
    qa(R,'a[href="#'+P+'-ejemplos"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();if(!abre.checked){abre.checked=true;abre.dispatchEvent(new Event('change'));}banda.scrollIntoView({behavior:quieto?'auto':'smooth',block:'start'});});});
  }
  qa(R,'input[name="'+P+'-tab"]').forEach(function(r){r.addEventListener('change',function(){setTimeout(correr,30);});});
  if(IO&&banda)new IntersectionObserver(function(es){es.forEach(function(e){enVista=e.isIntersecting;});correr();},{threshold:.15}).observe(banda);
  document.addEventListener('visibilitychange',correr);
  // ── el riel sin fin ──
  var riel=R.querySelector('.'+P+'-fichas');
  if(riel){
    qa(riel,'.'+P+'-copia').forEach(function(c){c.remove();});
    var reales=[].slice.call(riel.children);
    if(reales.length>1){
      var copia=function(el){var c=el.cloneNode(true);c.setAttribute('aria-hidden','true');c.setAttribute('inert','');c.classList.add(P+'-copia');return c;};
      reales.forEach(function(el){riel.appendChild(copia(el));});
      for(var i=reales.length-1;i>=0;i--)riel.insertBefore(copia(reales[i]),riel.firstChild);
      qa(riel,'.'+P+'-copia video').forEach(function(v){v.muted=true;var p=v.play&&v.play();if(p&&p.catch)p.catch(function(){});});
      var ancho=0;
      var medir=function(){ancho=reales[0].offsetLeft-riel.children[0].offsetLeft;};
      var asentar=function(){if(!ancho)return;if(riel.scrollLeft<ancho*.5)riel.scrollLeft+=ancho;else if(riel.scrollLeft>ancho*1.5)riel.scrollLeft-=ancho;};
      var paso=function(){return reales[1].offsetLeft-reales[0].offsetLeft;};
      medir();riel.scrollLeft=ancho;
      qa(R,'.'+P+'-flechita').forEach(function(f){f.addEventListener('click',function(){asentar();riel.scrollBy({left:Number(f.getAttribute('data-va'))*paso(),behavior:quieto?'auto':'smooth'});});});
      var quietoT=null;
      if('onscrollend' in window)riel.addEventListener('scrollend',asentar);
      riel.addEventListener('scroll',function(){clearTimeout(quietoT);quietoT=setTimeout(asentar,160);},{passive:true});
      addEventListener('resize',function(){var d=ancho?riel.scrollLeft-ancho:0;medir();riel.scrollLeft=ancho+d;asentar();});
    }
  }
}
function arrancar(){trasHidratar(iniciar);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrancar);else arrancar();
})();`;

export default function DisenoCopywriting({ landing }: PropsDiseno) {
  return (
    <div className="d-copywriting-raiz">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script data-visor="" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <header className="d-copywriting-cont d-copywriting-barra">
        <LogoMaKo className="d-copywriting-logo" tamano={32} />
      </header>
      <main>
        {secciones(landing.bloques)}
        <section className="d-copywriting-cont d-copywriting-cierre">
          {/* Su cierre, traducido: «Traffic is an expensive place to find the weak line.» */}
          <h2>El tráfico es un lugar caro para encontrar la línea débil.</h2>
          <p>Dale a MaKo tu próximo anuncio, guion o email primero: te llevas el borrador, con lo que falta marcado, antes de que lo vea un comprador.</p>
          <Boton />
        </section>
      </main>
      <footer className="d-copywriting-pie">
        <div className="d-copywriting-cont">
          <nav className="d-copywriting-productos" aria-label="Las otras funciones de MaKo">
            {otrasFunciones(landing.slug).map((o) => <a key={o.href} href={o.href}>{o.nombre}</a>)}
          </nav>
          <div className="d-copywriting-legal">
            <span>© MaKo</span>
            <nav aria-label="Legal"><a href="/terminos">Términos</a><span aria-hidden="true">·</span><a href="/privacidad">Privacidad</a></nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
