// Los TEXTOS de una tarjeta de diseño, editables (9/11/2026). Martín: «los dashboard hoy no son editables... que esté 100 %
// finalizado». Medido en producción: un bloque de diseño se movía, se agrandaba y se borraba, pero su título y sus rótulos venían
// escritos en el componente del diseño y no había dónde cambiarlos. Y el costado de la tarjeta elegida creaba una flecha en vez de
// agrandar (eso lo cuida tests/graficos-conectores.test.ts).
//
// Lo que este archivo fija:
//   · la regla (lib/disenos-textos.ts): qué texto se puede cambiar (con letras; no una cifra), cómo se guarda (original → nuevo)
//     y que vaciarlo o dejar el original quita el cambio;
//   · el saneo de la hoja GUARDA el cambio (si no, se perdía al recargar) y descarta lo que no sirve;
//   · la pantalla (app/dashboard/disenos/textos-de-bloque.ts, en jsdom): muestra el nuevo donde estaba el original, vuelve al
//     original cuando el cambio se quita, y si React vuelve a escribir el texto (otro dato), se lo vuelve a aplicar;
//   · el cableado: el bloque aplica los textos con un observador, y la tapa abre el campo con dos toques.
// Correr: npx tsx --test tests/dashboard-textos-de-bloque.test.ts
//
// ── Roturas (9/11/2026, una por vez, con copia y verificada por hash, nunca con git). Base 6 / 0; al final 6 / 0. Cada rotura
//    tumbó su test (pasan / fallan):
//   · el saneo de la hoja sin `textos`                                    -> 5 / 1  «el saneo de la hoja guarda…»
//   · `originalDe` que no recuerda lo que puso (devuelve lo que hay)       -> 5 / 1  «la pantalla…» (no vuelve al original)
//   · las filas de una tabla (`tbody`) editables                           -> 5 / 1  «la pantalla…»
//   · `esTextoEditable` que acepta cifras                                  -> 3 / 3  «qué se puede…», «el mapa…», «el saneo…»
//   · el bloque sin reaplicar en el observador                             -> 5 / 1  «el cableado…»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { conTextoCambiado, esTextoEditable, sanearTextos, textoAMostrar, MAX_TEXTOS_BLOQUE } from '../lib/disenos-textos';
import { sanearHoja, esElemento, type Hoja } from '../lib/graficos-catalogo';
import { instanciarPlantilla, PLANTILLAS_HOJA } from '../lib/graficos-plantillas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// jsdom no trae tipos en este repo (como tests/admin-polar-armazon.test.ts): se carga con require y la forma que se usa.
type VentanaDom = { document: Document; NodeFilter: unknown; Text: unknown };
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => { window: VentanaDom } };
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('qué se puede cambiar: un rótulo con letras, no una cifra ni un signo', () => {
  assert.ok(esTextoEditable('Tasa de cierre'));
  assert.ok(esTextoEditable('  A quién llamaste  '));
  assert.ok(esTextoEditable('Últimos 30 días'));
  assert.ok(!esTextoEditable('1.234'), 'una cifra no');
  assert.ok(!esTextoEditable('42%'), 'un porcentaje no');
  assert.ok(!esTextoEditable('·'), 'un signo no');
  assert.ok(!esTextoEditable('x'), 'una letra suelta no');
  assert.ok(!esTextoEditable('12 345 678 a'), 'más cifras que letras no');
});

test('el mapa: cambiar, volver al original y vaciar', () => {
  let t = conTextoCambiado(undefined, 'Tasa de cierre', 'Cierre del mes');
  assert.deepEqual(t, { 'Tasa de cierre': 'Cierre del mes' });
  t = conTextoCambiado(t, 'A quién llamaste', '  Llamados  ');
  assert.deepEqual(t, { 'Tasa de cierre': 'Cierre del mes', 'A quién llamaste': 'Llamados' });
  assert.deepEqual(conTextoCambiado(t, 'Tasa de cierre', ''), { 'A quién llamaste': 'Llamados' }, 'vaciar quita el cambio');
  assert.deepEqual(conTextoCambiado(t, 'A quién llamaste', 'A quién llamaste'), { 'Tasa de cierre': 'Cierre del mes' }, 'el original quita el cambio');
  assert.equal(conTextoCambiado({ 'Tasa de cierre': 'X y' }, 'Tasa de cierre', ''), undefined, 'sin cambios, nada');
  assert.equal(conTextoCambiado(undefined, '1.234', 'mil'), undefined, 'una cifra no se cambia');
  // Con el tope lleno, uno nuevo no entra (los de antes siguen).
  const lleno = Object.fromEntries(Array.from({ length: MAX_TEXTOS_BLOQUE }, (_, i) => [`Rótulo ${String.fromCharCode(97 + (i % 26))}${i}`, 'otro']));
  assert.equal(Object.keys(conTextoCambiado(lleno, 'Uno más', 'nuevo') ?? {}).length, MAX_TEXTOS_BLOQUE);
});

test('lo que se muestra: el nuevo en el lugar del original, con sus espacios', () => {
  const t = { 'Tasa de cierre': 'Cierre del mes' };
  assert.equal(textoAMostrar(' Tasa de cierre ', t), ' Cierre del mes ');
  assert.equal(textoAMostrar('Otra cosa', t), 'Otra cosa');
  assert.equal(textoAMostrar('Tasa de cierre', undefined), 'Tasa de cierre');
});

test('el saneo de la hoja guarda los textos de un bloque (si no, se pierden al recargar)', () => {
  const p = PLANTILLAS_HOJA.find((x) => x.id === 'velocidad-llamada') ?? PLANTILLAS_HOJA.find((x) => (x.armar((y) => y) as { diseno?: unknown }).diseno);
  assert.ok(p, 'una plantilla con diseño');
  const h = sanearHoja(instanciarPlantilla(p), 0) as Hoja;
  const b = h.componentes.find((c) => esElemento(c) && c.tipo === 'diseno');
  assert.ok(b && esElemento(b) && b.diseno, 'la plantilla tiene bloques de diseño');
  const conTextos = { ...h, componentes: h.componentes.map((c) => (c === b ? { ...b, diseno: { ...b.diseno!, textos: { 'Tasa de cierre': 'Cierre del mes', '1.234': 'no', 'Vacío': '' } } } : c)) };
  const releida = sanearHoja(JSON.parse(JSON.stringify(conTextos)), 0) as Hoja;
  const b2 = releida.componentes.find((c) => c.id === b.id);
  assert.ok(b2 && esElemento(b2));
  assert.deepEqual(b2.diseno?.textos, { 'Tasa de cierre': 'Cierre del mes' }, 'guarda el cambio y descarta lo que no sirve');
  const sin = releida.componentes.find((c) => c !== b2 && esElemento(c) && c.tipo === 'diseno');
  if (sin && esElemento(sin)) assert.equal('textos' in (sin.diseno ?? {}), false, 'un bloque sin cambios no lleva el campo');
  assert.equal(sanearTextos('nada'), undefined);
});

test('la pantalla: muestra el nuevo, vuelve al original y se reaplica si React reescribe el texto', async () => {
  const dom = new JSDOM('<!doctype html><div id="raiz"><div data-parte="tasa"><h3>Tasa de cierre</h3><b>42%</b><table><tbody><tr><td>Tasa de cierre</td></tr></tbody></table><svg><text>Tasa de cierre</text></svg></div></div>');
  const g = globalThis as Record<string, unknown>;
  g.NodeFilter = dom.window.NodeFilter;
  g.Text = dom.window.Text;
  const { aplicarTextos, originalDe } = await import('../app/dashboard/disenos/textos-de-bloque');
  const raiz = dom.window.document.getElementById('raiz') as unknown as HTMLElement;
  const h3 = raiz.querySelector('h3')!;
  const td = raiz.querySelector('td')!;
  const svg = raiz.querySelector('text')!;
  aplicarTextos(raiz, { 'Tasa de cierre': 'Cierre del mes' });
  assert.equal(h3.textContent, 'Cierre del mes', 'el título cambia');
  assert.equal(td.textContent, 'Tasa de cierre', 'una fila de tabla es un dato: no se toca');
  assert.equal(svg.textContent, 'Tasa de cierre', 'el texto de un gráfico no se toca');
  assert.equal(originalDe(h3.firstChild as unknown as Text), 'Tasa de cierre', 'el original se recuerda');
  // Aplicar otra vez no cambia nada (el observador lo corre con cada cambio).
  aplicarTextos(raiz, { 'Tasa de cierre': 'Cierre del mes' });
  assert.equal(h3.textContent, 'Cierre del mes');
  // React escribe otro texto en el mismo nodo (otro dato): ése es el original nuevo.
  (h3.firstChild as unknown as Text).nodeValue = 'Tasa de cierre';
  aplicarTextos(raiz, { 'Tasa de cierre': 'Cierre del mes' });
  assert.equal(h3.textContent, 'Cierre del mes', 'se reaplica');
  // Se quita el cambio: vuelve el del diseño.
  aplicarTextos(raiz, undefined);
  assert.equal(h3.textContent, 'Tasa de cierre', 'vuelve al original');
});

test('el cableado: el bloque aplica los textos con un observador y la tapa abre el campo con dos toques', () => {
  const bloque = leer('app/dashboard/disenos/BloqueDeDiseno.tsx');
  assert.match(bloque, /aplicarTextos\(el, textos\)/);
  assert.match(bloque, /new MutationObserver\(\(\) => aplicarTextos\(el, textos\)\)/, 'se reaplica cuando el diseño reescribe');
  assert.match(bloque, /characterData: true/);
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /<TapaDeDiseno textos=\{c\.diseno\.textos\}/, 'la tapa del bloque es la que edita textos');
  assert.match(ed, /textos: conTextoCambiado\(c\.diseno\.textos, original, nuevo\)/, 'lo escrito se guarda en el bloque');
  const tapa = leer('app/dashboard/disenos/TapaDeDiseno.tsx');
  assert.match(tapa, /onDoubleClick=\{alDobleClic\}/);
  assert.match(tapa, /className="lk-diseno-texto lk-no-arrastrar"/, 'el campo no arrastra la tarjeta');
  assert.match(tapa, /e\.key === 'Escape'/);
  const panel = leer('app/dashboard/Elemento.tsx');
  assert.match(panel, /Toca dos veces un texto de la tarjeta para cambiarlo/, 'el panel dice cómo');
  assert.match(panel, /Volver al original/);
});
