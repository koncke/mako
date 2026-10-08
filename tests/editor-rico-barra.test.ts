// =============================================================================
// editor-rico-barra — la barra del editor rico en UN renglón, y el tamaño de una imagen
// =============================================================================
// Pedido de Martín (08/10/2026): item 4 «Intenta que las opciones en la barra de edición no se
// salten de línea... Que si tiene mucho zoom que haya un desplegable», item 10 «Si subo una imagen
// en la descripción se ve enorme, no tengo manera de editar el tamaño... Y también falta una opción
// en la descripción de agregar tabla», item 3 «Los textos de la descripción y tarea deben seguir la
// misma tipografía».
//
// Ejecuta las reglas puras de app/_ui/editor-rico-reglas.ts (qué piezas de la barra entran y cuáles
// van a «Más»; cuánto mide una imagen) y mira en el fuente de app/_ui/EditorRico.tsx que la barra
// las USE como se debe: medir contra la REGLA escondida (nunca contra lo que la barra muestra, que
// es lo que la decisión cambia), un solo renglón, los `data-recorrido` que arma el tutorial.
//
// Probado ROMPIÉNDOLO (08/10/2026), una rotura por vez sobre el archivo real, restaurado desde la
// copia en memoria (verificado por hash). Con todo en su lugar: 11 pass / 0 fail. Cada rotura y lo
// que tumbó:
//   · `repartoDeBarra` sin el hueco entre piezas (`gap` ignorado)    → 7 / 4 (todo entra, lo visible ENTRA, el grupo, la barra real)
//   · sin sacar el separador que queda colgando al final             → 9 / 2 (lo visible ENTRA… y no termina en separador; la barra real)
//   · sin la regla del huérfano (una pieza sola de su grupo)         → 9 / 2 (el grupo no se parte; la barra real)
//   · la tolerancia de 0,5 px subida a 8 px                           → 9 / 2 (todo entra; lo visible ENTRA)
//   · `anchoDeArrastre` sin saltar de a 5 (`Math.round(pct)`)        → 10 / 1 (el ancho de una imagen)
//   · `anchoInicialDeImagen` sin el tope del 60 %                    → 10 / 1 (el ancho de una imagen)
//   · el editor mide los hijos de la BARRA en vez de los de la regla → 10 / 1 (el editor mide contra la regla)
//   · `.mk-er-barra` con `flex-wrap: wrap`                           → 10 / 1 (un solo renglón)
//   · sin el `window.resize` (el zoom no vuelve a decidir)           → 10 / 1 (el editor mide contra la regla)
//   · sin `data-recorrido="editor-mas"`                              → 10 / 1 (los puntos del recorrido)
//   · sin `closeHistory(tr)` en el cambio de tamaño                  → 10 / 1 (la imagen y la tabla, en el editor)
// Y en Chrome (el banco de la sesión, editor-rico/tanda3): la barra a 100, 150 y 200 % de zoom, a
// lo ancho y al costado del video, quedó en UN renglón, sin nada cortado y sin scroll de la página,
// con «Más» en los cinco casos donde no entraba; achicando y agrandando la ventana en vivo
// (1280 → 320 → 1280) volvió a decidir en cada paso. Los seis anchos medidos están abajo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repartoDeBarra, recortarSeparadores, anchoDeArrastre, anchoInicialDeImagen, anchoValido, ANCHO_IMAGEN_NUEVA, type PiezaBarra } from '../app/_ui/editor-rico-reglas';
import { ANCHOS_IMAGEN } from '../app/_ui/HtmlSeguro';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const ocupa = (p: readonly PiezaBarra[], k: number, gap: number) => p.slice(0, k).reduce((s, x, i) => s + x.ancho + (i > 0 ? gap : 0), 0);

/** La barra de verdad, como la mide el navegador: botones de 30, separadores de 9, el selector de 118, hueco de 2. */
const BTN: PiezaBarra = { ancho: 30 };
const SEP: PiezaBarra = { ancho: 9, sep: true };
const BLOQUE: PiezaBarra = { ancho: 118 };
const BARRA: PiezaBarra[] = [
  BTN, BTN, SEP, // deshacer, rehacer
  BTN, BTN, BTN, BTN, BTN, BTN, SEP, // negrita … resaltar
  BLOQUE, SEP,
  BTN, BTN, BTN, BTN, SEP, // enlace, imagen, archivo, tabla
  BTN, BTN, BTN, BTN, BTN, SEP, // listas, cita, línea
  BTN, BTN, BTN, BTN, // alinear
];

// ── La barra ─────────────────────────────────────────────────────────────────

test('si todo entra, no hay «Más»; con medio píxel de gracia (con zoom los anchos son fraccionarios)', () => {
  const total = ocupa(BARRA, BARRA.length, 2);
  assert.deepEqual(repartoDeBarra(BARRA, total, 2, 30), { visibles: BARRA.length, mas: false });
  assert.deepEqual(repartoDeBarra(BARRA, total - 0.4, 2, 30), { visibles: BARRA.length, mas: false }, '0,4 px no se ven cortados');
  assert.equal(repartoDeBarra(BARRA, total - 1, 2, 30).mas, true, 'un píxel sí: va a «Más»');
});

test('lo visible ENTRA con «Más» al lado, en cualquier ancho; y no termina en un separador', () => {
  let anterior = BARRA.length;
  for (let disp = 900; disp >= 0; disp -= 0.75) {
    const r = repartoDeBarra(BARRA, disp, 2, 30);
    if (!r.mas) { assert.equal(r.visibles, BARRA.length); continue; }
    // Lo que se ve, más el hueco y «Más», entra en lo disponible.
    if (r.visibles > 0) assert.ok(ocupa(BARRA, r.visibles, 2) + 2 + 30 <= disp + 0.5, `a ${disp} px se ven ${r.visibles} y no entran`);
    // Nunca termina en un separador.
    if (r.visibles > 0) assert.ok(!BARRA[r.visibles - 1].sep, `a ${disp} px la barra termina en un separador`);
    // Achicar nunca muestra MÁS piezas (si no, la barra salta al cambiar el zoom).
    assert.ok(r.visibles <= anterior, `a ${disp} px se ven ${r.visibles}, más que con más lugar (${anterior})`);
    anterior = r.visibles;
  }
});

test('un grupo no se parte dejando UNA pieza sola a la vista', () => {
  // Lo que entra justo hasta «Alinear a la izquierda» (la primera de su grupo) la manda a «Más».
  const hastaIzquierda = ocupa(BARRA, 24, 2) + 2 + 30;
  const r = repartoDeBarra(BARRA, hastaIzquierda, 2, 30);
  assert.equal(r.visibles, 22, 'la izquierda suelta se va con sus tres hermanas, y el separador de antes también');
  // Y en cualquier ancho: la última visible nunca es la primera de un grupo que sigue en «Más».
  for (let disp = 40; disp <= 900; disp += 1) {
    const { visibles: k, mas } = repartoDeBarra(BARRA, disp, 2, 30);
    if (!mas || k === 0) continue;
    const primeraDeSuGrupo = k === 1 || !!BARRA[k - 2].sep;
    const grupoSigue = k < BARRA.length && !BARRA[k].sep;
    assert.ok(!(primeraDeSuGrupo && grupoSigue), `a ${disp} px queda huérfana la pieza ${k - 1}`);
  }
});

test('sin lugar, todo va a «Más»; una barra sin medir (0 px, escondida) no rompe', () => {
  assert.deepEqual(repartoDeBarra(BARRA, 0, 2, 30), { visibles: 0, mas: true });
  assert.deepEqual(repartoDeBarra(BARRA, -5, 2, 30), { visibles: 0, mas: true });
  assert.deepEqual(repartoDeBarra(BARRA, Number.NaN, 2, 30), { visibles: 0, mas: true });
  assert.deepEqual(repartoDeBarra(BARRA, 20, 2, 30), { visibles: 0, mas: true }, 'ni «Más» entra: igual es lo único');
  assert.deepEqual(repartoDeBarra([], 100, 2, 30), { visibles: 0, mas: false });
});

test('la barra real a 100, 150 y 200 % de zoom (ventana de 1280 px, el editor a lo ancho y al costado)', () => {
  // Los anchos son los que midió el banco en Chrome (08/10/2026: la barra, menos 12 px de relleno),
  // y lo esperado es lo que la barra DIBUJÓ ahí (sin contar «Más»). La función y el navegador dan
  // lo mismo en los seis.
  const casos: Array<[string, number, number]> = [
    ['100 %, a lo ancho', 1238 - 12, BARRA.length],
    ['100 %, al costado', 556 - 12, 15],
    ['150 %, a lo ancho', 811 - 12, 22],
    ['150 %, al costado', 363.8 - 12, 9],
    ['200 %, a lo ancho', 598 - 12, 16],
    ['200 %, al costado', 268 - 12, 7],
  ];
  for (const [nombre, disp, esperado] of casos) {
    assert.equal(repartoDeBarra(BARRA, disp, 2, 30).visibles, esperado, nombre);
  }
});

test('«Más» por dentro: sin separadores al principio ni al final ni dos seguidos', () => {
  const s = (sep: boolean, id: string) => ({ sep, id });
  const out = recortarSeparadores([s(true, 'a'), s(false, 'b'), s(true, 'c'), s(true, 'd'), s(false, 'e'), s(true, 'f')]);
  assert.deepEqual(out.map((x) => x.id), ['b', 'c', 'e']);
  assert.deepEqual(recortarSeparadores([s(true, 'a')]), []);
});

// ── La imagen ────────────────────────────────────────────────────────────────

test('el ancho de una imagen: de a 5, de 10 a 100, y una nueva nunca entra gigante', () => {
  assert.equal(anchoValido(52), 50);
  assert.equal(anchoValido(53), 55);
  assert.equal(anchoValido(3), 10);
  assert.equal(anchoValido(140), 100);
  assert.equal(anchoValido(Number.NaN), 100);
  // Arrastrar la esquina: lo que pide el mouse, llevado a la lista.
  assert.equal(anchoDeArrastre(515, 1030), 50);
  assert.equal(anchoDeArrastre(520, 1030), 50);
  assert.equal(anchoDeArrastre(540, 1030), 50);
  assert.equal(anchoDeArrastre(545, 1030), 55);
  assert.equal(anchoDeArrastre(5, 1030), 10);
  assert.equal(anchoDeArrastre(5000, 1030), 100);
  assert.equal(anchoDeArrastre(300, 0), 100, 'sin texto medido no se inventa un ancho');
  for (let px = 0; px <= 1200; px += 7) assert.ok(ANCHOS_IMAGEN.includes(anchoDeArrastre(px, 1030)), `${px} px dio un ancho que el saneo tira`);
  // Una captura de 1.920 px en un texto de 1.030: entra al 60 %, no al 100 %.
  assert.equal(anchoInicialDeImagen(1920, 1030), ANCHO_IMAGEN_NUEVA);
  assert.equal(ANCHO_IMAGEN_NUEVA, 60);
  // Un ícono de 120 px no se estira a media pantalla: queda cerca de su tamaño.
  assert.equal(anchoInicialDeImagen(120, 1030), 10);
  assert.equal(anchoInicialDeImagen(300, 1030), 30);
  // Sin poder medir, el tope.
  assert.equal(anchoInicialDeImagen(null, 1030), 60);
  assert.equal(anchoInicialDeImagen(800, null), 60);
});

// ── El editor: que use las reglas como se debe ───────────────────────────────

const ED = sinComentarios(leer('app/_ui/EditorRico.tsx'));

test('el editor mide contra la REGLA (todas las piezas, siempre), no contra lo que la barra muestra', () => {
  const ini = ED.indexOf('const medir = () => {\n      const hijos');
  assert.ok(ini > 0, 'no encontré la medición de la barra');
  const efecto = ED.slice(ini, ED.indexOf('}, [firmaPiezas, soloLectura]);', ini));
  assert.ok(efecto.length > 300 && efecto.length < 1500, `el efecto mide ${efecto.length}`);
  assert.match(efecto, /Array\.from\(regla\.children\)/, 'los anchos salen de la regla');
  assert.doesNotMatch(efecto, /barra\.children|barra\.querySelectorAll/, 'medir la barra es medir lo que la decisión cambia');
  assert.match(efecto, /repartoDeBarra\(medidas, disponible, num\(cs\.columnGap\), mas\.getBoundingClientRect\(\)\.width\)/);
  assert.match(efecto, /getBoundingClientRect\(\)\.width/, 'con zoom los anchos son fraccionarios: nada de offsetWidth');
  assert.doesNotMatch(efecto, /offsetWidth|scrollWidth/);
  assert.match(efecto, /new ResizeObserver\(medir\)/);
  assert.match(efecto, /window\.addEventListener\('resize', medir\)/, 'el zoom es una ventana más angosta: hay que volver a decidir');
  // La regla tiene una pieza por pieza de la barra, más el lugar de «Más».
  assert.match(ED, /<div ref=\{reglaRef\} className="mk-er-regla" aria-hidden="true">\s*\{piezas\.map\(/);
  // La barra dibuja las primeras `nVisibles` y «Más» con el resto, de la MISMA lista.
  assert.match(ED, /\{piezas\.slice\(0, nVisibles\)\.map\(pintarPieza\)\}/);
  assert.match(ED, /piezas\.slice\(nVisibles\)/);
});

test('un solo renglón: la barra no envuelve, y nada de lo de adentro de la barra la estira', () => {
  const css = ED.slice(ED.indexOf('const CSS_EDITOR = '), ED.indexOf('`;', ED.indexOf('const CSS_EDITOR = ')));
  const regla = css.match(/\.mk-editor-rico \.mk-er-barra \{[^}]*\}/)?.[0] ?? '';
  assert.match(regla, /flex-wrap: nowrap/);
  assert.doesNotMatch(regla, /flex-wrap: wrap/);
  assert.match(regla, /overflow: hidden/);
  assert.match(regla, /contain: inline-size/, 'sin esto, el ancho natural de la barra empuja la columna del texto');
  // El separador es todo caja (sin `margin`): el ancho que mide la regla es el que ocupa.
  const sep = css.match(/\.mk-editor-rico \.mk-er-sep \{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(sep, /margin/, 'un margen no sale en getBoundingClientRect y la cuenta se queda corta');
});

test('los puntos del recorrido de la pantalla (los arma la pista de apariencia)', () => {
  assert.match(ED, /data-recorrido="editor-barra"/);
  assert.match(ED, /recorrido="editor-mas"/);
  for (const r of ['editor-imagen', 'editor-adjuntar', 'editor-tabla']) assert.match(ED, new RegExp(`recorrido: '${r}'`), r);
  // Y `Boton` los pone en el DOM.
  const boton = ED.slice(ED.indexOf('function Boton('), ED.indexOf('function Menu('));
  assert.match(boton, /data-recorrido=\{recorrido\}/);
});

test('la imagen y la tabla, en el editor: lista blanca, un paso de deshacer, avisos cortos', () => {
  // La imagen lee y escribe su tamaño SÓLO con los valores de la lista (los mismos que el saneo).
  assert.match(ED, /parseHTML: \(el: HTMLElement\) => anchoDeImagen\(el\.getAttribute\('data-ancho'\)\)/);
  assert.match(ED, /parseHTML: \(el: HTMLElement\) => alineaDeImagen\(el\.getAttribute\('data-alinea'\)\)/);
  assert.doesNotMatch(ED, /style\.width = /, 'el tamaño va en el atributo, no en un style');
  // Cada cambio de tamaño es su propio paso de deshacer.
  const aplicar = ED.slice(ED.indexOf('const aplicar = (attrs'), ED.indexOf('const terminar = '));
  assert.match(aplicar, /closeHistory\(tr\);/);
  // Mientras se arrastra: nada de transacciones ni setState por cada movimiento.
  const mover = ED.slice(ED.indexOf('onPointerMove={(e) => {'), ED.indexOf('onPointerUp='));
  assert.doesNotMatch(mover, /aplicar\(|setState|set[A-Z]\w*\(|\.chain\(\)/);
  // La tabla: la oficial, sin columnas redimensionables (sus anchos en px no pasan el saneo).
  assert.match(ED, /from '@tiptap\/extension-table'/);
  assert.match(ED, /Table\.configure\(\{ resizable: false \}\)/);
  // Borrar una tabla o una imagen con un botón deja «Deshacer», con un aviso de 3-4 palabras.
  const avisos = [...ED.matchAll(/sacarConDeshacer\(pos, '([^']+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(avisos.sort(), ['Imagen quitada', 'Tabla borrada']);
  for (const a of avisos) assert.ok(a.split(' ').length <= 4, `«${a}» es largo para un aviso`);
});

// ── La revisión final (08/10/2026) ───────────────────────────────────────────
// Probado ROMPIÉNDOLO, restaurado desde la copia en memoria (verificado por hash). Con todo en su lugar:
// 14 pass / 0 fail. Cada rotura y lo que tumbó:
//   · la fila del panel del enlace de vuelta a `mk-er-fila` (la colisión que se encontró) → 13 / 1 (ninguna propiedad dos veces)
//   · `deshacer` sin mirar la profundidad del historial                                   → 13 / 1 (un Ctrl+Z ya lo devolvió)
//   · la flecha de la esquina otra vez con `ancho ?? 100`                                  → 13 / 1 (la flecha parte de lo que mide)
//   · la regla de foco del texto con la clase del editor SIMPLE (peso 4, el del curso)      → 13 / 1 (el aro del curso)
// Y en Chrome (scratchpad rev-editor-rico, la lección REAL con la hoja del curso): los renglones de
// «Más» pasaron de 9 px de hueco a 1; borrar una tabla, Ctrl+Z y además «Deshacer» deja UNA tabla (antes,
// dos); una imagen de 200 px en un texto de 447 con la flecha → va al 50 % (antes, al 100 %); y el texto
// con foco pasó de `outline: solid 3px` (el marco negro del curso) a `none` — con peso 4 seguía en 3 px.

/** Las reglas de una hoja: cada selector (partido por la coma) con las propiedades que declara. */
function reglasDe(css: string): Array<{ selector: string; props: string[] }> {
  const plano = css.replace(/@(media|keyframes)[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '');
  const out: Array<{ selector: string; props: string[] }> = [];
  for (const m of plano.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const props = m[2].split(';').map((d) => d.split(':')[0].trim()).filter(Boolean);
    for (const s of m[1].split(',').map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean)) out.push({ selector: s, props });
  }
  return out;
}

test('ninguna propiedad se declara dos veces para el MISMO selector (gana la última y la primera miente)', async () => {
  // El caso que se encontró: `.mk-er-flota .mk-er-fila` era la fila de botones del panel del enlace Y
  // cada renglón de los menús «Más» y de la tabla. Las dos reglas se pisaban: cada renglón del menú
  // heredaba un `margin-top: 8px` (9 px entre renglones, medido) y la fila del enlace el relleno y el
  // cursor de un renglón. Repetir un selector para sumar propiedades está bien; repetir una PROPIEDAD no.
  const { CSS_RICO } = await import('../app/_ui/HtmlSeguro');
  const css = ED.slice(ED.indexOf('const CSS_EDITOR = ') + 20, ED.indexOf('`;', ED.indexOf('const CSS_EDITOR = ')));
  for (const [nombre, hoja] of [['CSS_EDITOR', css], ['CSS_RICO', CSS_RICO]] as const) {
    const reglas = reglasDe(hoja);
    assert.ok(reglas.length > 20, `${nombre}: no encontré las reglas (${reglas.length})`);
    const vistas = new Map<string, string>();
    for (const { selector, props } of reglas) {
      for (const p of props) {
        const clave = `${selector} → ${p}`;
        assert.ok(!vistas.has(clave), `${nombre}: «${clave}» se declara en dos reglas`);
        vistas.set(clave, selector);
      }
    }
  }
});

test('el texto no lleva el aro del curso: su regla de foco le gana a la de la hoja del curso', () => {
  // `.ahdoc .ugc [tabindex]:focus-visible` (public/cono-doc/ugc.css) pinta 3 px de tinta, ProseMirror
  // lleva `tabindex`, y la hoja del curso carga después: hace falta MÁS peso, no el mismo.
  const css = ED.slice(ED.indexOf('const CSS_EDITOR = ') + 20, ED.indexOf('`;', ED.indexOf('const CSS_EDITOR = ')));
  const peso = (s: string) => (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const nuestra = reglasDe(css).find((r) => /\.ProseMirror\[contenteditable\]:focus-visible$/.test(r.selector));
  assert.ok(nuestra, 'falta la regla de foco del texto');
  assert.match(css, new RegExp(nuestra.selector.replace(/[.[\]]/g, '\\$&') + ' \\{ outline: none; \\}'));
  const delCurso = reglasDe(leer('public/cono-doc/ugc.css')).filter((r) => /\[tabindex\]:focus-visible/.test(r.selector) && r.props.includes('outline'));
  assert.ok(delCurso.length >= 1, 'no encontré la regla de foco del curso: si cambió, revisar esta');
  for (const r of delCurso) assert.ok(peso(nuestra.selector) > peso(r.selector), `«${nuestra.selector}» (${peso(nuestra.selector)}) no le gana a «${r.selector}» (${peso(r.selector)})`);
});

test('«Deshacer» no vuelve a poner lo que un Ctrl+Z ya devolvió; la flecha parte de lo que mide', () => {
  const sacar = ED.slice(ED.indexOf('const sacarConDeshacer = useCallback('), ED.indexOf('mostrarToast(aviso, deshacer);'));
  assert.ok(sacar.length > 300 && sacar.length < 2000, `sacarConDeshacer mide ${sacar.length}`);
  // La profundidad del historial se mide DESPUÉS de borrar, y deshacer no pone nada si quedó por debajo.
  assert.match(sacar, /deleteRange\([\s\S]*profundidad: undoDepth\(e\.state\)/);
  assert.match(sacar, /if \(undoDepth\(ed\.state\) < s\.profundidad\) return;\s*ed\.chain\(\)\.focus\(\)\.insertContentAt\(/);
  // La flecha de la esquina: sin ancho guardado, mide la imagen (como el arrastre), no salta del 100 %.
  const flecha = ED.slice(ED.indexOf("if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;"), ED.indexOf('<span ref={pct}'));
  assert.ok(flecha.length > 100 && flecha.length < 1200, `la flecha mide ${flecha.length}`);
  assert.doesNotMatch(flecha, /const base = ancho \?\? 100;/);
  assert.match(flecha, /const base = ancho \?\? \(img instanceof HTMLElement && contenido \? anchoDeArrastre\(img\.getBoundingClientRect\(\)\.width, contenido\) : 100\);/);
});
