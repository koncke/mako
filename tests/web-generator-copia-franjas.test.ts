// Las copias idénticas, en el EDITOR, como la original (29/10/2026). Martín: «Lo que más me interesa es que funcione al
// 100% Web Generator, porque las páginas clonadas se desfasaron todas». Medido DOM contra DOM con las copias reales del
// ws9 (#68–#72) y el código de producción: la PUBLICADA era fiel (cada texto a < 100 px de la original), el EDITOR no.
// La copia se parte en secciones y el editor dibuja cada una SOLA en su iframe:
//   · una caja con COLUMNAS (el hero de tryholo.ai, una grilla de dos columnas) partida en sus hijos quedaba apilada:
//     «30+ posts a month» pasaba de x 727 · y 170 a x 197 · y 1064, y todo lo de abajo ~900 px corrido. La foto marca
//     con la geometría de la página armada las cajas cuyos hijos van juntos (`JS_HIJOS_JUNTOS` → `data-gm-junto`), y el
//     corte no las abre si entran enteras. Con eso, en holo, la mediana del corrimiento en el editor bajó de 910 a 177 px;
//   · lo que no dibuja nada (`<div hidden>`, el `<div style="position:absolute">` vacío de Next) era una sección y el
//     editor le daba su alto mínimo (`esParteVacia`);
//   · la caja del <body> (`min-h-screen` en 100ads.ai) envuelve CADA sección en el editor: un div vacío medía 900 px
//     (`CSS_CAJA_BODY_EN_EL_EDITOR`, sólo en el editor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { JS_HIJOS_JUNTOS, JS_INSTANTANEA } from '../lib/editor-landing/copia-identica-script';
import { PARTIR_DESDE, esCajaJunta, esParteVacia, partirParaCopia, sanearInstantanea } from '../lib/editor-landing/copia-identica';
import { CSS_CAJA_BODY_EN_EL_EDITOR, documentoEditable } from '../lib/editor-landing/html-editable';
import { TOPES } from '../lib/editor-landing/doc';

const RAIZ = join(__dirname, '..');
const fuente = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. La geometría: ¿los hijos van juntos?
// ─────────────────────────────────────────────────────────────────────────────

type Caja = { children: Caja[]; __r: { top: number; bottom: number; width: number; height: number }; __cs: { display: string; position: string } };
const caja = (top: number, alto: number, op: { ancho?: number; display?: string; position?: string; hijos?: Caja[] } = {}): Caja => ({
  children: op.hijos ?? [],
  __r: { top, bottom: top + alto, width: op.ancho ?? 500, height: alto },
  __cs: { display: op.display ?? 'block', position: op.position ?? 'static' },
});
/** JS_HIJOS_JUNTOS de verdad, en un vm, con `getComputedStyle` y `getBoundingClientRect` de mentira. */
function juntos(padre: Caja): boolean {
  const conRect = (c: Caja): unknown => ({ ...c, children: c.children.map(conRect), getBoundingClientRect: () => c.__r, __cs: c.__cs });
  const ctx = createContext({ getComputedStyle: (el: Caja) => el.__cs, Math, Infinity });
  return runInContext(`(${JS_HIJOS_JUNTOS})`, ctx)(conRect(padre)) as boolean;
}
const padre = (...hijos: Caja[]) => caja(0, 2000, { hijos });

test('1. la geometría: apiladas no, columnas o encimadas o un absoluto sí; lo fijo, lo escondido y lo vacío no cuentan', () => {
  assert.equal(juntos(padre(caja(0, 100), caja(100, 300), caja(400, 50))), false, 'franjas apiladas: se pueden partir');
  assert.equal(juntos(padre(caja(0, 100), caja(101, 300))), false);
  assert.equal(juntos(padre(caja(0, 100), caja(98.5, 300))), false, '2 px de tolerancia (un borde que se toca)');
  assert.equal(juntos(padre(caja(0, 800), caja(40, 700))), true, 'dos columnas: el hero de tryholo.ai');
  assert.equal(juntos(padre(caja(0, 400), caja(350, 300))), true, 'una tarjeta que se mete en la de arriba');
  assert.equal(juntos(padre(caja(0, 400), caja(0, 900, { position: 'absolute' }))), true, 'un fondo absoluto va con su caja');
  assert.equal(juntos(padre(caja(0, 400), caja(500, 100, { position: 'absolute' }))), true, 'un absoluto va con su caja aunque no se encime');
  assert.equal(juntos(padre(caja(0, 60, { position: 'fixed' }), caja(0, 800), caja(800, 400))), false, 'el encabezado fijo es de la ventana');
  assert.equal(juntos(padre(caja(0, 800), caja(40, 700, { display: 'none' }))), false, 'lo escondido no cuenta');
  assert.equal(juntos(padre(caja(0, 800), caja(40, 0, { ancho: 0 }))), false, 'lo que no tiene tamaño tampoco');
  assert.equal(juntos(padre(caja(0, 0, { display: 'contents', hijos: [caja(0, 800), caja(30, 700)] }), caja(800, 100))), true, 'lo `contents` cuenta por sus hijos');
  assert.equal(juntos(padre(caja(0, 800))), false, 'un solo hijo');
  assert.equal(juntos(caja(0, 10)), false);
  // La foto la usa, y marca la COPIA (no la página): `data-gm-junto`.
  assert.ok(JS_INSTANTANEA.includes(JS_HIJOS_JUNTOS), 'la foto lleva la misma geometría');
  assert.match(JS_INSTANTANEA, /try \{ if \(esJunta\(o\)\) c\.setAttribute\('data-gm-junto', ''\); \} catch \(e\) \{\}/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El corte: una caja con los hijos juntos no se abre si entra entera
// ─────────────────────────────────────────────────────────────────────────────

const relleno = (n: number, palabra: string) => `<p>${(palabra + ' ').repeat(Math.ceil(n / (palabra.length + 1)))}</p>`;
const foto = (cuerpo: string) => sanearInstantanea({ cuerpo, hojas: [], html: { clase: '' }, body: { clase: 'min-h-screen' } })!;
const textoDe = (h: string) => h.replace(/<[^>]+>/g, ' ');
/** Una grilla de dos columnas de ~`kb` KB entre las dos, a la que se llega bajando por un envoltorio de un solo hijo. */
const hero = (marca: boolean, kb: number) =>
  `<div class="pagina"><div class="grid md:grid-cols-2"${marca ? ' data-gm-junto=""' : ''}><div class="col-texto">${relleno(kb * 600, 'Your Marketing')}</div><div class="col-tarjetas">${relleno(kb * 400, 'posts a month')}</div></div></div>`;

test('2. el hero de dos columnas: marcado y entero, UNA sección con las dos; sin marca, dos (como antes)', () => {
  const kb = 80;
  assert.ok(kb * 1000 > PARTIR_DESDE && kb * 1000 < TOPES.htmlEditable);
  const junto = partirParaCopia(foto(hero(true, kb)));
  assert.equal(junto.length, 1, JSON.stringify(junto.map((s) => s.html.length)));
  assert.ok(/col-texto/.test(junto[0].html) && /col-tarjetas/.test(junto[0].html), 'las dos columnas, juntas');
  assert.ok(junto[0].html.startsWith('<div class="grid md:grid-cols-2"'), 'la grilla es la sección, no un envoltorio');
  const separado = partirParaCopia(foto(hero(false, kb)));
  assert.equal(separado.length, 2, 'sin la marca se parte en sus columnas (lo que desfasaba el editor)');
  assert.ok(separado.every((s) => s.envoltorios.some((e) => e.startsWith('<div class="grid'))));
});

test('2b. por el camino de las partes grandes también, y la que no entra se parte igual', () => {
  const pagina = (marca: boolean, kb: number) => `<header class="nav">${relleno(2000, 'Menu')}</header><section class="hero"${marca ? ' data-gm-junto=""' : ''}><div class="a">${relleno(kb * 500, 'uno')}</div><div class="b">${relleno(kb * 500, 'dos')}</div></section><section class="mas">${relleno(30_000, 'tres')}</section>`;
  const s = partirParaCopia(foto(pagina(true, 90)));
  const delHero = s.filter((x) => /class="a"|class="b"/.test(x.html));
  assert.equal(delHero.length, 1, 'el hero entero en una sección');
  assert.ok(/class="a"/.test(delHero[0].html) && /class="b"/.test(delHero[0].html));
  // Más grande que una sección: se parte (la publicada no cambia; el editor queda como antes).
  const grande = partirParaCopia(foto(pagina(true, 260)));
  const conA = grande.filter((x) => /class="a"/.test(x.envoltorios.join('') + x.html));
  const conB = grande.filter((x) => /class="b"/.test(x.envoltorios.join('') + x.html));
  assert.ok(conA.length && conB.length && !conA.some((x) => conB.includes(x)), 'lo que no entra en TOPES.htmlEditable se abre: cada columna por su lado');
  assert.ok(grande.every((x) => x.html.length <= TOPES.htmlEditable));
});

test('2c. la marca no viaja a la copia: ni en el HTML ni en los envoltorios', () => {
  const cuerpo = `<main class="m"><section class="s1" data-gm-junto=""><div class="x">${relleno(70_000, 'hola')}</div><div class="y">${relleno(5_000, 'chau')}</div></section><section class="s2"><div class="z" data-gm-junto="">${relleno(70_000, 'otro')}</div></section></main>`;
  for (const s of partirParaCopia(foto(cuerpo))) {
    assert.ok(!s.html.includes('data-gm-junto'), 'en el HTML');
    assert.ok(!s.envoltorios.join('').includes('data-gm-junto'), 'en los envoltorios');
  }
  assert.equal(esCajaJunta('<div class="g" data-gm-junto="">'), true);
  assert.equal(esCajaJunta('<div data-gm-junto>'), true);
  assert.equal(esCajaJunta('<div class="g" data-gm-juntos="x">'), false);
  assert.equal(esCajaJunta('<div title="data-gm-junto">'), false, 'adentro de un valor no es la marca');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lo que no dibuja nada no es una sección
// ─────────────────────────────────────────────────────────────────────────────

test('3. una etiqueta vacía, escondida o absoluta, no es sección; un espaciador con clase sí', () => {
  assert.equal(esParteVacia('<div hidden=""></div>'), true, 'el <div hidden> de tryholo.ai');
  assert.equal(esParteVacia('<div style="position:absolute"></div>'), true, 'el anunciador de rutas de Next (100ads.ai)');
  assert.equal(esParteVacia(' <span hidden></span> '), true);
  assert.equal(esParteVacia('<div hidden=""><!--$--><!--/$--></div>'), true, 'con las marcas de Suspense de React adentro');
  assert.equal(esParteVacia('<div class="h-24"></div>'), false, 'un espaciador ocupa');
  assert.equal(esParteVacia('<div class="md:block" hidden=""></div>'), false, 'una clase le puede ganar al `hidden`');
  assert.equal(esParteVacia('<div class="h-24" style="position:absolute"></div>'), false);
  assert.equal(esParteVacia('<div hidden="">texto</div>'), false, 'con contenido');
  assert.equal(esParteVacia('<div hidden=""><img src="a.png"></div>'), false);
  assert.equal(esParteVacia('<div style="position:absolute;width:40px"></div>'), false, 'con tamaño');
  assert.equal(esParteVacia('<div style="position:relative"></div>'), false);
  assert.equal(esParteVacia('<div></div><div hidden></div>'), false, 'dos etiquetas no son «una vacía»');
  // Como en tryholo.ai y 100ads.ai: al lado de una parte grande que se abre, la vacía quedaba SOLA, como sección.
  const s = partirParaCopia(foto(`<div hidden=""><!--$--><!--/$--></div><div class="app"><section class="s1">${relleno(70_000, 'hola')}</section><section class="s2">${relleno(20_000, 'chau')}</section></div><div style="position:absolute"></div>`));
  assert.equal(s.length, 2, JSON.stringify(s.map((x) => x.html.slice(0, 40))));
  assert.ok(s.every((x) => textoDe(x.html).trim() !== ''), 'ninguna sección sin nada');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El editor: la caja del <body> no estira cada sección
// ─────────────────────────────────────────────────────────────────────────────

test('4. en el editor, la caja del <body> de una copia no le impone su alto a cada sección; la publicada no cambia', () => {
  const env = ['<div class="dark min-h-screen" data-gm-copia="body">'];
  const copia = documentoEditable('<div style="position:absolute"></div>', '.min-h-screen{min-height:100vh}', { envoltorios: env, sinBase: true });
  assert.ok(copia.includes(`<style>${CSS_CAJA_BODY_EN_EL_EDITOR}</style>`));
  assert.ok(copia.indexOf(CSS_CAJA_BODY_EN_EL_EDITOR) > copia.indexOf('min-height:'), 'después de la hoja de la copia: le gana');
  assert.equal(CSS_CAJA_BODY_EN_EL_EDITOR, '[data-gm-copia="body"]{min-height:0!important}');
  assert.ok(!documentoEditable('<p>hola</p>', '', {}).includes(CSS_CAJA_BODY_EN_EL_EDITOR), 'un diseño de MaKo (no copia) no lo lleva');
  for (const f of ['lib/editor-landing/render.ts', 'lib/editor-landing/pagina-publica.ts', 'lib/editor-landing/publicar.ts']) {
    assert.ok(!fuente(f).includes('CSS_CAJA_BODY_EN_EL_EDITOR'), `${f}: la publicada envuelve la página una vez y su alto vale`);
  }
});
