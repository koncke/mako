// =============================================================================
// El editor web de punta a punta con las páginas de MaKo (26/10/2026)
// =============================================================================
// Martín, textual: «En editor web, prueba tambien de punta a punta que todo funcione... Cosas basicas, como que si le
// doy click derecho y luego doy click izquierdo en otro lado, debe desaparecer el desplegable. 1. La barra de texto me
// aparece en gris, no es editable. 2. Los botones tampoco son editables. 3. Las secciones no se pueden acomodar. 4. El
// video no se muestra... 5. Muchos botones flotantes que paso el scroll, no me dan tiempo a llegar a apretarlos y
// desaparecen. 6. La animación que creo que es un SVG de MaKo no aparece... 7. El Calendly embed no aparece...»
//
// Reproducido en producción sobre una COPIA de la landing principal (#44) y una creada desde cero (#45). Las causas:
//   · el menú: los paneles se cierran con un `pointerdown` de la página, y el clic adentro de un diseño es de su iframe;
//   · 1: la barra lee la selección de ProseMirror, y el cursor de un diseño está en su iframe;
//   · 2: el texto se escribía, pero al elegir un botón sólo había «Enlace» (un ícono) y nada para su color;
//   · 3: el arrastre decide por la MITAD de cada sección, y la de una sección de 2.000 px quedaba fuera de la pantalla;
//   · 4 y 7: un iframe sin scripts tampoco deja correr los de adentro (Panda, Calendly): se veía su ficha;
//   · 5: la barrita del diseño se iba con el `mouseleave` al cruzar sus 12 px de aire, y el ⋮ quedaba arriba de la sección;
//   · 6: no es un SVG, es un canvas que dibuja un script (la red de MaKo).
// PROBADO ROMPIÉNDOLO (romper-punta-a-punta.mjs del scratchpad): ver el relevo del Web Generator.
// Correr: node --import tsx --test tests/editor-web-punta-a-punta-26-10.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NODO, TAMANOS_TEXTO } from '../lib/editor-landing/doc';
import { rotuloDeSeccion } from '../lib/editor-landing/html-editable';
import { TAM_EN_DISENO, alineacionDe, tipoDeEtiqueta, tipoPermitidoEnDiseno } from '../app/web-generator/editor/acciones-diseno';
import { activarDiseno, disenoActivo, soltarDiseno } from '../app/web-generator/editor/puente-diseno';
import { hexDeRgb } from '../app/web-generator/editor/botones-diseno';

const RAIZ = join(import.meta.dirname, '..');
// El fin de línea, normalizado ANTES de buscar (AGENTS.md, «Fin de línea»): en un clon con autocrlf los fuentes llegan en CRLF.
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const VISTA = 'app/web-generator/editor/nodos/HtmlEditableVista.tsx';

test('el menú se cierra con un clic adentro de un diseño: el clic del iframe llega a la página como pointerdown', () => {
  const v = sinComentarios(leer(VISTA));
  const i = v.indexOf("d.addEventListener('pointerdown'");
  assert.ok(i > 0, 'el documento del diseño no reenvía su clic');
  assert.match(v.slice(i, i + 500), /m\.dispatchEvent\(new PointerEvent\('pointerdown', \{\s*bubbles: true,/);
  // Todos los paneles del editor se cierran con ESE evento (uno con `mousedown` no se enteraba).
  for (const rel of ['app/web-generator/editor/extensiones/piezas.tsx', 'app/web-generator/editor/BarraFormato.tsx', 'app/web-generator/editor/AskAgent.tsx']) {
    const s = sinComentarios(leer(rel));
    assert.match(s, /document\.addEventListener\('pointerdown', \w+, true\)/, `${rel}: no se cierra con un pointerdown`);
    assert.doesNotMatch(s, /document\.addEventListener\('mousedown', \w+, true\)/, `${rel}: un panel que se cierra con mousedown no ve el clic del diseño`);
  }
});

test('1. la barra «Texto» trabaja en el diseño que tiene el cursor', () => {
  const b = sinComentarios(leer('app/web-generator/editor/BarraFormato.tsx'));
  assert.match(b, /const estDiseno = modo === 'fija' && diseno \? estadoDeDiseno\(diseno\.doc\) : null;/);
  // Cada acción va primero al diseño, y sólo si no está, a ProseMirror (que le robaría el foco al iframe).
  for (const [accion, enDiseno] of [
    ['const marcar', 'marcarEnDiseno'], ['const quitarFormato', 'quitarFormatoEnDiseno'], ['const ponerResaltado', 'resaltadoEnDiseno'],
    ['const alinear', 'alinearEnDiseno'], ['const ponerEnlace', 'enlaceEnDiseno'], ['const quitarEnlace', 'quitarEnlaceEnDiseno'], ['const ponerTipo', 'tipoEnDiseno'],
  ]) {
    const i = b.indexOf(accion + ' = ');
    assert.ok(i > 0, `falta ${accion}`);
    const cuerpo = b.slice(i, b.indexOf('\n  };', i));
    const j = cuerpo.indexOf(enDiseno);
    assert.ok(j > 0, `${accion} no escribe en el diseño`);
    const k = cuerpo.search(/cadena\(\)|aplicarTipoBloque\(/);
    assert.ok(k < 0 || j < k, `${accion} va a ProseMirror antes que al diseño`);
  }
  assert.match(b, /onClick=\{quitarFormato\}/);
  assert.match(b, /tipoPermitido=\{enDiseno \? tipoPermitidoEnDiseno : undefined\}/);
  // El cursor que vuelve a un bloque deja el diseño.
  assert.match(b, /editor\.on\('focus', volver\);/);
  // Lo puro: cada tamaño de la barra tiene su medida, y los estilos que no son una etiqueta no se ofrecen.
  for (const t of TAMANOS_TEXTO) assert.match(TAM_EN_DISENO[t], /^\d+(\.\d+)?em$/, `el tamaño ${t}`);
  assert.equal(tipoPermitidoEnDiseno('h2'), true);
  assert.equal(tipoPermitidoEnDiseno('antetitulo'), false);
  assert.equal(tipoPermitidoEnDiseno('tareas'), false);
  assert.equal(tipoDeEtiqueta('H3'), 'h3');
  assert.equal(tipoDeEtiqueta('p'), 'parrafo');
  assert.equal(tipoDeEtiqueta('div'), null);
  assert.equal(alineacionDe('start'), 'left');
  assert.equal(alineacionDe('-webkit-center'), 'center');
  assert.equal(alineacionDe('end'), 'right');
});

test('el puente: el diseño activo es uno, y se suelta sólo el suyo', () => {
  const a = { doc: {} as Document, guardar: () => {} };
  const b = { doc: {} as Document, guardar: () => {} };
  activarDiseno(a);
  assert.equal(disenoActivo()?.doc, a.doc);
  activarDiseno(b);
  assert.equal(disenoActivo()?.doc, b.doc);
  soltarDiseno(a.doc);
  assert.equal(disenoActivo()?.doc, b.doc, 'soltar OTRO documento no suelta el activo');
  soltarDiseno();
  assert.equal(disenoActivo(), null);
});

test('2. un botón del diseño se edita: «Botón» con su texto, su destino y sus colores', () => {
  const v = sinComentarios(leer(VISTA));
  assert.match(v, /\{esBoton && boton\('Botón', <Icono nombre="enlace" \/>, abrirEnlace, true, 'Botón'\)\}/);
  assert.match(v, /if \(esBotonDeDiseno\(a\)\) setPanelBoton\(\{ ancla, a \}\); else setEnlace\(\{ ancla, a \}\);/);
  const panel = v.slice(v.indexOf('function PanelBoton('));
  assert.match(panel, /ponerTextoDeBoton\(a, e\.target\.value\)/);
  assert.match(panel, /fila\('fondo', 'Color del botón'\)/);
  assert.match(panel, /fila\('texto', 'Color del texto'\)/);
  assert.match(panel, /<SelectorDestino /);
  // El color va con !important (una hoja de diseño lo escribe así) y nunca entra otra cosa que un color al `style`.
  assert.match(leer('app/web-generator/editor/botones-diseno.ts'), /a\.style\.setProperty\(cual === 'fondo' \? 'background' : 'color', valor, 'important'\);/);
  assert.match(panel, /if \(!v \|\| \/\[;\{\}<>"\]\|url\\\(\/i\.test\(v\)\) return;/);
  assert.equal(hexDeRgb('rgb(47, 111, 237)'), '#2f6fed');
  assert.equal(hexDeRgb('rgba(255,255,255,0.5)'), '#ffffff');
  assert.equal(hexDeRgb('oklch(0.6 0.2 250)'), 'oklch(0.6 0.2 250)');
});

test('3. reordenar: mientras se arrastra, las secciones son franjas y se suelta donde se ve', () => {
  const css = leer('app/web-generator/editor/extensiones/estilos-nodos.ts');
  assert.match(css, /'body\[data-gm-reordenando\] \.ProseMirror > \.gm-tarjeta \{ max-height: 132px; overflow: hidden; \}'/);
  const t = sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'));
  const arranca = t.indexOf("document.body.setAttribute('data-gm-reordenando', 'si');");
  assert.ok(arranca > 0, 'el arrastre no achica las secciones');
  assert.ok(arranca > t.indexOf('g.arrastrando = true;'), 'se achican sólo cuando ya es un arrastre (un clic abre el menú)');
  assert.match(t.slice(t.indexOf('const terminarArrastre')), /document\.body\.removeAttribute\('data-gm-reordenando'\);/);
  // Cada franja con su nombre (medido en producción: la parte de arriba de un diseño es su margen, en blanco).
  assert.match(css, /'body\[data-gm-reordenando\] \.ProseMirror > \.gm-tarjeta\[data-rotulo\]::before \{ content: attr\(data-rotulo\);/);
  assert.match(t, /if \(rotulo\) sec\.setAttribute\('data-rotulo', rotulo\); else sec\.removeAttribute\('data-rotulo'\);/);
  const diseno = (html: string) => ({ type: NODO.tarjeta, attrs: { id: 'tA' }, content: [{ type: NODO.htmlEditable, attrs: { html } }] });
  assert.equal(rotuloDeSeccion(diseno('<p>Solo 5 cupos</p><h2>¿Qué es <em>MaKo</em>… &amp; por qué?</h2>')), '¿Qué es MaKo… & por qué?', 'el título, no la etiqueta chica');
  assert.equal(rotuloDeSeccion({ type: NODO.tarjeta, content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Precios' }] }] }), 'Precios');
});

test('4 y 7. el video y la agenda, REALES encima de su lugar, y sin el mouse hasta que se eligen', () => {
  const v = sinComentarios(leer(VISTA));
  assert.match(v, /d\.querySelectorAll\('iframe\[data-gmx-vista\]'\)\.forEach\(\(f, i\) => sumar\(f, f\.getAttribute\('src'\) \?\? '', i\)\);/);
  assert.match(v, /d\.querySelectorAll\('\[data-calendly\]'\)\.forEach\(\(el, i\) => sumar\(el, el\.getAttribute\('data-calendly'\) \?\? '', 1000 \+ i\)\);/);
  // La capa sale de `embedDe` (lo que el saneo deja insertar) y con el sandbox de los insertados, no uno abierto.
  assert.match(v, /const e = embedDe\(texto\);\n\s*const l = e \? lugar\(el\) : null;\n\s*if \(e && l\) out\.push\(\{ clave: `\$\{i\}:\$\{e\.src\}`, tipo: 'embed', src: e\.src,/);
  assert.match(v, /<iframe key=\{v\.clave\} className="gmx-vivo" src=\{v\.src\} title=\{v\.titulo\} sandbox=\{SANDBOX_EMBED\} allow=\{ALLOW_EMBED\}/);
  assert.match(v, /pointerEvents: esActivo && !!elegidoEl && \(elegidoEl === v\.el \|\| v\.el\.contains\(elegidoEl\)\) \? 'auto' : 'none'/);
  // La ficha de abajo se sigue sacando al guardar.
  assert.match(v, /copia\.querySelectorAll\('\[data-gmx-vista\]'\)\.forEach\(\(el\) => \{ el\.removeAttribute\('srcdoc'\);/);
});

test('5. la barrita del diseño se queda mientras es el activo, y el ⋮ va pegado arriba con un retardo al irse', () => {
  const v = sinComentarios(leer(VISTA));
  assert.match(v, /const mostrarBarra = editable && \(esActivo \|\| abierto\);/);
  assert.doesNotMatch(v, /onMouseLeave/, 'la barrita se va con el mouseleave: no se llega a apretarla');
  assert.match(v, /'\.gmx-nv-ancla\{position:sticky;top:56px;height:0;z-index:6\}'/);
  assert.match(v, /<div className="gmx-nv-ancla" contentEditable=\{false\}>\s*\{mostrarBarra && \(/);
  const css = leer('app/web-generator/editor/extensiones/estilos-nodos.ts');
  assert.match(css, /'\.gmc-lado \{ position: absolute; top: 0; bottom: 0; right: 100%;[^']*visibility: hidden;[^']*transition: opacity 0\.15s ease 0\.5s, visibility 0s linear 0\.65s;/);
  assert.match(css, /'\.gmc-lado-in \{ position: sticky; top: 12px;/);
  assert.match(css, /\.gmc-lado\[data-abierto\] \{ opacity: 1; visibility: visible; transition-delay: 0s; \}/);
  assert.match(sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx')), /className="gma gmc gmc-lado"[^>]*>\s*<div className="gmc-lado-in">/);
});

test('6. la red de MaKo se dibuja en el editor, en un canvas de la PÁGINA encima del suyo', () => {
  const r = sinComentarios(leer('app/web-generator/editor/red-de-mako.ts'));
  assert.match(r, /const SRC = '\/vsl-assets\/mako-anim\.js';/);
  assert.ok(existsSync(join(RAIZ, 'public', 'vsl-assets', 'mako-anim.js')), 'el dibujante de la red no está en public/');
  assert.match(leer('public/vsl-assets/mako-anim.js'), /window\.MakoAnim/);
  // Medido en producción y en Chrome sin ventana: lo que se pinta en el canvas DEL IFRAME (sin scripts) no se ve.
  assert.doesNotMatch(r, /doc\.querySelectorAll/, 'la red vuelve a pintarse en el canvas del iframe (no se ve)');
  const v = sinComentarios(leer(VISTA));
  assert.match(v, /d\.querySelectorAll\('canvas\[data-animacion="mako-red"\]'\)\.forEach\(\(el, i\) => \{/);
  // 29/10/2026: con la copia achicada al lienzo, la red va encima de su lugar × la escala.
  assert.match(v, /<canvas key=\{v\.clave\} className="gmx-vivo-red" aria-hidden="true" style=\{\{ left: v\.x \* escala, top: v\.y \* escala, width: v\.w \* escala, height: v\.h \* escala \}\} \/>/);
  assert.match(v, /animarRedDeMako\(\(\) => Array\.from\(marco\.current\?\.parentElement\?\.querySelectorAll<HTMLCanvasElement>\('canvas\.gmx-vivo-red'\)/);
  assert.match(v, /'\.gmx-editable-vivo>canvas\.gmx-vivo-red\{position:absolute;display:block;pointer-events:none;z-index:2\}'/);
  // Si un diseño viejo guardó el tamaño de dibujo en su canvas, se saca al guardar.
  assert.match(v, /copia\.querySelectorAll\('canvas\[data-animacion\]'\)\.forEach\(\(el\) => \{ el\.removeAttribute\('width'\); el\.removeAttribute\('height'\); \}\);/);
});
