// =============================================================================
// Todo elemento de un «Diseño editable» se edita con su control, y el clic derecho abre el menú (25/10/2026)
// =============================================================================
// Martín (25/10, ~15:10): «en las landing de MaKo, quiero que TODO sea editable, cada botón, cada video, cada cosa que
// hay... Y no funciona aún el click derecho en el editor web». Medido en producción sobre una copia de la #32: 29
// botones (el destino, sólo con un campo de texto suelto), 10 imágenes, 4 videos y 75 íconos (estos dos, sólo por
// «Código»), y el clic derecho llegaba al documento del iframe sin abrir nada. Lo que fija:
//   1. qué elemento elige un clic (un ícono adentro de un botón elige el ícono; un video, por su caja);
//   2. cada tipo con el control que el editor YA tiene: SelectorDestino (botón de bloque), el selector de imágenes, el del
//      bloque Video y el panel del bloque Insertar, SelectorIcono;
//   3. el clic derecho se reenvía a la sección con el punto pasado a la página (el MISMO menú);
//   4. «una sección» como destino (`#t-<id>`) existe también en una sección de diseño: el render le pone su ancla.
// Correr: node --import tsx --test tests/diseno-elementos.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PIDE_ELEGIR, elementoEnPunto, tipoDeElemento } from '../lib/editor-landing/diseno-elementos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

type Nodo = { tagName: string; padre: Nodo | null; caja?: { left: number; right: number; top: number; bottom: number } };
const nodo = (tagName: string, padre: Nodo | null = null, caja?: Nodo['caja']): Nodo => ({ tagName, padre, caja });
/** Un elemento de mentira con `closest` y su caja, para la regla sin DOM. */
const comoElemento = (n: Nodo | null): any => n && ({
  tagName: n.tagName,
  closest: (sel: string) => {
    const tags = sel.split(',').map((x) => x.trim().toLowerCase());
    for (let p: Nodo | null = n; p; p = p.padre) if (tags.includes(p.tagName.toLowerCase())) return comoElemento(p);
    return null;
  },
  getBoundingClientRect: () => n.caja ?? { left: 0, right: 0, top: 0, bottom: 0 },
});

test('qué elige un clic: el ícono, la imagen o el botón más cercano; un video, por su caja; el texto suelto, nada', () => {
  const seccion = nodo('SECTION');
  const boton = nodo('A', seccion);
  const textoDelBoton = nodo('SPAN', boton);
  const svg = nodo('svg', boton);
  const path = nodo('path', svg);
  const img = nodo('IMG', seccion);
  const parrafo = nodo('P', seccion);
  const video = nodo('IFRAME', seccion, { left: 100, right: 500, top: 200, bottom: 425 });
  const doc = { querySelectorAll: () => [comoElemento(video)] };
  assert.equal(elementoEnPunto(doc, comoElemento(path), 0, 0)?.tagName, 'svg', 'el ícono adentro de un botón elige el ícono');
  assert.equal(elementoEnPunto(doc, comoElemento(textoDelBoton), 0, 0)?.tagName, 'A', 'el texto del botón elige el botón');
  assert.equal(elementoEnPunto(doc, comoElemento(img), 0, 0)?.tagName, 'IMG');
  // El video no recibe el clic (pointer-events: none adentro del editor): lo tocado es su contenedor.
  assert.equal(elementoEnPunto(doc, comoElemento(seccion), 300, 300)?.tagName, 'IFRAME');
  assert.equal(elementoEnPunto(doc, comoElemento(parrafo), 50, 50), null, 'texto suelto: se escribe, no tiene control propio');
  assert.deepEqual(['A', 'img', 'IFRAME', 'video', 'svg', 'P'].map((t) => tipoDeElemento({ tagName: t })), ['enlace', 'imagen', 'video', 'video', 'icono', null]);
  assert.deepEqual(Object.keys(PIDE_ELEGIR).sort(), ['enlace', 'icono', 'imagen', 'video']);
});

test('cada tipo con el control que el editor YA tiene, y la barra sólo con íconos', () => {
  const v = leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx');
  // Un video del diseño no se traga el clic que lo elige (sólo en el editor: esa hoja no se guarda).
  assert.match(v, /const CSS_DENTRO = '[^']*iframe,video\{pointer-events:none\}[^']*';/);
  // El clic elige lo que tiene control propio (un enlace, una imagen, un video, un ícono) y, si no hay, lo tocado adentro de la
  // sección (cualquier elemento, para «Elemento»: la réplica editable, 28/10/2026), o la sección. Antes se fijaba la línea
  // vieja (`elegido.current = elementoEnPunto(...)`), que la réplica reescribió sin cambiar esto.
  assert.match(v, /const conControl = elementoEnPunto\(d, tocado, e\.clientX, e\.clientY\) as Element \| null;/, 'el clic pregunta primero por el control propio');
  assert.match(v, /elegirVivo\.current\(conControl \?\? \(tocado && r && r\.contains\(tocado\) \? tocado : r\)\);/, 'sin control propio, lo tocado de la sección');
  assert.match(v, /const elegir = \(el: Element \| null\) => \{[\s\S]{0,300}?const t = tipoDeElemento\(el\);\n\s*setTipo\(t\);/, 'la barrita marca el tipo de lo elegido');
  // Botón o enlace: el selector de destino del botón de un bloque, no un campo suelto.
  assert.match(v, /<SelectorDestino valor=\{enlace\.a\.getAttribute\('href'\)\} nuevaPestana=\{enlace\.a\.getAttribute\('target'\) === '_blank'\}/);
  assert.doesNotMatch(v, /CampoEnlace/);
  assert.match(v, /if \(href && nueva\) \{ a\.setAttribute\('target', '_blank'\); a\.setAttribute\('rel', 'noopener noreferrer'\); \}/);
  // Video: un reproductor con el panel del bloque Insertar; un <video>, con el selector en modo video (el del bloque Video).
  // (La agenda de un diseño, `[data-calendly]`, va por el mismo panel: vista-embeds.test.ts.)
  assert.match(v, /if \(el\.tagName\.toLowerCase\(\) === 'iframe' \|\| el\.hasAttribute\('data-calendly'\)\) \{ setVideo\(\{ ancla, el: el as HTMLElement \}\); return; \}/);
  assert.match(v, /<PanelInsertar inicial=\{video\.el\.getAttribute\('data-calendly'\) \?\? video\.el\.getAttribute\('src'\) \?\? ''\}/);
  assert.match(v, /await ctx\.elegirImagen\(\{ modo: 'video' \}\);\n\s*if \(!url\) return;\n\s*if \(!srcVideo\(url\)\)/);
  assert.match(leer('app/web-generator/editor/nodos/InsertadoVista.tsx'), /^export function PanelInsertar\(/m);
  // Ícono: el selector de íconos y el SVG de la casa, con el tamaño y la clase del que estaba.
  assert.match(v, /<SelectorIcono ancla=\{icono\.ancla\} valor=\{null\} onElegir=\{\(n\) => ponerIcono\(icono\.el, n\)\}/);
  assert.match(v, /svgIcono\(nombre, Math\.round\(caja\.width\) \|\| 24, svg\.getAttribute\('class'\) \?\? undefined\)/);
  // La barra: los cuatro controles marcan el tipo elegido, con el nombre en el tooltip y sin texto al lado.
  for (const [nombre, t] of [['Imagen', 'imagen'], ['Enlace', 'enlace'], ['Video', 'video'], ['Ícono', 'icono']]) {
    assert.match(v, new RegExp(`\\{boton\\('${nombre}', <Icono nombre="[a-z]+" />, [^\\n]*tipo === '${t}'\\)\\}`), `falta el control ${nombre}`);
  }
  assert.match(v, /className="gmx-btn gma-tip" data-tip=\{nombre\} aria-label=\{nombre\}/);
  assert.doesNotMatch(v, /<span>(Imagen|Enlace|Código)<\/span>/, 'la barra con texto no entraba entre los controles de la sección');
});

test('el clic derecho adentro del diseño abre el MISMO menú de la sección, en el punto', () => {
  const v = leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx');
  const i = v.indexOf("d.addEventListener('contextmenu'");
  assert.ok(i > 0, 'el documento del diseño no escucha el clic derecho');
  const cuerpo = v.slice(i, v.indexOf('});', i));
  assert.match(cuerpo, /if \(e\.shiftKey\) return;/, 'con Shift, el menú del navegador (como en un bloque)');
  assert.match(cuerpo, /if \(sel && !sel\.isCollapsed\) return;/, 'con texto elegido, el menú del navegador (copiar, el corrector)');
  // 29/10/2026: una copia en escritorio se dibuja a 1440 y se achica al lienzo; el punto del iframe va × la escala.
  assert.match(v, /escalaVivo\.current = escala;/, 'el clic derecho no sabe la escala de la copia');
  assert.match(cuerpo, /const k = escalaVivo\.current;/, 'el clic derecho no lleva el punto a la escala de la copia');
  assert.match(cuerpo, /m\.dispatchEvent\(new MouseEvent\('contextmenu', \{ bubbles: true, cancelable: true, clientX: r\.left \+ e\.clientX \* k, clientY: r\.top \+ e\.clientY \* k \}\)\);/);
  // Lo recibe la sección, que es la que ya abre su menú en el punto.
  assert.match(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'), /seccion\.addEventListener\('contextmenu', alClicDerecho\);/);
});

test('«una sección» como destino existe también en una sección de diseño', async () => {
  // SelectorDestino escribe `#t-<id>`; el div de una sección de diseño no tiene caja (display: contents), así que el ancla
  // va en un span de alto 0 adelante.
  assert.match(leer('app/web-generator/editor/BarraFormato.tsx'), /onElegir\('#t-' \+ s\.id, false, s\.titulo\)/);
  const { htmlDePagina } = await import('../lib/editor-landing/render');
  const { NODO } = await import('../lib/editor-landing/doc');
  const { CONFIG_DEFAULT } = await import('../lib/editor-landing/api-tipos');
  const { TEMAS } = await import('../lib/editor-landing/temas');
  const tarjeta = (id: string) => ({ type: NODO.tarjeta, attrs: { id }, content: [{ type: NODO.htmlEditable, attrs: { id: `e-${id}`, html: '<section><h2>Hola</h2></section>' } }] });
  const html = htmlDePagina({ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [tarjeta('tCaso'), tarjeta('t"x')] } } as never, CONFIG_DEFAULT, TEMAS[0], { modo: 'publico' });
  assert.match(html, /<div class="gm-libre-seccion" data-seccion="tCaso"><span id="t-tCaso" class="gm-ancla-seccion" aria-hidden="true"><\/span><section>/);
  assert.doesNotMatch(html, /id="t-t"x"|id="t-t&quot;x"/, 'un id raro no arma un atributo');
  assert.match(leer('lib/editor-landing/html-editable.ts'), /'\.gm-libre-seccion > \.gm-ancla-seccion \{ display: block; height: 0; scroll-margin-top: 5em; \}'/);
});
