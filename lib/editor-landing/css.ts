// =============================================================================
// editor-landing/css — CSS_CONTENIDO, la hoja ÚNICA del contenido de una landing
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Esta hoja la
// comparten el editor (lo que se edita) y la página publicada (lo que se sirve):
// D3 de docs/diseno-editor-landing.md, «lo que se edita es lo que se publica».
// Dibuja el contrato de clases `gm-` que emite especificacion.ts (paquete A) y sólo
// lee variables --gm-* que escribe temas.ts (`varsDeTema`, inline en cada .gm-doc).
//
// Medidas: las de Gamma (gamma-tokens.md §2-§7), en `em` relativos a la SECCIÓN
// como hace Gamma (su font-size base depende del viewport y todo lo demás va en em):
// tarjeta de 64.5em, padding 2.75em 3.5em, radios por redondez, sombra y borde de
// 0.0625em, esmerilado con backdrop-filter, título 5em / h1 2.5em × headingFontSize,
// imagen de acento arriba 18.75em y a los lados 37.5%, grillas de diseños
// optimizados con gap 2em 1.25em, barras de 4px, entrada de 1s cubic-bezier(0.22,1,0.36,1).
//
// Tres cosas que no se ven y deciden cómo se escribe acá:
//   · Es UN STRING que se sirve dentro de un <style> (pagina-publica.ts): sin
//     backticks ni `${` (AGENTS.md, «el fuente y lo que se sirve no son el mismo
//     texto») y sin comillas simples adentro (las cadenas TS van entre simples).
//   · Las listas cerradas (variantes de diseños optimizados, tonos, anchos de imagen,
//     colores, tamaños) salen de doc.ts: si doc.ts suma una variante, la hoja la
//     nombra sola; si no le escribió su forma, el test lo dice.
//   · Todo `var(--gm-x)` que NO escribe varsDeTema lleva respaldo o lo define esta
//     misma hoja: un var() inexistente no falla, HEREDA (AGENTS.md, «tres topes del
//     entorno»), y una sección pegada a la anterior no da ningún error. El test
//     tests/editor-landing-temas.test.ts lo comprueba variable por variable.
//
// Responsive: `@media (max-width: 768px)` para la página real y el MISMO bloque
// bajo `.gm-doc[data-dispositivo="movil"]` para la vista previa por dispositivo del
// editor, que es un lienzo angosto dentro de una ventana ancha (una media query no
// lo ve). No se usan container queries, por dos razones: una miniatura es un
// .gm-doc ANGOSTO y con una container query se dibujaría con el diseño de celular
// (con la media query, quien la arma decide: ancho de escritorio + scale, o
// --gm-base); y `container-type: inline-size` hace que el ancho de .gm-doc no
// dependa de su contenido, así que montado en una fila flex sin ancho mide 0.
// (Lo que NO es razón, medido el 11/10/2026 en Chrome 154: un `position: fixed`
// adentro de un container-type sigue fijo a la ventana; el sello flotaría igual.)
//
// Lo que NO se copia de Gamma: el corte diagonal/ondulado/redondo de la imagen de
// acento (accentCut) y el «Formato libre» (bloques con posición absoluta).
// =============================================================================

import {
  ALTOS_ESPACIADOR, ALTOS_HTML_LIBRE, ANCHOS_IMAGEN, COLORES_TEMA, TAMANOS_TEXTO, TONOS_RECUADRO,
  type VarianteOptimizado,
} from './doc';

const D = '.gm-doc';

/** Una regla: selector (o lista) y declaraciones. */
function r(sel: string | readonly string[], decl: string): string {
  return (typeof sel === 'string' ? sel : sel.join(',\n')) + ' { ' + decl + ' }';
}

/** Selectores de uno o varios diseños optimizados, bajo un prefijo, con un sufijo. */
function opt(p: string, ids: readonly VarianteOptimizado[], resto = ''): string[] {
  return ids.map((id) => p + ' .gm-optimizado[data-variante="' + id + '"]' + resto);
}

const rango = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// ─────────────────────────────────────────────────────────────────────────────
// Las variantes de «Diseños optimizados», por cómo reparten las columnas
// ─────────────────────────────────────────────────────────────────────────────
// Con data-cols="auto" (o sin el atributo) la grilla sale de la CANTIDAD de ítems:
// `:has(> .gm-item:nth-child(k):last-child)` fija --gm-cuenta y una columna por modo
// (rejilla 4→4, pares 4→2, fila = cuántos hay hasta 6). Cada variante elige su modo;
// un data-cols explícito gana siempre. Los cuatro «especiales» dibujan otra cosa
// (un círculo, dos lados de una línea) y no usan la grilla.

const PARES: readonly VarianteOptimizado[] = [
  'vinetas-grandes', 'vinetas-iconos', 'cajas-solidas', 'cajas-delineadas', 'cajas-iconos', 'cajas-numeros',
  'cajas-linea-lateral', 'cajas-alternadas', 'cajas-unidas', 'linea-lateral', 'lado-a-lado', 'versus',
  'pros-contras', 'citas', 'citas-caras', 'iconos-izquierda', 'metrica-destacada',
];
const UNA: readonly VarianteOptimizado[] = [
  'vinetas-pequenas', 'vinetas-flechas', 'vinetas-numeradas', 'linea-divisoria', 'tiempo-vertical',
  'flechas-verticales', 'etapas-verticales', 'piramide', 'piramide-escalonada', 'embudo', 'embudo-minimalista',
  'estadisticas-barras',
];
const FILA: readonly VarianteOptimizado[] = [
  'tiempo-horizontal', 'tiempo-minimalista', 'flechas-horizontales', 'chevrones', 'etapas-horizontales',
  'etapas-iconos', 'escalera', 'logos',
];
const ESPECIALES: readonly VarianteOptimizado[] = ['tiempo-dos-lados', 'ciclo', 'radial', 'circulos-concentricos'];
/** El resto va en «rejilla»: linea-superior, numeros-grandes, estadisticas-circulares, estrellas, galeria, imagenes-texto, imagenes-circulares, equipo, nombre-rol, iconos-texto, iconos-grandes. */

/** Los que existen para mostrar íconos: el interruptor «mostrar íconos» no los apaga. */
const CON_ICONOS: readonly VarianteOptimizado[] = ['vinetas-iconos', 'cajas-iconos', 'etapas-iconos', 'iconos-texto', 'iconos-izquierda', 'iconos-grandes'];

// Columnas por cantidad exacta de ítems (2..12), por modo.
const REJILLA: Record<number, number> = { 2: 2, 3: 3, 4: 4, 5: 3, 6: 3, 7: 4, 8: 4, 9: 3, 10: 5, 11: 4, 12: 4 };
const EN_PARES: Record<number, number> = { 2: 2, 3: 3, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 3, 10: 4, 11: 4, 12: 4 };

/** Un ítem que se pinta con el acento lleno: la tinta se da vuelta (variables y color). */
const INVERTIDO =
  'background: var(--gm-acento); color: var(--gm-acento-contraste); --gm-texto: var(--gm-acento-contraste); ' +
  '--gm-texto-tenue: var(--gm-acento-contraste); --gm-titulo: var(--gm-acento-contraste); --gm-titulo-relleno: var(--gm-acento-contraste); ' +
  '--gm-titulo-degradado: none; --gm-titulo-sangrado: 0em; --gm-acento-texto: var(--gm-acento-contraste); --gm-enlace: var(--gm-acento-contraste);';

/** La estrella de las calificaciones (máscara repetida 5 veces). */
const ESTRELLA = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath d=%22M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z%22/%3E%3C/svg%3E")';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Raíz, página y SECCIÓN (la tarjeta)
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ: string[] = [
  '/* ── 1. Raíz y página ── */',
  r(D, 'color-scheme: var(--gm-esquema, light); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; font-family: var(--gm-fuente-cuerpo, system-ui, sans-serif); color: var(--gm-texto, #161616);'),
  r([D + ' *', D + ' *::before', D + ' *::after'], 'box-sizing: border-box;'),
  // El fondo de la página (Gamma: div.motion-present-mode-bg). Fijo al viewport sólo en
  // la página publicada; en el editor y en una miniatura se mueve con el contenido
  // (fijo, una miniatura mostraría el pedazo de fondo que le toca a la ventana).
  r(D + ' .gm-fondo', 'background: var(--gm-fondo, #ffffff); background-size: cover; background-position: center; background-repeat: no-repeat; min-height: 100%;'),
  r(D + '[data-modo="publico"] .gm-fondo', 'background-attachment: fixed; min-height: 100vh;'),
  '@media (hover: none) { ' + r(D + '[data-modo="publico"] .gm-fondo', 'background-attachment: scroll;') + ' }',
  // El tamaño base: 18px en una pantalla ancha, como Gamma (1rem × su factor de
  // viewport); la tarjeta mide 64.5em. --gm-base lo pisa quien necesite una escala fija
  // (una miniatura proporcional: --gm-base: calc(<ancho> / 64.5)).
  r(D + ' .gm-pagina', 'display: flow-root; font-size: var(--gm-base, clamp(15px, calc(100vw / 68.5), 18px)); padding: 0 0 3.5em;'),
  r(D + ' .gm-pagina:has(> .gm-tarjeta[data-ancho="completo"]:last-child)', 'padding-bottom: 0;'),
];

const TARJETA: string[] = [
  '/* ── 2. La sección: section.gm-tarjeta > .gm-tarjeta-fondo + .gm-acento + .gm-tarjeta-cuerpo ── */',
  r(D + ' .gm-tarjeta', 'position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: "cuerpo"; width: min(64.5em, calc(100% - 4em)); margin: 3.5em auto 0; border-radius: var(--gm-radio-tarjeta, 0.6em); scroll-margin-top: 5em;'),
  // Gamma no pinta la tarjeta: lo hace un hermano absoluto detrás (fondo, sombra, borde,
  // radio y esmerilado). Así el esmerilado no vuelve translúcido al texto.
  r(D + ' .gm-tarjeta-fondo', 'position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--gm-tarjeta-fondo, #ffffff); box-shadow: var(--gm-tarjeta-borde, 0 0 #0000), var(--gm-tarjeta-sombra, 0 0 #0000); -webkit-backdrop-filter: var(--gm-tarjeta-filtro, none); backdrop-filter: var(--gm-tarjeta-filtro, none); pointer-events: none;'),
  r(D + ' .gm-tarjeta-cuerpo', 'grid-area: cuerpo; position: relative; display: grid; grid-template-columns: minmax(0, 1fr); align-content: center; min-width: 0; padding: 2.75em 3.5em; font-family: var(--gm-fuente-cuerpo, system-ui, sans-serif); font-weight: var(--gm-peso-cuerpo, 400); font-size: calc(1em * var(--gm-escala-cuerpo, 1)); line-height: var(--gm-interlineado-cuerpo, 1.6); letter-spacing: var(--gm-tracking-cuerpo, 0em); color: var(--gm-texto, #161616); overflow-wrap: break-word;'),
  // Alineación vertical del contenido (con alto de pantalla o una imagen al costado).
  r(D + ' .gm-tarjeta[data-alinea="arriba"] > .gm-tarjeta-cuerpo', 'align-content: start;'),
  r(D + ' .gm-tarjeta[data-alinea="abajo"] > .gm-tarjeta-cuerpo', 'align-content: end;'),
  // Anchos: Angosto · Normal · Amplio · Completo («El ancho completo oculta el fondo»).
  r(D + ' .gm-tarjeta[data-ancho="angosto"]', 'width: min(48em, calc(100% - 4em));'),
  r(D + ' .gm-tarjeta[data-ancho="amplio"]', 'width: min(84em, calc(100% - 4em));'),
  r(D + ' .gm-tarjeta[data-ancho="completo"]', 'width: 100%; margin-top: 0; --gm-radio-tarjeta: 0px; --gm-tarjeta-borde: 0 0 #0000; --gm-tarjeta-sombra: 0 0 #0000;'),
  r(D + ' .gm-tarjeta:not([data-ancho="completo"]) + .gm-tarjeta[data-ancho="completo"]', 'margin-top: 3.5em;'),
  // A sangre, el texto no se estira de borde a borde de una pantalla de 1900px.
  r(D + ' .gm-tarjeta[data-ancho="completo"]:is([data-diseno="sin"], [data-diseno="arriba"], [data-diseno="fondo"]) > .gm-tarjeta-cuerpo', 'width: min(100%, 64.5em); justify-self: center;'),
  // Alto: el del contenido o el de la pantalla.
  r(D + ' .gm-tarjeta[data-alto="pantalla"]', 'min-height: calc(100vh - 7em); min-height: calc(100svh - 7em);'),
  r(D + ' .gm-tarjeta[data-alto="pantalla"][data-ancho="completo"]', 'min-height: 100vh; min-height: 100svh;'),
  // Fondo «acento»: la sección entera del color de acento, con la tinta dada vuelta.
  // (Con fondo «color» o «degradado», las variables las escribe quien arma la sección:
  // varsDeFondoPropio de temas.ts, en el style del <section>.)
  r(D + ' .gm-tarjeta[data-fondo="acento"]', '--gm-tarjeta-fondo: var(--gm-acento); --gm-tarjeta-color: var(--gm-acento); --gm-tarjeta-filtro: none; ' +
    '--gm-texto: var(--gm-acento-contraste); --gm-texto-tenue: color-mix(in srgb, var(--gm-acento-contraste) 78%, transparent); ' +
    '--gm-titulo: var(--gm-acento-contraste); --gm-titulo-relleno: var(--gm-acento-contraste); --gm-titulo-degradado: none; --gm-titulo-sangrado: 0em; ' +
    '--gm-enlace: var(--gm-acento-contraste); --gm-enlace-hover: var(--gm-acento-contraste); --gm-acento-texto: var(--gm-acento-contraste); ' +
    '--gm-acento-suave: color-mix(in srgb, var(--gm-acento-contraste) 16%, var(--gm-acento)); --gm-superficie: color-mix(in srgb, var(--gm-acento-contraste) 12%, var(--gm-acento)); ' +
    '--gm-cebra: color-mix(in srgb, var(--gm-acento-contraste) 6%, var(--gm-acento)); --gm-borde-neutro: color-mix(in srgb, var(--gm-acento-contraste) 30%, transparent); ' +
    '--gm-boton: var(--gm-acento-contraste); --gm-boton-texto: var(--gm-acento); --gm-boton-borde: var(--gm-acento-contraste);'),
  // Una sección oculta sólo llega al editor y a la tira (en la página publicada no sale).
  r(D + ' .gm-tarjeta[data-oculta="si"]', 'opacity: 0.5;'),
];

const ACENTO: string[] = [
  '/* ── 3. La imagen de acento (Gamma: background-image cover, radio sólo en las esquinas de afuera) ── */',
  r(D + ' .gm-acento', 'grid-area: acento; position: relative; min-height: 12.5em; background-color: var(--gm-superficie, rgba(127,127,127,0.12)); background-size: cover; background-repeat: no-repeat; background-position: 50% 50%;'),
  r(D + ' .gm-acento[data-ajuste="contener"]', 'background-size: contain;'),
  r(D + ' .gm-tarjeta[data-diseno="sin"] > .gm-acento', 'display: none;'),
  // Arriba: 100% × 18.75em.
  r(D + ' .gm-tarjeta[data-diseno="arriba"]', 'grid-template-areas: "acento" "cuerpo"; grid-template-rows: auto 1fr;'),
  r(D + ' .gm-tarjeta[data-diseno="arriba"] > .gm-acento', 'height: 18.75em; border-radius: var(--gm-radio-tarjeta, 0.6em) var(--gm-radio-tarjeta, 0.6em) 0 0;'),
  // Izquierda / derecha: 37.5% del ancho, alto completo.
  r(D + ' .gm-tarjeta[data-diseno="izquierda"]', 'grid-template-columns: 37.5% minmax(0, 1fr); grid-template-areas: "acento cuerpo"; min-height: 26em;'),
  r(D + ' .gm-tarjeta[data-diseno="izquierda"] > .gm-acento', 'border-radius: var(--gm-radio-tarjeta, 0.6em) 0 0 var(--gm-radio-tarjeta, 0.6em);'),
  r(D + ' .gm-tarjeta[data-diseno="derecha"]', 'grid-template-columns: minmax(0, 1fr) 37.5%; grid-template-areas: "cuerpo acento"; min-height: 26em;'),
  r(D + ' .gm-tarjeta[data-diseno="derecha"] > .gm-acento', 'border-radius: 0 var(--gm-radio-tarjeta, 0.6em) var(--gm-radio-tarjeta, 0.6em) 0;'),
  // Fondo: la imagen detrás de todo el contenido (--behind-accent-height de Gamma: 24em).
  r(D + ' .gm-tarjeta[data-diseno="fondo"]', 'min-height: 24em;'),
  r(D + ' .gm-tarjeta[data-diseno="fondo"] > .gm-acento', 'position: absolute; inset: 0; z-index: -1; min-height: 0; border-radius: inherit;'),
  // Superposición sobre la imagen de fondo: Oscura · Clara · Esmerilada.
  r(D + ' .gm-tarjeta[data-diseno="fondo"] > .gm-acento::after', 'content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;'),
  r(D + ' .gm-tarjeta[data-diseno="fondo"][data-superposicion="oscura"] > .gm-acento::after', 'background: linear-gradient(180deg, rgba(0,0,0,0.38), rgba(0,0,0,0.62));'),
  r(D + ' .gm-tarjeta[data-diseno="fondo"][data-superposicion="clara"] > .gm-acento::after', 'background: rgba(255,255,255,0.64);'),
  r(D + ' .gm-tarjeta[data-diseno="fondo"][data-superposicion="esmerilada"] > .gm-acento::after', 'background: var(--gm-tarjeta-velo, rgba(255,255,255,0.6)); -webkit-backdrop-filter: blur(14px) saturate(160%); backdrop-filter: blur(14px) saturate(160%);'),
  // Con superposición oscura o clara la tinta sigue a la superposición, no al tema.
  r(D + ' .gm-tarjeta[data-diseno="fondo"][data-superposicion="oscura"]', '--gm-texto: #f5f5f5; --gm-texto-tenue: rgba(245,245,245,0.8); --gm-titulo: #ffffff; --gm-titulo-relleno: #ffffff; --gm-titulo-degradado: none; --gm-titulo-sangrado: 0em; --gm-enlace: #ffffff; --gm-enlace-hover: #ffffff; --gm-acento-texto: #ffffff; --gm-borde-neutro: rgba(255,255,255,0.3); --gm-superficie: rgba(255,255,255,0.12); --gm-cebra: rgba(255,255,255,0.06);'),
  r(D + ' .gm-tarjeta[data-diseno="fondo"][data-superposicion="clara"]', '--gm-texto: #161616; --gm-texto-tenue: rgba(22,22,22,0.75); --gm-titulo: #0d0d0d; --gm-titulo-relleno: #0d0d0d; --gm-titulo-degradado: none; --gm-titulo-sangrado: 0em; --gm-enlace: #0d0d0d; --gm-enlace-hover: #0d0d0d; --gm-acento-texto: #0d0d0d; --gm-borde-neutro: rgba(0,0,0,0.18); --gm-superficie: rgba(0,0,0,0.06); --gm-cebra: rgba(0,0,0,0.03);'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. Tipografía y ritmo entre bloques
// ─────────────────────────────────────────────────────────────────────────────

/** Los contenedores de bloques: entre hermanos va el --block-margin de Gamma (1.125em). */
const FLUJO = ['.gm-tarjeta-cuerpo', '.gm-columna', '.gm-item-cuerpo', '.gm-recuadro-cuerpo', '.gm-desplegable-cuerpo', 'blockquote'];
const enFlujo = (resto: string) => FLUJO.map((c) => D + ' ' + c + resto);
/** El tamaño de un título: em de la sección × headingFontSize, sin el fontSize del cuerpo (que ya multiplicó al contenedor). */
const tamTitulo = (em: number) => 'font-size: calc(' + em + 'em * var(--gm-escala-titulos, 1) / var(--gm-escala-cuerpo, 1));';

const TIPOGRAFIA: string[] = [
  '/* ── 4. Tipografía (gamma-tokens §3) y ritmo entre bloques (§2) ── */',
  r([D + ' h1', D + ' h2', D + ' h3', D + ' h4'], 'margin: 0; font-family: var(--gm-fuente-titulo, system-ui, sans-serif); font-weight: var(--gm-peso-titulo, 700); line-height: var(--gm-interlineado-titulos, 1.25); letter-spacing: var(--gm-tracking-titulos, 0em); color: var(--gm-titulo, #111111); text-wrap: balance; ' +
    // Título con degradado: background-clip:text + relleno transparente (+ .25em de
    // aire para que no se corten los descendentes); sin degradado, el relleno es el color.
    'background-image: var(--gm-titulo-degradado, none); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: var(--gm-titulo-relleno, currentColor); padding-block: var(--gm-titulo-sangrado, 0em);'),
  r(D + ' h1', tamTitulo(2.5)),
  r(D + ' h1.gm-titulo', tamTitulo(5) + ' line-height: var(--gm-interlineado-titulos, 1.1);'),
  r(D + ' h2', tamTitulo(1.9)),
  r(D + ' h3', tamTitulo(1.45)),
  r(D + ' h4', tamTitulo(1.25)),
  r([D + ' :is(h1, h2, h3, h4) :is(strong, b)'], 'font-weight: bolder;'),
  r(D + ' p', 'margin: 0;'),
  r(D + ' p[data-variante="grande"]', 'font-size: 1.25em; line-height: 1.45;'),
  r(D + ' p[data-variante="pequeno"]', 'font-size: 0.85em;'),
  // Antetítulo: el texto chico sobre el título (Gamma: eyebrow, mayúsculas, color de acento).
  r(D + ' p[data-variante="antetitulo"]', 'font-size: 0.8em; font-weight: 600; line-height: 1.3; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gm-acento-texto, currentColor);'),
  // El ritmo: 1.125em entre bloques; un título deja 1.5em de la sección arriba (en em
  // de SU tamaño: 1.5 / 2.5 = .6 en un h1); un párrafo pegado a un título, .9em.
  r(enFlujo(' > * + *'), 'margin-top: 1.125em;'),
  r(enFlujo(' > * + h1'), 'margin-top: 0.6em;'),
  r(enFlujo(' > * + h1.gm-titulo'), 'margin-top: 0.3em;'),
  r(enFlujo(' > * + h2'), 'margin-top: 0.79em;'),
  r(enFlujo(' > * + h3'), 'margin-top: 1.03em;'),
  r(enFlujo(' > * + h4'), 'margin-top: 1.2em;'),
  r(enFlujo(' > :is(h1, h2, h3, h4) + p'), 'margin-top: 0.9em;'),
  r(enFlujo(' > :is(h1, h2, h3, h4) + :is(h1, h2, h3, h4)'), 'margin-top: 0.35em;'),
  r(enFlujo(' > p[data-variante="antetitulo"] + :is(h1, h2, h3, h4)'), 'margin-top: 0.2em;'),
  // Listas (Gamma: 0.35em entre ítems).
  r([D + ' ul', D + ' ol'], 'margin: 0; padding-left: 1.5em;'),
  // La viñeta y el número se DECLARAN: adentro de la app (el lienzo, las miniaturas, Presentar) el
  // preflight de Tailwind pone `list-style: none` a todo `ul`/`ol`, y las listas salían sin marca
  // con su sangría (medido el 11/10/2026 en una landing armada desde el esquema). La página
  // publicada no tiene Tailwind: ahí se veían, y el lienzo no se parecía a lo publicado.
  r(D + ' ul', 'list-style: disc;'),
  r(D + ' ol', 'list-style: decimal;'),
  r(D + ' li + li', 'margin-top: 0.35em;'),
  r(D + ' li > * + *', 'margin-top: 0.35em;'),
  r(D + ' li::marker', 'color: var(--gm-acento-texto, currentColor);'),
  r(D + ' ul[data-type="taskList"]', 'list-style: none; padding-left: 0.1em;'),
  r(D + ' ul[data-type="taskList"] > li', 'display: flex; align-items: flex-start; gap: 0.6em;'),
  r(D + ' ul[data-type="taskList"] > li > label', 'flex: none; display: flex; padding-top: 0.28em;'),
  r(D + ' ul[data-type="taskList"] > li > div', 'flex: 1; min-width: 0;'),
  r(D + ' ul[data-type="taskList"] input[type="checkbox"]', 'width: 1em; height: 1em; margin: 0; accent-color: var(--gm-acento, currentColor);'),
  r(D + ' ul[data-type="taskList"] > li[data-checked="true"] > div', 'color: var(--gm-texto-tenue, inherit); text-decoration: line-through;'),
  // Cita en bloque.
  r(D + ' blockquote', 'margin: 0; padding: 0.15em 0 0.15em 1.1em; border-left: 0.2em solid var(--gm-acento, currentColor); font-size: 1.2em; line-height: 1.45;'),
  // Separador.
  r(D + ' hr', 'height: 0; border: 0; border-top: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15));'),
  // Espacio.
  r(D + ' .gm-espaciador', 'height: 2em;'),
  ...ALTOS_ESPACIADOR.map((a) => r(D + ' .gm-espaciador[data-alto="' + a + '"]', 'height: ' + ({ s: '1em', m: '2em', l: '4em', xl: '6em' } as Record<string, string>)[a] + ';')),
];

const MARCAS_TEXTO: string[] = [
  '/* ── 5. Marcas del texto ── */',
  r([D + ' strong', D + ' b'], 'font-weight: var(--gm-peso-negrita, 700);'),
  r([D + ' em', D + ' i'], 'font-style: italic;'),
  r(D + ' u', 'text-decoration: underline; text-underline-offset: 0.15em;'),
  r(D + ' s', 'text-decoration: line-through;'),
  r(D + ' a, ' + D + ' [data-gm-a]', 'color: var(--gm-enlace, currentColor); text-decoration: underline; text-decoration-thickness: 0.08em; text-underline-offset: 0.18em; -webkit-text-fill-color: currentColor;'),
  r(D + ' a:hover', 'color: var(--gm-enlace-hover, currentColor);'),
  // Un color propio dentro de un título con degradado o relleno: el relleno es el del span.
  r([D + ' [data-color]', D + ' mark'], '-webkit-text-fill-color: currentColor;'),
  r(D + ' mark', 'background: var(--gm-resaltado, #fdf2a6); color: inherit; padding: 0 0.12em; border-radius: 0.15em;'),
  ...COLORES_TEMA.map((c) => {
    const tinta = c === 'acento' ? 'var(--gm-acento-texto)' : c === 'texto' ? 'var(--gm-texto)' : c === 'titulo' ? 'var(--gm-titulo)' : c === 'tenue' ? 'var(--gm-texto-tenue)' : 'var(--gm-' + c + '-legible)';
    return r(D + ' span[data-color="' + c + '"]', 'color: ' + tinta + ';');
  }),
  ...COLORES_TEMA.map((c) => {
    if (c.startsWith('paleta-')) return r(D + ' mark[data-color="' + c + '"]', 'background: var(--gm-' + c + '); color: var(--gm-' + c + '-texto);');
    const fondo = c === 'acento' ? 'var(--gm-acento-suave)' : c === 'tenue' ? 'var(--gm-cebra)' : 'var(--gm-superficie)';
    return r(D + ' mark[data-color="' + c + '"]', 'background: ' + fondo + ';');
  }),
  ...TAMANOS_TEXTO.map((t) => r(D + ' span[data-tam="' + t + '"]', 'font-size: ' + ({ xs: '0.75em', s: '0.875em', m: '1em', l: '1.25em', xl: '1.5em', '2xl': '2em' } as Record<string, string>)[t] + ';')),
  // Etiqueta: la píldora «Más vendido» (Gamma: .gml-label, 0.8em, mayúsculas).
  r(D + ' .gm-etiqueta', 'display: inline-block; vertical-align: middle; font-size: 0.8em; font-weight: 600; line-height: 1.15; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.375em 0.75em; border-radius: 0.75em; background: var(--gm-acento, #333333); color: var(--gm-acento-contraste, #ffffff);'),
  ...COLORES_TEMA.filter((c) => c.startsWith('paleta-')).map((c) => r(D + ' .gm-etiqueta[data-color="' + c + '"]', 'background: var(--gm-' + c + '); color: var(--gm-' + c + '-texto);')),
  r(D + ' .gm-etiqueta[data-color="tenue"]', 'background: var(--gm-superficie); color: var(--gm-texto);'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. Bloques: columnas, tabla, botones, recuadros, desplegable, medios, formulario
// ─────────────────────────────────────────────────────────────────────────────

const BLOQUES: string[] = [
  '/* ── 6. Columnas ── */',
  // Las columnas llegan con --gm-cols inline («4fr 8fr»); sin él, dos iguales.
  r(D + ' .gm-columnas', 'display: grid; grid-template-columns: var(--gm-cols, 1fr 1fr); gap: 1.5em 2.5em; align-items: start;'),
  r(D + ' .gm-columna', 'position: relative; min-width: 0;'),
  r(D + ' .gm-columnas[data-divisores="si"] > .gm-columna + .gm-columna::before', 'content: ""; position: absolute; top: 0; bottom: 0; left: -1.25em; border-left: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15));'),

  '/* ── 7. Tabla (gamma-tokens §3: celda .4em .75em, borde .0625em, encabezado 600, cebra) ── */',
  r(D + ' .gm-tabla', 'overflow-x: auto; border-radius: var(--gm-radio-caja, 0.35em);'),
  r(D + ' .gm-tabla table', 'width: 100%; border-collapse: collapse; font-size: 0.95em;'),
  r([D + ' .gm-tabla td', D + ' .gm-tabla th'], 'padding: 0.4em 0.75em; border: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15)); text-align: left; vertical-align: top;'),
  r(D + ' .gm-tabla th', 'font-weight: 600; background: var(--gm-superficie, rgba(127,127,127,0.1)); color: var(--gm-titulo, inherit);'),
  r(D + ' .gm-tabla tr:nth-child(even) > td', 'background: var(--gm-cebra, rgba(0,0,0,0.04));'),
  r([D + ' .gm-tabla td > * + *', D + ' .gm-tabla th > * + *'], 'margin-top: 0.5em;'),

  '/* ── 8. Botones (gamma-tokens §7: .5em 1em, alto 2.75em, radio por redondez) ── */',
  r(D + ' .gm-botones', 'display: flex; flex-wrap: wrap; align-items: center; gap: 0.75em; justify-content: flex-start;'),
  r(D + ' .gm-botones[data-alinea="centro"]', 'justify-content: center;'),
  r(D + ' .gm-botones[data-alinea="derecha"]', 'justify-content: flex-end;'),
  r(D + ' .gm-boton', 'display: inline-flex; align-items: center; justify-content: center; gap: 0.5em; min-height: 2.75em; padding: 0.5em 1.25em; border: 0; border-radius: var(--gm-radio-boton, 0.375em); background: var(--gm-boton, #111111); color: var(--gm-boton-texto, #ffffff); font-family: var(--gm-fuente-cuerpo, inherit); font-size: 1em; font-weight: 600; line-height: 1.2; letter-spacing: 0; text-align: center; text-decoration: none; cursor: pointer; -webkit-text-fill-color: currentColor; transition: filter 0.15s ease, transform 0.15s ease;'),
  r(D + ' .gm-boton[data-variante="secundario"]', 'background: var(--gm-acento-suave, rgba(127,127,127,0.15)); color: var(--gm-acento-texto, currentColor);'),
  r(D + ' .gm-boton[data-variante="contorno"]', 'background: transparent; color: var(--gm-boton-borde, currentColor); box-shadow: inset 0 0 0 0.125em var(--gm-boton-borde, currentColor);'),
  r(D + ' .gm-boton:hover', 'filter: brightness(1.07); transform: translateY(-1px); color: var(--gm-boton-texto, #ffffff);'),
  r(D + ' .gm-boton[data-variante="secundario"]:hover', 'color: var(--gm-acento-texto, currentColor);'),
  r(D + ' .gm-boton[data-variante="contorno"]:hover', 'color: var(--gm-boton-borde, currentColor);'),
  r(D + ' .gm-boton:focus-visible', 'outline: 0.15em solid var(--gm-acento-texto, currentColor); outline-offset: 0.15em;'),
  r(D + ' .gm-boton:not([href]):not(button)', 'cursor: default;'),

  '/* ── 9. Recuadros (callouts) por tono ── */',
  r(D + ' .gm-recuadro', 'display: flex; align-items: flex-start; gap: 0.75em; padding: 1em 1.25em; border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-rec-info-fondo, rgba(127,127,127,0.12));'),
  r(D + ' .gm-recuadro-icono', 'flex: none; display: flex; line-height: 0; padding-top: 0.15em; color: var(--gm-rec-info-icono, currentColor);'),
  r(D + ' .gm-recuadro-icono > svg', 'width: 1.25em; height: 1.25em;'),
  r(D + ' .gm-recuadro-cuerpo', 'flex: 1; min-width: 0;'),
  ...TONOS_RECUADRO.flatMap((t) => [
    r(D + ' .gm-recuadro[data-tono="' + t + '"]', 'background: var(--gm-rec-' + t + '-fondo);'),
    r(D + ' .gm-recuadro[data-tono="' + t + '"] > .gm-recuadro-icono', 'color: var(--gm-rec-' + t + '-icono);'),
  ]),

  '/* ── 10. Desplegable (details nativo: anda sin JavaScript) ── */',
  r(D + ' .gm-desplegable', 'padding: 0.85em 0; border-top: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15)); border-bottom: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15));'),
  r(enFlujo(' > .gm-desplegable + .gm-desplegable'), 'margin-top: 0; border-top: 0;'),
  r(D + ' .gm-desplegable-titulo', 'display: flex; align-items: center; justify-content: space-between; gap: 1em; list-style: none; cursor: pointer; font-family: var(--gm-fuente-titulo, inherit); font-weight: 600; font-size: 1.1em; line-height: 1.35; color: var(--gm-titulo, inherit);'),
  r(D + ' .gm-desplegable-titulo::-webkit-details-marker', 'display: none;'),
  r(D + ' .gm-desplegable-titulo::after', 'content: ""; flex: none; width: 0.55em; height: 0.55em; border-right: 0.14em solid var(--gm-acento-texto, currentColor); border-bottom: 0.14em solid var(--gm-acento-texto, currentColor); transform: translateY(-25%) rotate(45deg); transition: transform 0.2s ease;'),
  r(D + ' .gm-desplegable[open] > .gm-desplegable-titulo::after', 'transform: translateY(25%) rotate(-135deg);'),
  r(D + ' .gm-desplegable-cuerpo', 'margin-top: 0.6em;'),

  '/* ── 11. Imagen, video, insertado y HTML personalizado ── */',
  r([D + ' .gm-imagen', D + ' .gm-video'], 'margin: 0 auto; width: 100%; max-width: 100%;'),
  ...ANCHOS_IMAGEN.map((w) => r([D + ' .gm-imagen[data-ancho="' + w + '"]', D + ' .gm-video[data-ancho="' + w + '"]'], 'width: ' + w + '%;')),
  r(D + ' .gm-imagen[data-alinea="izquierda"]', 'margin-left: 0; margin-right: auto;'),
  r(D + ' .gm-imagen[data-alinea="derecha"]', 'margin-left: auto; margin-right: 0;'),
  r([D + ' .gm-imagen img', D + ' .gm-video img'], 'display: block; width: 100%; height: auto;'),
  r(D + ' .gm-imagen[data-forma="redondeada"] img', 'border-radius: var(--gm-radio-caja, 0.35em);'),
  r(D + ' .gm-imagen[data-forma="circulo"] img', 'aspect-ratio: 1; object-fit: cover; border-radius: 50%;'),
  r([D + ' .gm-imagen figcaption', D + ' .gm-video figcaption'], 'margin-top: 0.5em; font-size: 0.85em; text-align: center; color: var(--gm-texto-tenue, inherit);'),
  r(D + ' .gm-video video', 'display: block; width: 100%; height: auto; border-radius: var(--gm-radio-caja, 0.35em); background: #000000;'),
  r(D + ' .gm-insertado', 'width: 100%;'),
  r(D + ' .gm-insertado iframe', 'display: block; width: 100%; aspect-ratio: 16 / 9; height: auto; border: 0; border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-superficie, rgba(127,127,127,0.1));'),
  // Una agenda trae su alto inline (lib/embeds.ts): ahí la proporción no manda.
  r(D + ' .gm-insertado[data-clase="agenda"] iframe', 'aspect-ratio: auto;'),
  r(D + ' .gm-html iframe', 'display: block; width: 100%; height: 300px; border: 0;'),
  ...ALTOS_HTML_LIBRE.map((a) => r(D + ' .gm-html[data-alto="' + a + '"] iframe', 'height: ' + a + 'px;')),
  // Vacíos (sólo en el editor) y marcadores de una miniatura (sin iframes ni videos).
  r([D + ' :is(.gm-imagen, .gm-video, .gm-insertado, .gm-html)[data-vacia="si"]', D + ' .gm-marcador'], 'display: grid; place-items: center; min-height: 8em; border: 0.0625em dashed var(--gm-borde-neutro, rgba(0,0,0,0.2)); border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-superficie, rgba(127,127,127,0.08)); color: var(--gm-texto-tenue, inherit); font-size: 0.85em;'),
  r(D + ' .gm-marcador', 'aspect-ratio: 16 / 9; min-height: 0;'),

  '/* ── 12. Formulario (los datos entran al CRM por el Pixel) ── */',
  r(D + ' .gm-formulario', 'display: grid; gap: 0.9em; width: 100%; max-width: 34em;'),
  r(D + ' .gm-campo', 'display: grid; gap: 0.4em; min-width: 0; margin: 0; padding: 0; border: 0;'),
  r(D + ' .gm-campo-etiqueta', 'padding: 0; font-size: 0.9em; font-weight: 600; color: var(--gm-texto, inherit);'),
  r(D + ' .gm-campo-etiqueta[data-requerido="si"]::after', 'content: " *"; color: var(--gm-acento-texto, currentColor);'),
  r([D + ' .gm-formulario input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])', D + ' .gm-formulario textarea'], 'width: 100%; min-width: 0; padding: 0.7em 0.9em; border: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.2)); border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-superficie, #ffffff); color: var(--gm-texto, inherit); font: inherit; font-size: 1em; line-height: 1.4; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease;'),
  r([D + ' .gm-formulario input:focus', D + ' .gm-formulario textarea:focus'], 'border-color: var(--gm-acento-texto, currentColor); box-shadow: 0 0 0 0.2em var(--gm-acento-suave, rgba(127,127,127,0.2));'),
  r(D + ' .gm-formulario textarea', 'min-height: 7em; resize: vertical;'),
  r(D + ' .gm-opcion', 'display: flex; align-items: center; gap: 0.55em; font-size: 0.95em; cursor: pointer;'),
  r([D + ' .gm-formulario input[type="radio"]', D + ' .gm-formulario input[type="checkbox"]'], 'width: 1.05em; height: 1.05em; margin: 0; accent-color: var(--gm-acento, currentColor);'),
  r(D + ' .gm-formulario > .gm-boton', 'justify-self: start; margin-top: 0.25em;'),
  r(D + ' .gm-formulario-exito', 'margin: 0; padding: 1em 1.25em; border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-rec-exito-fondo, rgba(127,127,127,0.12)); color: var(--gm-texto, inherit); font-weight: 600;'),
  r(D + ' .gm-formulario-exito[hidden]', 'display: none;'),

  '/* ── 13. Gráfico (el SVG de grafico-svg.ts trae sus colores; acá el tamaño y la tinta) ── */',
  r(D + ' .gm-grafico', 'width: 100%; color: var(--gm-texto, inherit);'),
  r(D + ' .gm-grafico svg', 'display: block; width: 100%; height: auto; overflow: visible; font-family: var(--gm-fuente-cuerpo, inherit);'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 14. Diseños optimizados (gamma-tokens §5: grilla de N columnas, gap 2em 1.25em,
//     barras de 4px, cajas con padding 1em y radio de caja)
// ─────────────────────────────────────────────────────────────────────────────

const conteo: string[] = rango(12).slice(1).map((k) =>
  r(D + ' .gm-optimizado:has(> .gm-item:nth-child(' + k + '):last-child)',
    '--gm-cuenta: ' + k + '; --gm-n-rejilla: ' + REJILLA[k] + '; --gm-n-pares: ' + EN_PARES[k] + '; --gm-n-fila: ' + Math.min(k, 6) + '; --gm-n-movil: 2;'));

const indices: string[] = rango(12).map((k) =>
  r(D + ' .gm-item:nth-child(' + k + ')', '--gm-k: ' + k + '; --gm-c: var(--gm-paleta-' + k + '); --gm-c-texto: var(--gm-paleta-' + k + '-texto);'));

/** Un número dibujado por la hoja (contador del ítem), para las variantes numeradas. */
const NUMERO = 'content: counter(gm-item);';
/** El porcentaje del valor (--gm-num lo escribe especificacion.ts desde «97%»), entre 0 y 100. */
const PCT = 'clamp(0%, var(--gm-num, 100) * 1%, 100%)';

const OPTIMIZADO: string[] = [
  '/* ── 14. Diseños optimizados ── */',
  r(D + ' .gm-optimizado', '--gm-cuenta: 1; --gm-n-rejilla: 1; --gm-n-pares: 1; --gm-n-fila: 1; --gm-n-movil: 1; --gm-n: var(--gm-n-rejilla); display: grid; grid-template-columns: repeat(var(--gm-n), minmax(0, 1fr)); gap: 2em 1.25em; align-items: start; counter-reset: gm-item;'),
  ...conteo,
  r(opt(D, PARES), '--gm-n: var(--gm-n-pares);'),
  r(opt(D, UNA), '--gm-n: 1;'),
  r(opt(D, FILA), '--gm-n: var(--gm-n-fila);'),
  // data-cols explícito gana sobre el modo (misma especificidad, va después).
  ...rango(6).map((c) => r(D + ' .gm-optimizado[data-cols="' + c + '"]', '--gm-n: ' + c + ';')),
  ...indices,
  r(D + ' .gm-item', 'position: relative; min-width: 0; display: flex; flex-direction: column; gap: 0.65em; counter-increment: gm-item;'),
  r(D + ' .gm-item-marca', 'flex: none; display: flex; align-items: center; justify-content: flex-start; gap: 0.5em; min-width: 0; color: var(--gm-acento-texto, currentColor);'),
  r(D + ' .gm-item-marca:empty', 'display: none;'),
  r(D + ' .gm-item-cuerpo', 'min-width: 0;'),
  r(D + ' .gm-item-icono', 'display: inline-flex; line-height: 0;'),
  r(D + ' .gm-item-icono > svg', 'width: 1.75em; height: 1.75em;'),
  r(D + ' .gm-optimizado:not([data-iconos="si"]):not(' + CON_ICONOS.map((v) => '[data-variante="' + v + '"]').join(', ') + ') .gm-item-icono', 'display: none;'),
  // Con imagen e ícono a la vez, manda la imagen (una galería no lleva un ícono encima de cada foto).
  r(D + ' .gm-item-marca:has(> .gm-item-imagen) > .gm-item-icono', 'display: none;'),
  r(D + ' .gm-item-imagen', 'display: block; width: 100%; height: auto; object-fit: cover; border-radius: var(--gm-radio-caja, 0.35em);'),
  r(D + ' .gm-item-valor', 'font-family: var(--gm-fuente-titulo, inherit); font-weight: var(--gm-peso-titulo, 700); line-height: 1.1; letter-spacing: var(--gm-tracking-titulos, 0em); color: var(--gm-acento-texto, currentColor);'),

  // ── Viñetas ──
  r(opt(D, ['vinetas-grandes', 'vinetas-pequenas', 'vinetas-iconos', 'vinetas-flechas', 'vinetas-numeradas'], ' > .gm-item'), 'flex-direction: row; align-items: flex-start; gap: 0.85em;'),
  r(opt(D, ['vinetas-grandes', 'vinetas-pequenas', 'vinetas-iconos', 'vinetas-flechas', 'vinetas-numeradas'], ' .gm-item-marca'), 'display: flex; justify-content: center; width: 1.6em; min-height: 1.6em;'),
  r(opt(D, ['vinetas-grandes', 'vinetas-iconos'], ' .gm-item-marca:not(:has(.gm-item-icono))::before'), 'content: ""; width: 0.8em; height: 0.8em; border-radius: 50%; background: var(--gm-acento, currentColor);'),
  r(opt(D, ['vinetas-pequenas'], ''), 'gap: 0.6em;'),
  r(opt(D, ['vinetas-flechas', 'vinetas-numeradas'], ''), 'gap: 1.1em;'),
  r(opt(D, ['vinetas-pequenas'], ' .gm-item-marca'), 'width: 1em;'),
  r(opt(D, ['vinetas-pequenas'], ' .gm-item-marca::before'), 'content: ""; width: 0.45em; height: 0.45em; border-radius: 50%; background: var(--gm-acento, currentColor);'),
  r(opt(D, ['vinetas-flechas'], ' .gm-item-marca::before'), 'content: ""; width: 0.55em; height: 0.55em; border-top: 0.16em solid currentColor; border-right: 0.16em solid currentColor; transform: translateX(-20%) rotate(45deg);'),
  r(opt(D, ['vinetas-numeradas'], ' .gm-item-marca::before'), NUMERO + ' display: grid; place-items: center; width: 1.75em; height: 1.75em; border-radius: 50%; background: var(--gm-acento, #333333); color: var(--gm-acento-contraste, #ffffff); font-size: 0.85em; font-weight: 700;'),
  r(opt(D, ['vinetas-flechas', 'vinetas-numeradas', 'vinetas-pequenas'], ' .gm-item-marca:has(.gm-item-icono)::before'), 'content: none;'),

  // ── Cajas ──
  r(opt(D, ['cajas-solidas', 'cajas-delineadas', 'cajas-iconos', 'cajas-numeros', 'cajas-linea-lateral', 'cajas-alternadas', 'cajas-unidas'], ''), 'gap: 1em;'),
  r(opt(D, ['cajas-solidas', 'cajas-delineadas', 'cajas-iconos', 'cajas-numeros', 'cajas-linea-lateral', 'cajas-alternadas', 'cajas-unidas'], ' > .gm-item'), 'padding: 1.1em 1.2em; border-radius: var(--gm-radio-caja, 0.35em); align-self: stretch;'),
  r(opt(D, ['cajas-solidas', 'cajas-iconos', 'cajas-numeros', 'cajas-unidas'], ' > .gm-item'), 'background: var(--gm-acento-suave, rgba(127,127,127,0.12));'),
  r(opt(D, ['cajas-delineadas'], ' > .gm-item'), 'box-shadow: inset 0 0 0 0.0625em var(--gm-acento-borde, currentColor);'),
  r(opt(D, ['cajas-iconos'], ' .gm-item-icono > svg'), 'width: 2em; height: 2em;'),
  r(opt(D, ['cajas-numeros'], ' .gm-item-marca'), 'display: flex;'),
  r(opt(D, ['cajas-numeros'], ' .gm-item-marca:not(:has(.gm-item-icono, .gm-item-valor))::before'), NUMERO + ' font-family: var(--gm-fuente-titulo, inherit); font-weight: var(--gm-peso-titulo, 700); font-size: 2em; line-height: 1;'),
  r(opt(D, ['cajas-linea-lateral'], ' > .gm-item'), 'background: var(--gm-superficie, rgba(127,127,127,0.1)); box-shadow: inset 0.25em 0 0 var(--gm-acento, currentColor); padding-left: 1.45em;'),
  r(opt(D, ['cajas-alternadas'], ' > .gm-item:nth-child(odd)'), 'background: var(--gm-acento-suave, rgba(127,127,127,0.12));'),
  r(opt(D, ['cajas-alternadas'], ' > .gm-item:nth-child(even)'), INVERTIDO),
  r(opt(D, ['cajas-unidas'], ''), 'gap: 0;'),
  r(opt(D, ['cajas-unidas'], ' > .gm-item'), 'border-radius: 0; box-shadow: inset -0.0625em 0 0 var(--gm-acento-borde, rgba(0,0,0,0.15));'),
  r(opt(D, ['cajas-unidas'], ' > .gm-item:first-child'), 'border-radius: var(--gm-radio-caja, 0.35em) 0 0 var(--gm-radio-caja, 0.35em);'),
  r(opt(D, ['cajas-unidas'], ' > .gm-item:last-child'), 'border-radius: 0 var(--gm-radio-caja, 0.35em) var(--gm-radio-caja, 0.35em) 0; box-shadow: none;'),
  // Un ítem destacado en una caja: el acento lleno.
  r(opt(D, ['cajas-solidas', 'cajas-delineadas', 'cajas-iconos', 'cajas-numeros', 'cajas-linea-lateral', 'cajas-unidas', 'lado-a-lado', 'citas', 'citas-caras'], ' > .gm-item[data-destacado="si"]'), INVERTIDO),
  // Donde el ítem no es una caja, el destacado es la marca llena de acento.
  r(opt(D, ['iconos-izquierda', 'iconos-grandes', 'etapas-iconos'], ' > .gm-item[data-destacado="si"] .gm-item-marca'), 'background: var(--gm-acento, #333333); color: var(--gm-acento-contraste, #ffffff);'),

  // ── Texto con línea (barra de 4px: .25em) ──
  r(opt(D, ['linea-superior'], ' > .gm-item'), 'padding-top: 1.25em;'),
  r(opt(D, ['linea-superior'], ' > .gm-item::before'), 'content: ""; position: absolute; top: 0; left: 0; right: 0; height: 0.25em; border-radius: 0.125em; background: var(--gm-acento, currentColor);'),
  r(opt(D, ['linea-lateral'], ' > .gm-item'), 'padding-left: 1.25em;'),
  r(opt(D, ['linea-lateral'], ' > .gm-item::before'), 'content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 0.25em; border-radius: 0.125em; background: var(--gm-acento, currentColor);'),
  r(opt(D, ['linea-divisoria'], ''), 'gap: 0;'),
  r(opt(D, ['linea-divisoria'], ' > .gm-item'), 'padding: 1em 0; border-top: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15));'),
  r(opt(D, ['linea-divisoria'], ' > .gm-item:last-child'), 'border-bottom: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15));'),

  // ── Línea de tiempo ──
  // Horizontal: punto sobre una línea que cruza hasta el ítem siguiente.
  r(opt(D, ['tiempo-horizontal'], ' > .gm-item'), 'padding-top: 2.4em;'),
  r(opt(D, ['tiempo-horizontal'], ' > .gm-item::before'), 'content: ""; position: absolute; top: 0.55em; left: 0; right: -1.25em; height: 0.125em; background: var(--gm-acento-borde, rgba(0,0,0,0.2));'),
  r(opt(D, ['tiempo-horizontal'], ' > .gm-item:last-child::before'), 'right: 0;'),
  r(opt(D, ['tiempo-horizontal', 'tiempo-vertical', 'tiempo-dos-lados'], ' .gm-item-marca'), 'position: absolute; z-index: 1; display: flex; justify-content: center; width: 1.2em; height: 1.2em; border-radius: 50%; background: var(--gm-acento, #333333); color: var(--gm-acento-contraste, #ffffff); box-shadow: 0 0 0 0.25em var(--gm-tarjeta-color, #ffffff);'),
  r(opt(D, ['tiempo-horizontal', 'tiempo-vertical', 'tiempo-dos-lados'], ' .gm-item-marca > *'), 'display: none;'),
  r(opt(D, ['tiempo-horizontal'], ' .gm-item-marca'), 'top: 0; left: 0;'),
  // Vertical: la línea baja por la izquierda.
  r(opt(D, ['tiempo-vertical'], ''), 'gap: 1.75em;'),
  r(opt(D, ['tiempo-vertical'], ' > .gm-item'), 'padding-left: 2.5em;'),
  r(opt(D, ['tiempo-vertical'], ' > .gm-item::before'), 'content: ""; position: absolute; left: 0.54em; top: 1.2em; bottom: -1.75em; width: 0.125em; background: var(--gm-acento-borde, rgba(0,0,0,0.2));'),
  r(opt(D, ['tiempo-vertical'], ' > .gm-item:last-child::before'), 'display: none;'),
  r(opt(D, ['tiempo-vertical'], ' .gm-item-marca'), 'top: 0.15em; left: 0;'),
  // Dos lados: una línea al centro y los ítems alternados a cada lado.
  r(opt(D, ['tiempo-dos-lados'], ''), 'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 0; row-gap: 1em; position: relative;'),
  r(opt(D, ['tiempo-dos-lados'], '::before'), 'content: ""; position: absolute; top: 0; bottom: 0; left: calc(50% - 0.0625em); width: 0.125em; background: var(--gm-acento-borde, rgba(0,0,0,0.2));'),
  r(opt(D, ['tiempo-dos-lados'], ' > .gm-item:nth-child(odd)'), 'grid-column: 1; padding-right: 2.25em; text-align: right; align-items: flex-end;'),
  r(opt(D, ['tiempo-dos-lados'], ' > .gm-item:nth-child(even)'), 'grid-column: 2; padding-left: 2.25em; margin-top: 2.5em;'),
  r(opt(D, ['tiempo-dos-lados'], ' > .gm-item:nth-child(odd) .gm-item-marca'), 'top: 0.15em; right: -0.6em;'),
  r(opt(D, ['tiempo-dos-lados'], ' > .gm-item:nth-child(even) .gm-item-marca'), 'top: 0.15em; left: -0.6em;'),
  // Minimalista: sólo una línea fina arriba de cada ítem.
  r(opt(D, ['tiempo-minimalista'], ' > .gm-item'), 'padding-top: 1em; border-top: 0.0625em solid var(--gm-acento-borde, rgba(0,0,0,0.2));'),
  r(opt(D, ['tiempo-minimalista'], ' .gm-item-marca'), 'display: none;'),

  // ── Flechas ──
  r(opt(D, ['flechas-horizontales', 'chevrones'], ''), 'gap: 1em 0.35em;'),
  r(opt(D, ['flechas-horizontales', 'chevrones', 'flechas-verticales'], ' .gm-item-marca'), 'display: flex; justify-content: center; font-weight: 700;'),
  r(opt(D, ['flechas-horizontales', 'chevrones', 'flechas-verticales'], ' .gm-item-marca:not(:has(.gm-item-icono, .gm-item-valor))::before'), NUMERO),
  r(opt(D, ['flechas-horizontales'], ' .gm-item-marca'), 'height: 2.6em; padding-right: 0.8em; background: var(--gm-acento-suave, rgba(127,127,127,0.15)); clip-path: polygon(0 0, calc(100% - 1em) 0, 100% 50%, calc(100% - 1em) 100%, 0 100%);'),
  r(opt(D, ['chevrones'], ' .gm-item-marca'), 'height: 3em; padding-inline: 1.4em; background: var(--gm-c, var(--gm-acento)); color: var(--gm-c-texto, #ffffff); clip-path: polygon(0 0, calc(100% - 1.25em) 0, 100% 50%, calc(100% - 1.25em) 100%, 0 100%, 1.25em 50%);'),
  r(opt(D, ['chevrones'], ' > .gm-item:first-child .gm-item-marca'), 'clip-path: polygon(0 0, calc(100% - 1.25em) 0, 100% 50%, calc(100% - 1.25em) 100%, 0 100%);'),
  r(opt(D, ['chevrones'], ' .gm-item-cuerpo'), 'padding-inline: 0.5em; text-align: center;'),
  r(opt(D, ['flechas-verticales'], ' > .gm-item'), 'flex-direction: row; align-items: stretch; gap: 1em;'),
  r(opt(D, ['flechas-verticales'], ' .gm-item-marca'), 'width: 3em; min-height: 3.6em; padding-bottom: 0.6em; background: var(--gm-c, var(--gm-acento)); color: var(--gm-c-texto, #ffffff); clip-path: polygon(0 0, 100% 0, 100% calc(100% - 0.9em), 50% 100%, 0 calc(100% - 0.9em));'),

  // ── Etapas (círculo numerado y conector al siguiente) ──
  r(opt(D, ['etapas-horizontales', 'etapas-iconos'], ' > .gm-item'), 'align-items: center; text-align: center;'),
  r(opt(D, ['etapas-horizontales', 'etapas-iconos', 'etapas-verticales'], ' .gm-item-marca'), 'display: flex; justify-content: center; flex: none; width: 2.6em; height: 2.6em; border-radius: 50%; font-weight: 700;'),
  r(opt(D, ['etapas-horizontales', 'etapas-verticales'], ' .gm-item-marca'), 'background: var(--gm-acento, #333333); color: var(--gm-acento-contraste, #ffffff);'),
  r(opt(D, ['etapas-iconos'], ' .gm-item-marca'), 'width: 3.2em; height: 3.2em; background: var(--gm-acento-suave, rgba(127,127,127,0.15)); color: var(--gm-acento-texto, currentColor);'),
  r(opt(D, ['etapas-horizontales', 'etapas-iconos', 'etapas-verticales'], ' .gm-item-marca:not(:has(.gm-item-icono))::before'), NUMERO),
  r(opt(D, ['etapas-horizontales', 'etapas-iconos', 'etapas-verticales'], ' .gm-item-marca > :is(.gm-item-imagen, .gm-item-valor)'), 'display: none;'),
  r(opt(D, ['etapas-horizontales'], ' > .gm-item:not(:last-child)::after'), 'content: ""; position: absolute; top: 1.3em; left: calc(50% + 1.75em); width: calc(100% + 1.25em - 3.5em); height: 0.125em; background: var(--gm-acento-borde, rgba(0,0,0,0.2));'),
  r(opt(D, ['etapas-iconos'], ' > .gm-item:not(:last-child)::after'), 'content: ""; position: absolute; top: 1.55em; left: calc(50% + 2.1em); width: calc(100% + 1.25em - 4.2em); height: 0.125em; background: var(--gm-acento-borde, rgba(0,0,0,0.2));'),
  r(opt(D, ['etapas-verticales'], ''), 'gap: 1.5em;'),
  r(opt(D, ['etapas-verticales'], ' > .gm-item'), 'flex-direction: row; align-items: flex-start; gap: 1em;'),
  r(opt(D, ['etapas-verticales'], ' > .gm-item:not(:last-child)::after'), 'content: ""; position: absolute; left: 1.24em; top: 2.85em; bottom: -1.35em; width: 0.125em; background: var(--gm-acento-borde, rgba(0,0,0,0.2));'),

  // ── Escalera: barras que suben, el texto encima ──
  r(opt(D, ['escalera'], ''), 'align-items: end; gap: 0.5em;'),
  r(opt(D, ['escalera'], ' > .gm-item'), 'flex-direction: column-reverse; gap: 0.75em;'),
  r(opt(D, ['escalera'], ' .gm-item-marca'), 'display: flex; align-items: flex-start; justify-content: center; padding-top: 0.5em; height: calc(1.5em + var(--gm-k, 1) * 1.6em); border-radius: var(--gm-radio-caja, 0.35em) var(--gm-radio-caja, 0.35em) 0 0; background: var(--gm-c, var(--gm-acento)); color: var(--gm-c-texto, #ffffff); font-weight: 700;'),
  r(opt(D, ['escalera'], ' .gm-item-marca:not(:has(.gm-item-icono, .gm-item-valor))::before'), NUMERO),

  // ── Pirámide y embudo: bandas recortadas con clip-path (la forma, al costado del texto) ──
  r(opt(D, ['piramide', 'piramide-escalonada', 'embudo', 'embudo-minimalista'], ''), 'gap: 0.35em;'),
  r(opt(D, ['piramide', 'piramide-escalonada', 'embudo', 'embudo-minimalista'], ' > .gm-item'), 'display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); align-items: center; gap: 1.5em;'),
  r(opt(D, ['piramide', 'piramide-escalonada', 'embudo', 'embudo-minimalista'], ' .gm-item-marca'), 'display: flex; justify-content: center; height: 3.4em; background: var(--gm-c, var(--gm-acento)); color: var(--gm-c-texto, #ffffff); font-weight: 700;'),
  r(opt(D, ['piramide', 'piramide-escalonada', 'embudo', 'embudo-minimalista'], ' .gm-item-marca > :is(.gm-item-imagen, .gm-item-icono)'), 'display: none;'),
  r(opt(D, ['piramide'], ' .gm-item-marca'), 'clip-path: polygon(calc(50% - (var(--gm-k, 1) - 1) * 50% / var(--gm-cuenta, 1)) 0, calc(50% + (var(--gm-k, 1) - 1) * 50% / var(--gm-cuenta, 1)) 0, calc(50% + var(--gm-k, 1) * 50% / var(--gm-cuenta, 1)) 100%, calc(50% - var(--gm-k, 1) * 50% / var(--gm-cuenta, 1)) 100%);'),
  r(opt(D, ['piramide'], ' > .gm-item:first-child .gm-item-marca > .gm-item-valor'), 'display: none;'),
  r(opt(D, ['piramide-escalonada'], ' .gm-item-marca'), 'justify-self: center; width: calc(var(--gm-k, 1) * 100% / var(--gm-cuenta, 1)); height: 3em; border-radius: var(--gm-radio-caja, 0.35em);'),
  r(opt(D, ['embudo'], ' .gm-item-marca'), 'clip-path: polygon(calc((var(--gm-k, 1) - 1) * 35% / var(--gm-cuenta, 1)) 0, calc(100% - (var(--gm-k, 1) - 1) * 35% / var(--gm-cuenta, 1)) 0, calc(100% - var(--gm-k, 1) * 35% / var(--gm-cuenta, 1)) 100%, calc(var(--gm-k, 1) * 35% / var(--gm-cuenta, 1)) 100%);'),
  r(opt(D, ['embudo-minimalista'], ' .gm-item-marca'), 'justify-self: center; width: calc(100% - (var(--gm-k, 1) - 1) * 60% / var(--gm-cuenta, 1)); height: 2.2em; border-radius: 8em;'),
  r(opt(D, ['embudo', 'embudo-minimalista'], ' .gm-item-marca:not(:has(.gm-item-valor))::before'), NUMERO),

  // ── Ciclos: ítems sobre un círculo (seno y coseno del ángulo de cada uno) ──
  r(opt(D, ['ciclo', 'radial'], ''), 'display: block; position: relative; aspect-ratio: 1; width: min(100%, 36em); margin-inline: auto;'),
  r(opt(D, ['ciclo', 'radial'], '::before'), 'content: ""; position: absolute; inset: 17%; border-radius: 50%; border: 0.125em dashed var(--gm-acento-borde, rgba(0,0,0,0.25));'),
  r(opt(D, ['radial'], '::before'), 'border-style: solid;'),
  r(opt(D, ['ciclo', 'radial'], ' > .gm-item'), 'position: absolute; width: 30%; left: calc(50% + 34% * sin(var(--gm-ang, 0deg))); top: calc(50% - 34% * cos(var(--gm-ang, 0deg))); transform: translate(-50%, -50%); align-items: center; text-align: center; gap: 0.4em; font-size: 0.85em;'),
  r(opt(D, ['ciclo'], ' > .gm-item'), '--gm-ang: calc((var(--gm-k, 1) - 1) * 360deg / var(--gm-cuenta, 1));'),
  r(opt(D, ['radial'], ' > .gm-item'), '--gm-ang: calc((var(--gm-k, 1) - 2) * 360deg / max(1, var(--gm-cuenta, 1) - 1));'),
  r(opt(D, ['radial'], ' > .gm-item:first-child'), 'left: 50%; top: 50%; width: 32%; font-size: 0.95em;'),
  r(opt(D, ['ciclo', 'radial'], ' .gm-item-marca'), 'display: flex; justify-content: center; width: 2.4em; height: 2.4em; border-radius: 50%; background: var(--gm-c, var(--gm-acento)); color: var(--gm-c-texto, #ffffff); font-weight: 700;'),
  r(opt(D, ['ciclo', 'radial'], ' .gm-item-marca:not(:has(.gm-item-icono, .gm-item-valor))::before'), NUMERO),
  r(opt(D, ['ciclo', 'radial'], ' .gm-item-marca > .gm-item-imagen'), 'display: none;'),
  // Círculos concéntricos: los círculos a la izquierda (el primero, el más grande), el texto a la derecha.
  r(opt(D, ['circulos-concentricos'], ''), 'display: block; position: relative; min-height: 22em; padding-left: 46%;'),
  r(opt(D, ['circulos-concentricos'], ' > .gm-item'), 'position: static; padding-left: 0.9em; box-shadow: inset 0.25em 0 0 var(--gm-c, var(--gm-acento));'),
  r(opt(D, ['circulos-concentricos'], ' > .gm-item + .gm-item'), 'margin-top: 1.25em;'),
  r(opt(D, ['circulos-concentricos'], ' .gm-item-marca'), 'display: block; position: absolute; left: 22%; top: 50%; z-index: var(--gm-k, 1); width: calc((var(--gm-cuenta, 1) - var(--gm-k, 1) + 1) * 40% / var(--gm-cuenta, 1)); aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; background: var(--gm-c, var(--gm-acento)); box-shadow: 0 0 0 0.2em var(--gm-tarjeta-color, #ffffff);'),
  r(opt(D, ['circulos-concentricos'], ' .gm-item-marca > *'), 'display: none;'),

  // ── Estadísticas ──
  r(opt(D, ['numeros-grandes', 'metrica-destacada'], ' .gm-item-valor'), 'font-size: 3.2em;'),
  r(opt(D, ['metrica-destacada'], ' > .gm-item:first-child'), 'grid-column: 1 / -1;'),
  r(opt(D, ['metrica-destacada'], ' > .gm-item:first-child .gm-item-valor'), 'font-size: 5em;'),
  r(opt(D, ['numeros-grandes', 'metrica-destacada'], ' > .gm-item[data-destacado="si"] .gm-item-valor'), 'background-image: var(--gm-titulo-degradado, none); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: var(--gm-titulo-relleno, currentColor); color: var(--gm-titulo, inherit);'),
  // Circulares: un anillo cónico con el porcentaje y el valor en el centro.
  r(opt(D, ['estadisticas-circulares'], ' > .gm-item'), 'align-items: center; text-align: center;'),
  r(opt(D, ['estadisticas-circulares'], ' .gm-item-marca'), 'display: flex; justify-content: center; position: relative; isolation: isolate; width: 6.5em; height: 6.5em; border-radius: 50%; background: conic-gradient(var(--gm-acento, currentColor) ' + PCT + ', var(--gm-superficie, rgba(127,127,127,0.15)) 0);'),
  r(opt(D, ['estadisticas-circulares'], ' .gm-item-marca::before'), 'content: ""; position: absolute; inset: 0.55em; z-index: -1; border-radius: 50%; background: var(--gm-tarjeta-color, #ffffff);'),
  r(opt(D, ['estadisticas-circulares'], ' .gm-item-valor'), 'font-size: 1.4em;'),
  r(opt(D, ['estadisticas-circulares'], ' .gm-item-marca > :is(.gm-item-icono, .gm-item-imagen)'), 'display: none;'),
  // De barras: el valor y una barra con el porcentaje.
  r(opt(D, ['estadisticas-barras'], ' .gm-item-marca'), 'display: flex; gap: 0.85em;'),
  r(opt(D, ['estadisticas-barras'], ' .gm-item-marca::after'), 'content: ""; flex: 1; height: 0.7em; border-radius: 8em; background: linear-gradient(90deg, var(--gm-c, var(--gm-acento)) ' + PCT + ', var(--gm-superficie, rgba(127,127,127,0.15)) 0);'),
  r(opt(D, ['estadisticas-barras'], ' .gm-item-valor'), 'flex: none; min-width: 3.5em; font-size: 1.25em;'),
  r(opt(D, ['estadisticas-barras'], ' .gm-item-marca > :is(.gm-item-icono, .gm-item-imagen)'), 'display: none;'),
  // Estrellas: cinco estrellas enmascaradas, llenas hasta el valor (--gm-num sobre 5).
  r(opt(D, ['estrellas'], ' .gm-item-marca'), 'display: flex; gap: 0.6em;'),
  r(opt(D, ['estrellas'], ' .gm-item-marca::before'), 'content: ""; flex: none; width: 6em; height: 1.2em; background: linear-gradient(90deg, var(--gm-acento, #f5b400) clamp(0%, var(--gm-num, 5) * 20%, 100%), var(--gm-borde-neutro, rgba(0,0,0,0.15)) 0); -webkit-mask: ' + ESTRELLA + ' 0 0 / 1.2em 1.2em repeat-x; mask: ' + ESTRELLA + ' 0 0 / 1.2em 1.2em repeat-x;'),
  r(opt(D, ['estrellas'], ' .gm-item-valor'), 'font-size: 1.1em;'),
  r(opt(D, ['estrellas'], ' .gm-item-marca > :is(.gm-item-icono, .gm-item-imagen)'), 'display: none;'),

  // ── Comparación ──
  r(opt(D, ['lado-a-lado', 'versus'], ' > .gm-item'), 'align-self: stretch; padding: 1.25em; border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-superficie, rgba(127,127,127,0.1));'),
  r(opt(D, ['lado-a-lado'], ' > .gm-item'), 'box-shadow: inset 0 0.25em 0 var(--gm-c, var(--gm-acento));'),
  r(opt(D, ['versus'], ''), 'column-gap: 3.5em;'),
  r(opt(D, ['versus'], ' > .gm-item:nth-child(odd):not(:last-child)::after'), 'content: "VS"; position: absolute; top: 50%; right: -2.95em; transform: translateY(-50%); z-index: 1; display: grid; place-items: center; width: 2.4em; height: 2.4em; border-radius: 50%; background: var(--gm-acento, #333333); color: var(--gm-acento-contraste, #ffffff); font-weight: 700; font-size: 0.9em; letter-spacing: 0.02em;'),
  r(opt(D, ['pros-contras'], ' > .gm-item'), 'align-self: stretch; padding: 1.25em; border-radius: var(--gm-radio-caja, 0.35em);'),
  r(opt(D, ['pros-contras'], ' > .gm-item:nth-child(odd)'), 'background: var(--gm-rec-exito-fondo, rgba(0,160,80,0.12));'),
  r(opt(D, ['pros-contras'], ' > .gm-item:nth-child(even)'), 'background: var(--gm-rec-precaucion-fondo, rgba(220,0,0,0.1));'),
  r(opt(D, ['pros-contras'], ' .gm-item-marca'), 'display: flex; font-weight: 700; font-size: 1.3em;'),
  r(opt(D, ['pros-contras'], ' > .gm-item:nth-child(odd) .gm-item-marca'), 'color: var(--gm-rec-exito-icono, currentColor);'),
  r(opt(D, ['pros-contras'], ' > .gm-item:nth-child(even) .gm-item-marca'), 'color: var(--gm-rec-precaucion-icono, currentColor);'),
  r(opt(D, ['pros-contras'], ' > .gm-item:nth-child(odd) .gm-item-marca:not(:has(.gm-item-icono))::before'), 'content: "\\2713";'),
  r(opt(D, ['pros-contras'], ' > .gm-item:nth-child(even) .gm-item-marca:not(:has(.gm-item-icono))::before'), 'content: "\\2715";'),

  // ── Imágenes ──
  r(opt(D, ['galeria'], ''), 'gap: 0.75em;'),
  r(opt(D, ['galeria', 'imagenes-texto'], ' .gm-item-marca'), 'display: block;'),
  r(opt(D, ['galeria'], ' .gm-item-imagen'), 'aspect-ratio: 4 / 3;'),
  r(opt(D, ['galeria'], ' .gm-item-cuerpo'), 'font-size: 0.85em; color: var(--gm-texto-tenue, inherit);'),
  r(opt(D, ['imagenes-texto'], ' .gm-item-imagen'), 'aspect-ratio: 16 / 10;'),
  r(opt(D, ['imagenes-circulares', 'equipo'], ' > .gm-item'), 'align-items: center; text-align: center;'),
  r(opt(D, ['imagenes-circulares', 'equipo'], ' .gm-item-marca'), 'display: flex; justify-content: center; width: min(70%, 9em); aspect-ratio: 1; border-radius: 50%; overflow: hidden; background: var(--gm-superficie, rgba(127,127,127,0.12));'),
  r(opt(D, ['imagenes-circulares', 'equipo'], ' .gm-item-imagen'), 'width: 100%; height: 100%; aspect-ratio: 1; border-radius: 50%;'),
  r(opt(D, ['equipo'], ' .gm-item-marca'), 'width: 7em;'),
  r(opt(D, ['imagenes-circulares', 'equipo'], ' .gm-item-marca > :is(.gm-item-icono, .gm-item-valor)'), 'display: none;'),
  r(opt(D, ['logos'], ''), 'align-items: center; gap: 1.5em 2em;'),
  r(opt(D, ['logos'], ' > .gm-item'), 'align-items: center; text-align: center; gap: 0.4em;'),
  r(opt(D, ['logos'], ' .gm-item-marca'), 'display: flex; justify-content: center; height: 3.2em;'),
  r(opt(D, ['logos'], ' .gm-item-imagen'), 'width: auto; max-width: 100%; max-height: 100%; height: 100%; object-fit: contain; border-radius: 0; filter: grayscale(1); opacity: 0.85;'),
  r(opt(D, ['logos'], ' .gm-item-cuerpo'), 'font-size: 0.85em; color: var(--gm-texto-tenue, inherit);'),

  // ── Personas ──
  r(opt(D, ['nombre-rol'], ' > .gm-item'), 'padding-left: 0.9em; box-shadow: inset 0.2em 0 0 var(--gm-acento, currentColor);'),
  r(opt(D, ['nombre-rol'], ' .gm-item-marca'), 'display: none;'),

  // ── Íconos ──
  r(opt(D, ['iconos-texto'], ' .gm-item-icono > svg'), 'width: 2em; height: 2em;'),
  r(opt(D, ['iconos-izquierda'], ' > .gm-item'), 'flex-direction: row; align-items: flex-start; gap: 1em;'),
  r(opt(D, ['iconos-izquierda'], ' .gm-item-marca'), 'display: flex; justify-content: center; width: 2.75em; height: 2.75em; border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-acento-suave, rgba(127,127,127,0.15));'),
  r(opt(D, ['iconos-izquierda'], ' .gm-item-icono > svg'), 'width: 1.5em; height: 1.5em;'),
  r(opt(D, ['iconos-grandes'], ' > .gm-item'), 'align-items: center; text-align: center;'),
  r(opt(D, ['iconos-grandes'], ' .gm-item-marca'), 'display: flex; justify-content: center; width: 5em; height: 5em; border-radius: 50%; background: var(--gm-acento-suave, rgba(127,127,127,0.15));'),
  r(opt(D, ['iconos-grandes'], ' .gm-item-icono > svg'), 'width: 2.6em; height: 2.6em;'),
  r(opt(D, ['iconos-texto', 'iconos-izquierda', 'iconos-grandes'], ' .gm-item-marca > :is(.gm-item-imagen, .gm-item-valor)'), 'display: none;'),

  // ── Citas ──
  r(opt(D, ['citas', 'citas-caras'], ' > .gm-item'), 'align-self: stretch; padding: 1.5em; border-radius: var(--gm-radio-caja, 0.35em); background: var(--gm-superficie, rgba(127,127,127,0.1));'),
  r(opt(D, ['citas'], ' > .gm-item'), 'padding-top: 2.8em;'),
  r(opt(D, ['citas'], ' > .gm-item::before'), 'content: "\\201C"; position: absolute; top: 0.12em; left: 0.4em; font-family: var(--gm-fuente-titulo, Georgia, serif); font-size: 3.6em; line-height: 1; color: var(--gm-acento-texto, currentColor);'),
  r(opt(D, ['citas'], ' .gm-item-marca'), 'display: none;'),
  r(opt(D, ['citas-caras'], ' .gm-item-marca'), 'display: flex; width: 3.4em; height: 3.4em; border-radius: 50%; overflow: hidden; background: var(--gm-acento-suave, rgba(127,127,127,0.15));'),
  r(opt(D, ['citas-caras'], ' .gm-item-imagen'), 'width: 100%; height: 100%; aspect-ratio: 1; border-radius: 50%;'),
  r(opt(D, ['citas-caras'], ' .gm-item-marca > :is(.gm-item-icono, .gm-item-valor)'), 'display: none;'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 15. El sitio: barra, pie y sello
// ─────────────────────────────────────────────────────────────────────────────

const SITIO: string[] = [
  '/* ── 15. Sitio: nav.gm-nav, footer.gm-pie, a.gm-marca ── */',
  // La barra del sitio publicado (Gamma: 75px, fondo de la tarjeta, esmerilado).
  r(D + ' .gm-nav', 'position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--gm-tarjeta-color, #ffffff) 88%, transparent); -webkit-backdrop-filter: blur(20px) saturate(170%); backdrop-filter: blur(20px) saturate(170%); box-shadow: 0 0.0625em 0 var(--gm-borde-neutro, rgba(0,0,0,0.12)); color: var(--gm-texto, inherit); font-family: var(--gm-fuente-cuerpo, inherit);'),
  r(D + ' .gm-nav-interior', 'display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.6em 2em; width: min(72em, calc(100% - 3em)); min-height: 4.2em; margin-inline: auto; padding-block: 0.6em;'),
  r(D + ' .gm-nav-marca', 'display: inline-flex; align-items: center; gap: 0.6em; color: var(--gm-titulo, inherit); font-family: var(--gm-fuente-titulo, inherit); font-weight: var(--gm-peso-titulo, 700); font-size: 1.15em; text-decoration: none;'),
  r(D + ' .gm-nav-marca:hover', 'color: var(--gm-titulo, inherit);'),
  r(D + ' .gm-nav-logo', 'display: block; height: 2.25em; width: auto; max-width: 12em; object-fit: contain;'),
  r(D + ' .gm-nav-enlaces', 'display: flex; flex-wrap: wrap; align-items: center; gap: 0.25em; margin: 0; padding: 0; list-style: none;'),
  r(D + ' .gm-nav-enlaces li + li', 'margin-top: 0;'),
  r(D + ' .gm-nav-enlace', 'display: inline-flex; align-items: center; min-height: 2.5em; padding: 0.4em 0.9em; border-radius: 8em; color: var(--gm-texto, inherit); font-weight: 500; text-decoration: none;'),
  r(D + ' .gm-nav-enlace:hover', 'background: var(--gm-superficie, rgba(127,127,127,0.12)); color: var(--gm-texto, inherit);'),
  r(D + ' .gm-nav-botones', 'display: flex; flex-wrap: wrap; align-items: center; gap: 0.5em;'),
  r(D + ' .gm-nav-botones .gm-boton', 'min-height: 2.4em; padding: 0.4em 1em; font-size: 0.95em;'),
  // El pie: sobre el color de la tarjeta (no sobre el fondo de la página, que puede ser de cualquier tono).
  r(D + ' .gm-pie', 'margin-top: 3.5em; padding: 2.25em 1.5em; background: var(--gm-tarjeta-color, #ffffff); color: var(--gm-texto-tenue, inherit); font-family: var(--gm-fuente-cuerpo, inherit); font-size: 0.9em; line-height: 1.6; text-align: center;'),
  r(D + ' .gm-pagina:has(> .gm-tarjeta[data-ancho="completo"]:last-child) + .gm-pie', 'margin-top: 0;'),
  r(D + ' .gm-pie p', 'max-width: 64.5em; margin-inline: auto;'),
  r(D + ' .gm-pie a', 'color: var(--gm-texto, inherit);'),
  // «Hecho con MaKo»: flota abajo a la derecha en la página publicada, como el sello de Gamma.
  r(D + ' .gm-marca', 'position: fixed; right: 1rem; bottom: 1rem; z-index: 40; display: inline-flex; align-items: center; gap: 0.45em; padding: 0.5em 0.9em; border-radius: 8em; background: var(--gm-tarjeta-color, #ffffff); color: var(--gm-texto, #161616); box-shadow: 0 0.25em 0.9em rgba(0,0,0,0.18), 0 0 0 0.0625em var(--gm-borde-neutro, rgba(0,0,0,0.12)); font: 600 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; text-decoration: none; -webkit-text-fill-color: currentColor; transition: transform 0.15s ease;'),
  r(D + ' .gm-marca:hover', 'transform: translateY(-1px); color: var(--gm-texto, #161616);'),
  // Fuera de la página publicada (editor, miniatura, exportar) el sello no flota sobre la pantalla de nadie.
  r(D + ':not([data-modo="publico"]) .gm-marca', 'position: static; display: flex; width: max-content; margin: 1.5em auto 0;'),
  // En una miniatura la sección ocupa todo el cuadro, sin el aire de la página.
  r(D + '[data-modo="miniatura"] .gm-pagina', 'padding: 0;'),
  r(D + '[data-modo="miniatura"] .gm-tarjeta', 'width: 100%; margin: 0;'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 16. Animación de entrada (Gamma: translateY(20px) → 0 y opacidad, 1s
//     cubic-bezier(0.22,1,0.36,1), .15s de demora)
// ─────────────────────────────────────────────────────────────────────────────
// El mecanismo es el del script de la página (pagina-publica.ts, paquete F): pone
// `html.gm-anim` SÓLO si corre (sin JavaScript —un crawler, la vista previa de
// WhatsApp— no se esconde nada) y marca `.gm-visto` en cada sección al entrar en
// pantalla. Acá van los tiempos de Gamma: la sección aparece y sus bloques suben en
// cascada. Va después de la hoja del documento y la pisa con la misma especificidad.

const ANIMACION: string[] = [
  '/* ── 16. Animación de entrada ── */',
  '@keyframes gm-aparecer { from { opacity: 0; } }',
  '@keyframes gm-entrada { from { opacity: 0; transform: translateY(20px); } }',
  r(['html.gm-anim .gm-tarjeta:not(.gm-visto)', 'html.gm-anim [data-animar]:not(.gm-visto)'], 'opacity: 0;'),
  r('html.gm-anim .gm-tarjeta.gm-visto', 'animation: gm-aparecer 0.6s ease backwards;'),
  r(['html.gm-anim .gm-tarjeta.gm-visto > .gm-tarjeta-cuerpo > *', 'html.gm-anim [data-animar].gm-visto'], 'animation: gm-entrada 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards;'),
  ...rango(7).map((k) => r('html.gm-anim .gm-tarjeta.gm-visto > .gm-tarjeta-cuerpo > :nth-child(' + (k + 1) + ')', 'animation-delay: ' + (0.15 + k * 0.08).toFixed(2) + 's;')),
  r('html.gm-anim .gm-tarjeta.gm-visto > .gm-tarjeta-cuerpo > :nth-child(n+9)', 'animation-delay: 0.79s;'),
  '@media (prefers-reduced-motion: reduce) { ' +
    r(['html.gm-anim .gm-tarjeta', 'html.gm-anim .gm-tarjeta > .gm-tarjeta-cuerpo > *', 'html.gm-anim [data-animar]'], 'opacity: 1 !important; animation: none !important;') +
    ' ' + r([D + ' .gm-boton', D + ' .gm-marca', D + ' .gm-desplegable-titulo::after'], 'transition: none;') + ' }',
];

// ─────────────────────────────────────────────────────────────────────────────
// 17. Tableta y celular: la página real (media query) y la vista previa del editor
//     (.gm-doc[data-dispositivo]) leen EL MISMO bloque
// ─────────────────────────────────────────────────────────────────────────────

function tableta(p: string): string[] {
  return [
    r(p + ' h1.gm-titulo', tamTitulo(4)),
    r(p + ' .gm-tarjeta-cuerpo', 'padding: 2.25em 2.5em;'),
    r(p + ' .gm-tarjeta:is([data-diseno="izquierda"], [data-diseno="derecha"])', 'min-height: 22em;'),
  ];
}

/** Ítems que en celular siguen de a dos (imágenes, logos, números chicos). */
const DE_A_DOS: readonly VarianteOptimizado[] = ['galeria', 'logos', 'imagenes-circulares', 'equipo', 'numeros-grandes', 'estadisticas-circulares', 'iconos-grandes'];
/** Los que en celular se vuelven una lista vertical con la marca a la izquierda. */
const A_LISTA: readonly VarianteOptimizado[] = ['tiempo-horizontal', 'etapas-horizontales', 'etapas-iconos', 'ciclo', 'radial', 'circulos-concentricos', 'tiempo-dos-lados'];

// ⚠️ Varias formas de escritorio se escriben con `:nth-child(odd)`, `:first-child` o
// `:not(:last-child)`, que suman especificidad. El bloque de celular repite ese peso
// con `:nth-child(n)` (que elige a todos): con el mismo peso gana el que va después,
// que es éste. Sin eso, el primer ítem de «Radial» quedaba corrido 50% a la derecha y
// los de «dos lados» conservaban la columna de escritorio.
const N = ':nth-child(n)';

function movil(p: string): string[] {
  return [
    r(p + ' .gm-pagina', 'font-size: var(--gm-base-movil, 16px); padding-bottom: 2em;'),
    r(p + ' .gm-tarjeta', 'width: calc(100% - 1.5em); margin-top: 1.5em;'),
    r(p + ' .gm-tarjeta[data-ancho="completo"]', 'width: 100%; margin-top: 0;'),
    r(p + ' .gm-tarjeta:not([data-ancho="completo"]) + .gm-tarjeta[data-ancho="completo"]', 'margin-top: 1.5em;'),
    r(p + ' .gm-tarjeta-cuerpo', 'padding: 2em 1.4em;'),
    // La imagen al costado pasa arriba (12.5em), como en Gamma.
    r(p + ' .gm-tarjeta:is([data-diseno="izquierda"], [data-diseno="derecha"])', 'grid-template-columns: minmax(0, 1fr); grid-template-areas: "acento" "cuerpo"; grid-template-rows: auto 1fr; min-height: 0;'),
    r(p + ' .gm-tarjeta:is([data-diseno="izquierda"], [data-diseno="derecha"], [data-diseno="arriba"]) > .gm-acento', 'height: 12.5em; border-radius: var(--gm-radio-tarjeta, 0.6em) var(--gm-radio-tarjeta, 0.6em) 0 0;'),
    r(p + ' .gm-tarjeta[data-diseno="fondo"]', 'min-height: 20em;'),
    r(p + ' .gm-tarjeta[data-alto="pantalla"]', 'min-height: calc(100vh - 3em); min-height: calc(100svh - 3em);'),
    r(p + ' h1.gm-titulo', tamTitulo(2.6)),
    r(p + ' h1', tamTitulo(2)),
    r(p + ' h2', tamTitulo(1.6)),
    r(p + ' h3', tamTitulo(1.3)),
    r(p + ' h4', tamTitulo(1.15)),
    // Columnas apiladas (el --gm-cols inline queda sin efecto: se pisa la propiedad, no la variable).
    r(p + ' .gm-columnas', 'grid-template-columns: minmax(0, 1fr); gap: 1.5em;'),
    r(p + ' .gm-columnas[data-divisores="si"] > .gm-columna + .gm-columna::before', 'top: -0.75em; bottom: auto; left: 0; right: 0; border-left: 0; border-top: 0.0625em solid var(--gm-borde-neutro, rgba(0,0,0,0.15));'),
    // Diseños optimizados: de a uno (de a dos los de imágenes y números). Gana a data-cols.
    r(p + ' .gm-optimizado[data-variante]', '--gm-n: 1;'),
    r(opt(p, DE_A_DOS), '--gm-n: var(--gm-n-movil);'),
    r(opt(p, ['cajas-unidas'], ''), 'gap: 0.5em;'),
    r(opt(p, ['cajas-unidas'], ' > .gm-item' + N), 'border-radius: var(--gm-radio-caja, 0.35em); box-shadow: none;'),
    r(opt(p, ['versus'], ''), 'row-gap: 3em;'),
    r(opt(p, ['versus'], ' > .gm-item:nth-child(odd):not(:last-child)::after'), 'top: auto; bottom: -2.1em; right: auto; left: 50%; transform: translateX(-50%);'),
    r(opt(p, ['chevrones', 'flechas-horizontales'], ' > .gm-item' + N + ' .gm-item-marca'), 'clip-path: polygon(0 0, 100% 0, 100% calc(100% - 0.7em), 50% 100%, 0 calc(100% - 0.7em)); padding: 0 0 0.6em; height: 3em;'),
    r(opt(p, ['escalera'], ' > .gm-item'), 'flex-direction: column;'),
    r(opt(p, ['escalera'], ' .gm-item-marca'), 'height: 2.4em; width: calc(35% + var(--gm-k, 1) * 65% / var(--gm-cuenta, 1)); border-radius: var(--gm-radio-caja, 0.35em);'),
    r(opt(p, ['piramide', 'piramide-escalonada', 'embudo', 'embudo-minimalista'], ' > .gm-item'), 'grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 1em;'),
    // Las que eran horizontales o circulares pasan a lista vertical con la marca a la izquierda.
    r(opt(p, A_LISTA, ''), 'display: grid; grid-template-columns: minmax(0, 1fr); aspect-ratio: auto; width: auto; min-height: 0; padding-left: 0; gap: 1.5em;'),
    r(opt(p, A_LISTA, '::before'), 'display: none;'),
    r(opt(p, A_LISTA, ' > .gm-item' + N), 'position: relative; left: auto; top: auto; width: auto; transform: none; grid-column: 1; margin-top: 0; padding: 0 0 0 3.2em; text-align: left; align-items: flex-start; font-size: 1em; box-shadow: none;'),
    r(opt(p, A_LISTA, ' > .gm-item' + N + '::before'), 'display: none;'),
    r(opt(p, A_LISTA, ' > .gm-item' + N + '::after'), 'display: none;'),
    r(opt(p, A_LISTA, ' > .gm-item' + N + ' .gm-item-marca'), 'position: absolute; left: 0; top: 0; right: auto; z-index: 1; display: flex; justify-content: center; width: 2.2em; height: 2.2em; aspect-ratio: auto; transform: none; border-radius: 50%; box-shadow: none; font-size: 1em;'),
    r(opt(p, ['circulos-concentricos'], ' > .gm-item' + N + ' .gm-item-marca'), 'width: 1.4em; height: 1.4em; top: 0.15em;'),
    r(opt(p, ['tiempo-horizontal', 'tiempo-dos-lados'], ' > .gm-item' + N + ' .gm-item-marca'), 'width: 1.2em; height: 1.2em; top: 0.15em; left: 0.5em;'),
    // La barra del sitio: los enlaces bajan a su propio renglón.
    r(p + ' .gm-nav-interior', 'width: calc(100% - 1.5em); gap: 0.4em 1em;'),
    r(p + ' .gm-nav-enlaces', 'order: 3; width: 100%; justify-content: center; font-size: 0.92em;'),
    r(p + ' .gm-pie', 'margin-top: 2em;'),
  ];
}

const RESPONSIVE: string[] = [
  '/* ── 17. Tableta (≤ 1024px) y celular (≤ 768px) ── */',
  '@media (max-width: 1024px) {',
  ...tableta(D),
  '}',
  ...tableta(D + '[data-dispositivo="tableta"]'),
  ...tableta(D + '[data-dispositivo="movil"]'),
  '@media (max-width: 768px) {',
  ...movil(D),
  '}',
  ...movil(D + '[data-dispositivo="movil"]'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 18. Impresión (PDF: una sección por hoja)
// ─────────────────────────────────────────────────────────────────────────────

const IMPRESION: string[] = [
  '/* ── 18. Impresión: una sección por hoja, con sus colores ── */',
  '@media print {',
  '@page { margin: 10mm; }',
  r(D, '-webkit-print-color-adjust: exact; print-color-adjust: exact;'),
  r(D + ' .gm-fondo', 'background-attachment: scroll; min-height: 0;'),
  r([D + ' .gm-nav', D + ' .gm-marca'], 'display: none !important;'),
  r(D + ' .gm-pagina', 'padding: 0; font-size: 12pt;'),
  r(D + ' .gm-tarjeta', 'width: 100% !important; margin: 0 auto !important; min-height: 0 !important; break-inside: avoid; break-after: page;'),
  r(D + ' .gm-tarjeta:last-child', 'break-after: auto;'),
  r(D + ' .gm-tarjeta-fondo', 'box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none;'),
  r(D + ' .gm-boton', 'transform: none; filter: none;'),
  '}',
];

/**
 * La hoja del contenido: la misma en el editor y en la página publicada. Un string
 * sin backticks ni `${` (va adentro de un <style>), armado una vez al cargar.
 */
export const CSS_CONTENIDO: string = [
  ...RAIZ, ...TARJETA, ...ACENTO, ...TIPOGRAFIA, ...MARCAS_TEXTO, ...BLOQUES, ...OPTIMIZADO,
  ...SITIO, ...ANIMACION, ...RESPONSIVE, ...IMPRESION,
].join('\n');

/** Las variantes que la hoja reparte por modo (para el test: ninguna queda sin forma). */
export const MODOS_OPTIMIZADO = { pares: PARES, una: UNA, fila: FILA, especiales: ESPECIALES } as const;
