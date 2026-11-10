// =============================================================================
// motion/css — la hoja de los motion graphics en una landing (los @keyframes de cada efecto)
// =============================================================================
// Una landing publicada no puede llevar un <style> propio ni un script nuestro sin su hash (la política de contenido de
// lib/editor-landing/pagina-publica.ts), así que los efectos son @keyframes FIJOS de esta hoja y cada pedazo trae en su
// `style` sólo variables: qué efecto (`--mo-e`), cuándo (`--mo-d`), cuánto (`--mo-dur`) y con qué curva (`--mo-ease`).
// Los «desde» son los de `DESDE` (./evaluar.ts): el lienzo y el CSS parten del mismo cuadro 0.
//
// Cómo se reproduce: las animaciones CORREN SOLAS al pintarse la página (sin JavaScript también: un crawler ve el estado
// final). El script de la página pone `gm-mo-espera` a los bloques que están fuera de la pantalla (sin animación =
// estado final) y se la saca al entrar: sacar y volver a poner la animación la reinicia. Lo que ya está en pantalla al
// cargar no parpadea (la lección del hero en docs/hallazgos-editor-landing.md). Con «menos movimiento», nada se mueve.
//
// Puro. Lo concatenará lib/editor-landing/css.ts (la hoja de la landing y del editor) cuando el Web Generator tenga su
// bloque motion, que es del chat Landings; hoy lo leen los tests, que cruzan cada @keyframes con el lienzo.
// Recetas de las skills de iart-ai (MIT, Copyright (c) 2026 iart.ai; ./LICENSE-IART).
// =============================================================================

import { cssDeCurva } from './curvas';
import { DESDE } from './evaluar';
import { EFECTOS } from './tipos';

const em = (n: number) => `${n}em`;

/** El @keyframes de ENTRADA de cada efecto: el cuadro 0 (el final es el estado natural del pedazo). */
export const KEYFRAMES_ENTRADA: Record<(typeof EFECTOS)[number], string> = {
  aparecer: 'opacity: 0;',
  subir: `transform: translateY(${DESDE.subirAlto * 100}%);`,
  deslizar: `opacity: 0; transform: translateY(${em(DESDE.deslizarEm)});`,
  caer: `opacity: 0; transform: translateY(${em(-DESDE.deslizarEm)});`,
  escalar: `opacity: 0; transform: scale(${DESDE.escalaDesde});`,
  desenfoque: `opacity: 0; filter: blur(${em(DESDE.blurEm)});`,
  barrido: 'clip-path: inset(0 100% 0 0);',
  'crecer-x': 'transform: scaleX(0);',
  'crecer-y': 'transform: scaleY(0);',
  girar: `opacity: 0; transform: scale(0) rotate(${DESDE.girarGrados}deg);`,
  rodar: 'opacity: 0; transform: translateY(0);',
};

/** El @keyframes de SALIDA de cada efecto: el último cuadro (el primero es el estado natural). */
export const KEYFRAMES_SALIDA: Record<(typeof EFECTOS)[number], string> = {
  aparecer: 'opacity: 0;',
  subir: `transform: translateY(${-DESDE.subirAlto * 100}%);`,
  deslizar: `opacity: 0; transform: translateY(${em(-DESDE.salidaDeslizarEm)});`,
  caer: `opacity: 0; transform: translateY(${em(DESDE.salidaDeslizarEm)});`,
  escalar: `opacity: 0; transform: scale(${DESDE.salidaEscala});`,
  desenfoque: `opacity: 0; filter: blur(${em(DESDE.blurEm)});`,
  barrido: 'clip-path: inset(0 100% 0 0);',
  'crecer-x': 'transform: scaleX(0);',
  'crecer-y': 'transform: scaleY(0);',
  girar: `opacity: 0; transform: scale(0) rotate(${-DESDE.girarGrados}deg);`,
  rodar: 'opacity: 0;',
};

export const nombreEntrada = (e: (typeof EFECTOS)[number]) => `mo-e-${e}`;
export const nombreSalida = (e: (typeof EFECTOS)[number]) => `mo-s-${e}`;

const R = '.gm-motion';

/** La hoja entera. Se agrega una vez a la de la landing. */
export const CSS_MOTION = [
  '/* ── Motion graphics (lib/motion: el mismo tiempo y la misma curva que el Video Editor) ── */',
  `${R} { position: relative; width: 100%; overflow: hidden; container-type: inline-size; border-radius: inherit; isolation: isolate; }`,
  `${R} .mo-capa { position: absolute; box-sizing: border-box; }`,
  `${R} .mo-texto { white-space: nowrap; font-kerning: normal; }`,
  `${R} .mo-l { display: block; white-space: nowrap; }`,
  `${R} .mo-l[data-mascara] { overflow: hidden; }`,
  // `color: inherit`: una regla de la página sobre `span` (la hoja de un tema) no le cambia el color a un pedazo.
  `${R} .mo-f { display: inline-block; white-space: pre; color: inherit; }`,
  `${R} .mo-caja > .mo-f, ${R} .mo-forma > .mo-f { display: block; width: 100%; height: 100%; }`,
  `${R} .mo-forma svg { display: block; width: 100%; height: 100%; overflow: visible; }`,
  `${R} .mo-cifra { font-variant-numeric: tabular-nums; }`,
  `${R} .mo-col { display: inline-block; width: 1ch; overflow: hidden; vertical-align: top; text-align: center; }`,
  `${R} .mo-rueda { display: block; transform: translateY(calc(var(--mo-n, 0) * -10%)); }`,
  `${R} .mo-rueda > span { display: block; }`,
  // Cada pedazo: la entrada y, si la hay (un clip, una frase que se va), la salida. Sin salida, `none`.
  `${R} .mo-a { --mo-s: none; --mo-sdur: 1ms; --mo-sease: linear; --mo-sd: 0ms; animation: var(--mo-e, none) var(--mo-dur, 1ms) var(--mo-ease, linear) var(--mo-d, 0ms) both, var(--mo-s) var(--mo-sdur) var(--mo-sease) var(--mo-sd) forwards; }`,
  `${R} .mo-capa[data-latido] { animation: mo-latido var(--mo-lper) ${cssDeCurva('suave')} var(--mo-ld) var(--mo-lveces) both; }`,
  '@keyframes mo-latido { 50% { transform: scale(var(--mo-lat, 1.06)); } }',
  ...EFECTOS.map((e) => `@keyframes ${nombreEntrada(e)} { from { ${KEYFRAMES_ENTRADA[e]} } }`),
  ...EFECTOS.map((e) => `@keyframes ${nombreSalida(e)} { to { ${KEYFRAMES_SALIDA[e]} } }`),
  // Fuera de la pantalla, quieto en su estado final; al entrar, el script saca la clase y la animación arranca de cero.
  `${R}.gm-mo-espera .mo-a, ${R}.gm-mo-espera .mo-capa { animation: none !important; }`,
  // «Menos movimiento»: el estado final, sin nada que se mueva (accessible-animation: la versión quieta siempre existe).
  `@media (prefers-reduced-motion: reduce) { ${R} .mo-a, ${R} .mo-capa { animation: none !important; } }`,
].join('\n');
