// =============================================================================
// La réplica editable (28/10/2026): CUALQUIER elemento de una copia se elige y se cambia, y el chat también
// =============================================================================
// Martín (por el Cerebro): «Es super importante que la replica de las landing, no solo replique, sino que luego sea editable
// absolutamente todo... Sino, no tendrá sentido replicarla, seria como hacer una captura... Debe ser todo editable».
// Lo que fija:
//   1. «Elemento» (lib/editor-landing/diseno-elemento-acciones.ts) sobre un DOM de mentira (el jsdom de node_modules está
//      roto): elegir el de afuera hasta la sección, duplicar sin la marca ni el id, mover entre hermanos, quitar (la sección
//      no), los colores, la imagen de fondo y la fuente con valores válidos y NADA más en el `style`, y un `<button>` que pasa
//      a ser un `<a>` con lo suyo.
//   2. Cambiar una imagen saca lo que le gana al `src` (el `srcset`, la carga perezosa y los `<source>` de su `<picture>`),
//      en el editor y en el HTML (html-editable-elementos.ts); y quitar un botón o una imagen (con su `<picture>`).
//   3. El chat: un diseño viaja con sus botones e imágenes por número, y vuelve con sus cambios (texto, destino, colores,
//      quitar; otra imagen de stock que resolvió el server). Lo inválido se cae solo y la sección sigue igual.
//   4. El editor: un `<button>` se elige como botón, el panel está en la barrita, la raíz de una copia se guarda en sus
//      envoltorios.
//   5. Las SECCIONES por el chat («quita la sección de precios»): la IA saca (`quitar`), reordena (`orden`) y duplica
//      (`copiaDe`, sin bloques = la misma); lo que vale se valida en el server (`cambiosDeLista`) y lo aplican, con las
//      mismas reglas, la pantalla (`planDeAplicacion` + `trQuitarYOrdenar`) y la API (`editarConIA`). Una página que no
//      entra entera en un pedido va con la del cursor completa y el resto RESUMIDAS (`vistaQueEntra`): se sacan, se
//      mueven o se copian tal cual, pero no se cambian.
//   7. Lo que faltaba de la lista de Martín: un `<button>` es un botón también para el chat y la API (con destino pasa a
//      `<a>`, y en el editor se ve IGUAL: `igualarEstilo`); elementos NUEVOS adentro de la sección (texto, botón con el
//      estilo de los de la página, imagen) y, por el chat, «duplicar» un botón o una imagen con sus cambios.
//   8. Lo que midió el chat de punta a punta con las copias (la IA de verdad, sin guardar): un texto se cambia por su lugar
//      Y su texto de antes (`cambios`; con «devolvé los 15 en orden» volvían 14 y se perdía todo), y lo que la IA dijo que
//      hizo y no se pudo (la foto que el buscador no trajo) el chat lo DICE (`avisosDeEdicion`).
//   6. «Contenido»: TODO lo de la sección en una lista (diseno-contenido.ts), también lo que la copia dejó oculto (la
//      respuesta de una pregunta, las opciones de un `<select>`) y las imágenes de fondo; un texto se cambia sin perder
//      los espacios de sus bordes.
// Probado rompiéndolo: las roturas y lo que cada una tumbó están en docs/hallazgos-editor-landing.md («La réplica editable»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  agregarElemento, capaEncima, colorValido, comoEnlace, deAfuera, duplicarElemento, fuentesDeLaPagina, igualarEstilo, imagenDeFondo, limpiarParaCambiar,
  moverElemento, nombreDeElemento, nuevaImagen, nuevoBoton, ponerColor, ponerFuente, ponerImagenDeFondo, quitarElemento, MARCA_ELEGIDO,
  type ElementoDiseno,
} from '../lib/editor-landing/diseno-elemento-acciones';
import { conCopiaDeElementoDeDiseno, conEnlaceDeDiseno, conImagenDeDiseno, elementosDeHtmlEditable, sinElementoDeDiseno } from '../lib/editor-landing/html-editable-elementos';
import { aplicarImagenes, bloquesATarjeta, recolectarBusquedas, tarjetaABloques, GRAMATICA_IA, type TarjetaIA } from '../lib/editor-landing/ia-bloques';
import { tipoDeElemento } from '../lib/editor-landing/diseno-elementos';
import { NODO, type JsonNodo } from '../lib/editor-landing/doc';
import { avisosDeEdicion, cambiosDeLista, convertirEdicion, copiaDeSeccion, emparejarEdicion, resumenDeEdicion, vistaQueEntra, FORMATO_EDITAR } from '../lib/editor-landing/ia-reglas';
import { diffTarjetas, idDe, ordenarPorIds, planDeAplicacion, resumenDeCambios } from '../app/web-generator/editor/diff-tarjetas';
import { trQuitarYOrdenar } from '../app/web-generator/editor/insertar';
import { contenidoDeDiseno, ponerTextoDeNodo, type NodoContenido } from '../lib/editor-landing/diseno-contenido';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';

const RAIZ = join(import.meta.dirname, '..');
// Una imagen del chat sólo vale si es del bucket propio (srcImagen lee la variable en cada llamada).
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ejemplo.supabase.co';
const FOTO = 'https://ejemplo.supabase.co/storage/v1/object/public/landing-imagenes/9/stock-1.jpg';
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ── Un DOM de mentira, con lo justo ──────────────────────────────────────────

class Estilo {
  props = new Map<string, { v: string; p: string }>();
  setProperty(n: string, v: string, p = '') { this.props.set(n, { v, p }); }
  removeProperty(n: string) { const x = this.props.get(n); this.props.delete(n); return x?.v ?? ''; }
  get(n: string) { const x = this.props.get(n); return x ? `${x.v}${x.p ? ' !' + x.p : ''}` : undefined; }
}

class El implements ElementoDiseno {
  parentElement: El | null = null;
  hijos: El[] = [];
  attrs = new Map<string, string>();
  style = new Estilo();
  constructor(public tagName: string, attrs: Record<string, string> = {}, public doc = documento) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  get ownerDocument() { return this.doc; }
  get children() { return this.hijos; }
  get childNodes() { return this.hijos; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get previousElementSibling(): El | null { const p = this.parentElement; if (!p) return null; const i = p.hijos.indexOf(this); return i > 0 ? p.hijos[i - 1] : null; }
  get nextElementSibling(): El | null { const p = this.parentElement; if (!p) return null; const i = p.hijos.indexOf(this); return i >= 0 && i < p.hijos.length - 1 ? p.hijos[i + 1] : null; }
  getAttribute(n: string) { return this.attrs.get(n) ?? null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  removeAttribute(n: string) { this.attrs.delete(n); }
  hasAttribute(n: string) { return this.attrs.has(n); }
  hijo(...hs: El[]) { for (const h of hs) { h.remove(); h.parentElement = this; this.hijos.push(h); } return this; }
  append(...hs: unknown[]) { for (const h of hs) if (h instanceof El) this.hijo(h); }
  remove() { const p = this.parentElement; if (p) { p.hijos.splice(p.hijos.indexOf(this), 1); this.parentElement = null; } }
  private insertar(nuevos: El[], delta: 0 | 1) {
    const p = this.parentElement!;
    for (const n of nuevos) n.remove();
    const i = p.hijos.indexOf(this) + delta;
    p.hijos.splice(i, 0, ...nuevos);
    for (const n of nuevos) n.parentElement = p;
  }
  before(...n: El[]) { this.insertar(n, 0); }
  after(...n: El[]) { this.insertar(n, 1); }
  replaceWith(...n: El[]) { this.insertar(n, 0); this.remove(); }
  cloneNode(profundo: boolean): El {
    const c = new El(this.tagName, Object.fromEntries(this.attrs));
    for (const [k, v] of this.style.props) c.style.props.set(k, { ...v });
    if (profundo) for (const h of this.hijos) c.hijo(h.cloneNode(true));
    return c;
  }
  private todos(): El[] { return this.hijos.flatMap((h) => [h, ...h.todos()]); }
  private cumple(sel: string): boolean {
    const m = /^\[([\w-]+)\]$/.exec(sel);
    if (m) return this.attrs.has(m[1]);
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }
  querySelectorAll(sel: string) { return this.todos().filter((e) => e.cumple(sel)); }
  closest(sel: string): El | null { for (let x: El | null = this; x; x = x.parentElement) if (x.cumple(sel)) return x; return null; }
}
const documento = { createElement: (t: string) => new El(t) };

// ── 1. Cualquier elemento ────────────────────────────────────────────────────

test('1a. elegir el de afuera hasta la sección (un picture es una imagen); duplicar sin marca ni id; mover; quitar', () => {
  const img = new El('IMG', { src: 'a.jpg' });
  const pic = new El('PICTURE').hijo(new El('SOURCE', { srcset: 'a.webp' }), img);
  const logo = new El('A', { href: '#', class: 'logo' }).hijo(pic);
  const p1 = new El('P', { id: 'uno', [MARCA_ELEGIDO]: '' });
  const p2 = new El('P');
  const caja = new El('DIV').hijo(logo, p1, p2);
  const raiz = new El('SECTION').hijo(caja);
  // La sección tiene padre (el body): «no se quita» tiene que ser por ser la raíz, no por no tener padre (rotura E2).
  new El('BODY').hijo(raiz);
  assert.equal(deAfuera(img, raiz), logo, 'de la imagen al enlace que la envuelve (salta el picture)');
  assert.equal(deAfuera(logo, raiz), caja);
  assert.equal(deAfuera(caja, raiz), raiz);
  assert.equal(deAfuera(raiz, raiz), null, 'la sección no tiene de afuera');
  const copia = duplicarElemento(p1) as El;
  assert.deepEqual(caja.hijos, [logo, p1, copia, p2], 'la copia, justo después');
  assert.equal(copia.hasAttribute(MARCA_ELEGIDO) || copia.hasAttribute('id'), false, 'sin la marca de elegido ni el id repetido');
  assert.equal(moverElemento(p2, 'antes'), true);
  assert.deepEqual(caja.hijos, [logo, p1, p2, copia]);
  assert.equal(moverElemento(logo, 'antes'), false, 'el primero no sube');
  assert.equal(moverElemento(copia, 'despues'), false, 'el último no baja');
  assert.equal(quitarElemento(raiz, raiz), false, 'la sección no: eso es «Eliminar sección»');
  assert.equal(quitarElemento(img, raiz), true);
  assert.equal(logo.hijos.length, 0, 'una imagen en un picture se va con su picture (si no, quedan sus source)');
  assert.equal(nombreDeElemento(raiz, raiz), 'Sección');
  assert.equal(nombreDeElemento(new El('BUTTON')), 'Botón');
  assert.equal(nombreDeElemento(new El('DIV')), 'Caja');
});

test('1b. colores, imagen de fondo y fuente: valores válidos y nada más en el style', () => {
  const el = new El('DIV');
  for (const malo of ['red;position:fixed', 'url(https://x.com/a.png)', 'var(--x)', '"><script>', 'expression(alert(1))', '']) {
    assert.equal(colorValido(malo), false, malo);
    assert.equal(ponerColor(el, 'texto', malo), false, malo);
  }
  for (const bueno of ['#16a34a', 'rgb(1, 2, 3)', 'rgba(0,0,0,.5)', 'oklch(0.7 0.1 140)', 'white']) assert.equal(colorValido(bueno), true, bueno);
  assert.equal(ponerColor(el, 'fondo', '#16a34a'), true);
  assert.equal(el.style.get('background-color'), '#16a34a !important');
  assert.equal(el.style.get('background-image'), 'none !important', 'un color de fondo tapa el degradado de la hoja');
  ponerColor(el, 'texto', '#fff');
  // 4/11/2026: el relleno también; un título con degradado (`background-clip: text`) se pinta con él, no con `color`.
  assert.equal(el.style.get('color'), '#fff !important');
  assert.equal(el.style.get('-webkit-text-fill-color'), '#fff !important', 'sin el relleno, un texto con degradado no cambia en pantalla');
  ponerColor(el, 'texto', null);
  assert.equal(el.style.get('color'), undefined, '«Como estaba» lo saca');
  assert.equal(el.style.get('-webkit-text-fill-color'), undefined, '«Como estaba» saca también el relleno');
  ponerColor(el, 'fondo', '#000');
  assert.equal(el.style.get('-webkit-text-fill-color'), undefined, 'un color de FONDO no toca el relleno del texto');
  assert.equal(imagenDeFondo('linear-gradient(red, blue), url("https://cdn.x.com/f.png")'), 'https://cdn.x.com/f.png');
  assert.equal(imagenDeFondo('none'), null);
  assert.equal(ponerImagenDeFondo(el, 'javascript:alert(1)'), false);
  assert.equal(ponerImagenDeFondo(el, 'https://x.com/a.png") ; position:fixed'), false);
  assert.equal(ponerImagenDeFondo(el, 'https://bucket.supabase.co/a.png', { size: 'auto', position: '0% 0%' }), true);
  assert.equal(el.style.get('background-image'), 'url("https://bucket.supabase.co/a.png") !important');
  assert.equal(el.style.get('background-size'), 'cover', 'sin acomodo dicho, cubre');
  ponerImagenDeFondo(el, null);
  assert.equal(el.style.get('background-image'), 'none !important');
  assert.equal(ponerFuente(el, 'Inter;color:red'), false);
  assert.equal(ponerFuente(el, '"Inter", sans-serif'), true);
  assert.deepEqual(fuentesDeLaPagina(['"Inter", sans-serif', 'Inter, sans-serif', 'serif', 'Manrope', 'inherit', 'x;y']), ['"Inter", sans-serif', 'Manrope'],
    'sin repetir por la primera familia, sin las genéricas, sin lo inválido');
});

test('1e. una capa de la página encima del fondo (::before / ::after con fondo) se detecta, para avisar (4/11/2026)', () => {
  const capa = (o: Partial<{ content: string; position: string; backgroundColor: string; backgroundImage: string; opacity: string }>) =>
    ({ content: '""', position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none', opacity: '1', ...o });
  assert.equal(capaEncima([capa({ backgroundColor: 'rgb(10, 20, 30)' })]), true, 'un velo de color encima');
  assert.equal(capaEncima([null, capa({ backgroundImage: 'linear-gradient(red, blue)' })]), true, 'un degradado en el ::after');
  assert.equal(capaEncima([capa({})]), false, 'una capa transparente no tapa');
  assert.equal(capaEncima([capa({ content: 'none', backgroundColor: 'red' })]), false, 'sin content no existe');
  assert.equal(capaEncima([capa({ position: 'static', backgroundColor: 'red' })]), false, 'en el flujo no está encima');
  assert.equal(capaEncima([capa({ opacity: '0', backgroundColor: 'red' })]), false, 'invisible no tapa');
  assert.equal(capaEncima([]), false);
  const vista = sinComentarios(leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx'));
  assert.match(vista, /capaEncima\(\[win\.getComputedStyle\(el, '::before'\), win\.getComputedStyle\(el, '::after'\)\]\)\) ctx\.avisar\(/,
    'el editor lo dice después de poner la imagen de fondo');
});

test('1c. un <button> pasa a ser un <a> con lo suyo; un <a> queda; un texto no se convierte', () => {
  const svg = new El('SVG');
  const btn = new El('BUTTON', { class: 'btn primary', style: 'padding:8px', type: 'submit', onclick: 'x()', name: 'go', 'data-x': '1' }).hijo(svg);
  const caja = new El('DIV').hijo(btn);
  const a = comoEnlace(btn) as El;
  assert.equal(a.tagName, 'a');
  assert.equal(caja.hijos[0], a, 'en el mismo lugar');
  assert.equal(a.getAttribute('class'), 'btn primary');
  assert.equal(a.getAttribute('data-x'), '1');
  for (const fuera of ['type', 'onclick', 'name']) assert.equal(a.hasAttribute(fuera), false, `${fuera} no va en un <a>`);
  assert.deepEqual(a.hijos, [svg], 'con sus hijos');
  assert.equal(a.style.get('text-decoration'), 'none');
  const enlace = new El('A', { href: '#' });
  assert.equal(comoEnlace(enlace), enlace);
  assert.equal(comoEnlace(new El('SPAN')), null);
  const rol = new El('DIV', { role: 'button' });
  new El('DIV').hijo(rol);
  assert.equal((comoEnlace(rol) as El).hasAttribute('role'), false);
  assert.equal(tipoDeElemento({ tagName: 'BUTTON', getAttribute: () => null }), 'enlace', 'el editor lo elige como botón');
  assert.equal(tipoDeElemento({ tagName: 'DIV', getAttribute: (n) => (n === 'role' ? 'button' : null) }), 'enlace');
});

test('1d. cambiar una imagen en el editor saca lo que le gana al src', () => {
  const img = new El('IMG', { src: 'a.jpg', srcset: 'a-2x.jpg 2x', sizes: '100vw', 'data-src': 'a.jpg', alt: 'x' });
  const pic = new El('PICTURE').hijo(new El('SOURCE', { srcset: 'a.webp' }), new El('SOURCE', { srcset: 'a.avif' }), img);
  new El('DIV').hijo(pic);
  limpiarParaCambiar(img);
  assert.deepEqual([...img.attrs.keys()].sort(), ['alt', 'src']);
  assert.deepEqual(pic.hijos, [img], 'sin los source del picture');
});

// ── 2. En el HTML (la API y el chat) ─────────────────────────────────────────

test('2. el HTML: cambiar una imagen saca srcset, carga perezosa y los source de su picture; quitar botón o imagen', () => {
  const html = '<div><picture><source srcset="a.webp" type="image/webp"><img src="a.jpg" srcset="a2.jpg 2x" data-src="a.jpg" alt="Equipo"></picture>'
    + '<img src="b.jpg" alt="Logo"><a href="#" class="btn">Probar</a><a href="#">Precios</a></div>';
  const r = conImagenDeDiseno(html, 1, 'https://bucket/nueva.jpg');
  assert.equal(typeof r, 'string');
  assert.equal(r, '<div><picture><img src="https://bucket/nueva.jpg" alt="Equipo"></picture><img src="b.jpg" alt="Logo"><a href="#" class="btn">Probar</a><a href="#">Precios</a></div>');
  assert.equal(conImagenDeDiseno(html, 2, 'https://bucket/x.jpg').toString().includes('<source srcset="a.webp"'), true, 'la otra imagen no toca el picture de la primera');
  assert.equal(sinElementoDeDiseno(html, 'imagen', 1), '<div><img src="b.jpg" alt="Logo"><a href="#" class="btn">Probar</a><a href="#">Precios</a></div>', 'con su picture');
  assert.equal(sinElementoDeDiseno(html, 'enlace', 2), html.replace('<a href="#">Precios</a>', ''));
  assert.deepEqual(sinElementoDeDiseno(html, 'enlace', 9), { error: 'Ese elemento ya no está en la sección.' });
});

// ── 3. El chat ───────────────────────────────────────────────────────────────

const HTML_COPIA = '<div class="hero"><h1>Respond.io</h1><p>Mensajería para empresas</p>'
  + '<a href="#" class="btn" style="background:#000">Get Started</a><a href="#">Login</a>'
  + '<picture><source srcset="h.webp"><img src="https://respond.io/h.png" alt="Inbox"></picture></div>';
const seccion = (html: string): JsonNodo => ({ type: NODO.tarjeta, attrs: { id: 'tA' }, content: [{ type: NODO.htmlEditable, attrs: { id: 'eA', html } }] });

test('3a. un diseño viaja con sus botones e imágenes por número (sin direcciones de imagen)', () => {
  const ida = tarjetaABloques(seccion(HTML_COPIA));
  const b = ida.bloques[0] as Extract<TarjetaIA['bloques'][number], { t: 'diseno' }>;
  assert.equal(b.t, 'diseno');
  assert.deepEqual(b.botones, [{ n: 1, texto: 'Get Started', destino: '#' }, { n: 2, texto: 'Login', destino: '#' }]);
  assert.deepEqual(b.imagenes, [{ n: 1, alt: 'Inbox' }]);
  assert.ok(!JSON.stringify(ida).includes('respond.io/h.png'), 'la dirección de una imagen no va al modelo');
  assert.match(GRAMATICA_IA, /"botones"/);
  assert.match(GRAMATICA_IA, /Nunca escribas una dirección de imagen/);
});

test('3b. vuelve con sus cambios: texto, destino, colores, quitar; otra imagen de stock; lo inválido se cae solo', () => {
  const base = seccion(HTML_COPIA);
  const ida = tarjetaABloques(base);
  const ref = (ida.bloques[0] as { ref: string }).ref;
  const descartes: string[] = [];
  const pedido: TarjetaIA = { ...ida, bloques: [{
    t: 'diseno', ref,
    botones: [
      { n: 1, texto: 'Agenda tu llamada', destino: 'https://wa.me/5491112345678', fondo: '#16a34a', colorTexto: 'red;position:fixed' },
      { n: 2, quitar: true },
    ],
    imagenes: [{ n: 1, busqueda: 'team meeting office', alt: 'Equipo' }],
  }] as TarjetaIA['bloques'] };
  // El server resuelve la búsqueda (como con cualquier imagen de la IA) y recién ahí se convierte.
  assert.deepEqual(recolectarBusquedas([pedido]), ['team meeting office']);
  const conFoto = aplicarImagenes([pedido], new Map([['team meeting office', FOTO]]))[0];
  const vuelta = bloquesATarjeta(conFoto, { base, descartes });
  const html = String(vuelta.content?.[0]?.attrs?.html);
  assert.match(html, /<a href="https:\/\/wa\.me\/5491112345678" class="btn" style="background:#16a34a !important">Agenda tu llamada<\/a>/);
  assert.ok(!html.includes('Login'), 'el botón 2 se fue');
  assert.ok(!html.includes('position:fixed'), 'un «color» que no es un color no entra al style');
  assert.ok(html.includes(`<picture><img src="${FOTO}" alt="Inbox"></picture>`), 'la foto nueva, sin el source viejo');
  assert.ok(descartes.some((d) => /no es un color/.test(d)), descartes.join(' | '));
  assert.match(html, /<h1>Respond\.io<\/h1>/, 'sin «textos», los textos quedan como estaban');
  // Un destino inventado no manda el botón a ningún lado raro: queda como estaba.
  const otro = bloquesATarjeta({ ...ida, bloques: [{ t: 'diseno', ref, botones: [{ n: 1, destino: 'javascript:alert(1)' }] }] as TarjetaIA['bloques'] }, { base, descartes });
  assert.equal(String(otro.content?.[0]?.attrs?.html), HTML_COPIA);
});

// ── 4. El editor ─────────────────────────────────────────────────────────────

test('4. el editor: «Elemento» en la barrita, el botón se elige, la raíz de una copia se guarda en sus envoltorios', () => {
  const vista = sinComentarios(leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx'));
  assert.match(vista, /boton\('Elemento', <Icono nombre="capas" \/>/);
  assert.match(vista, /limpiarParaCambiar\(comoDiseno\(img\)\);\s*img\.src = url;/, 'cambiar la imagen saca lo que le gana al src');
  assert.match(vista, /const a = \(comoEnlace\(comoDiseno\(el\)\) as unknown as HTMLAnchorElement \| null\) \?\? el;/, 'un <button> pasa a <a> al ponerle destino');
  assert.match(vista, /updateAttributes\(env \? \{ html: v, envoltorios: env \} : \{ html: v \}\)/, 'la raíz de una copia (su envoltorio) también se guarda');
  assert.match(vista, /elegirVivo\.current\(conControl \?\? \(tocado && r && r\.contains\(tocado\) \? tocado : r\)\)/, 'cualquier elemento se elige; fuera de la sección, la sección');
  assert.match(leer('lib/editor-landing/diseno-elementos.ts'), /closest\?\.\('svg, img, a, button, \[role="button"\]'\)/);
});

// ── 5. Las secciones por el chat: sacar, reordenar, duplicar ────────────────

const sec = (id: string, texto: string, extra: Record<string, unknown> = {}): JsonNodo => ({
  type: NODO.tarjeta, attrs: { id, ...extra }, content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }],
});
const ids = (l: readonly JsonNodo[]) => l.map(idDe);

test('5a. «quitar» y «orden» de la IA: sólo lo mandado, sin tocar una bloqueada ni adivinar', () => {
  const env = [sec('a', 'Hero'), sec('b', 'Precios'), sec('c', 'FAQ', { bloqueadaIA: true }), sec('d', 'Contacto')];
  // Una inventada, una bloqueada y una que volvió cambiada (la IA la cambió Y la sacó) no se sacan.
  assert.deepEqual(cambiosDeLista({ quitar: ['b', 'zz', 'c', 'd', 'b'] }, env, ['d']).quitar, ['b']);
  assert.deepEqual(cambiosDeLista({ orden: ['b', 'a', 'c', 'd'] }, env, []).orden, ['b', 'a', 'c', 'd']);
  assert.equal(cambiosDeLista({ orden: ['c', 'a', 'b', 'd'] }, env, []).orden, null, 'la bloqueada no se mueve de su lugar');
  assert.equal(cambiosDeLista({ orden: ['b', 'a'] }, env, []).orden, null, 'un orden que no nombra todas no vale');
  assert.equal(cambiosDeLista({ orden: ['a', 'b', 'c', 'd'] }, env, []).orden, null, 'el mismo orden no es un cambio');
  assert.equal(cambiosDeLista({ orden: ['b', 'a', 'c', 'zz'] }, env, []).orden, null);
  // Con una sacada, el orden es el de las que quedan.
  assert.deepEqual(cambiosDeLista({ quitar: ['b'], orden: ['d', 'c', 'a'] }, env, []), { quitar: ['b'], orden: ['d', 'c', 'a'] });
  // Con el alcance «sección» se manda una sola, y se puede sacar (que la página no quede vacía es de planDeAplicacion).
  assert.deepEqual(cambiosDeLista({ quitar: ['a'] }, [sec('a', 'Hero')], []).quitar, ['a']);
  assert.deepEqual(cambiosDeLista({}, env, []), { quitar: [], orden: null });
});

test('5b. duplicar por el chat: «copiaDe» es una sección NUEVA (sin bloques, la misma) y nunca reemplaza a la original', () => {
  const env = [sec('a', 'Hero'), sec('b', 'Precios')];
  const { pares, descartes } = emparejarEdicion([
    { copiaDe: 'a' },
    { copiaDe: 'b', bloques: [{ t: 'titulo', texto: 'Precios para equipos' }] },
  ] as TarjetaIA[], env);
  assert.deepEqual(pares.map((p) => [p.base ? idDe(p.base) : null, p.nueva, !!p.clon]), [['a', true, true], ['b', true, false]]);
  const r = convertirEdicion(pares, env, (t, base) => bloquesATarjeta(t as TarjetaIA, { base, descartes }), descartes);
  assert.equal(r.tarjetas.length, 2, descartes.join(' | '));
  const [clon, cambiada] = r.tarjetas;
  assert.ok(!['a', 'b'].includes(idDe(clon)) && !['a', 'b'].includes(idDe(cambiada)), 'ids nuevos: no pisan a la original');
  assert.deepEqual(r.copias, { [idDe(clon)]: 'a', [idDe(cambiada)]: 'b' });
  assert.deepEqual(clon.content, env[0].content, 'sin bloques, la copia es la misma sección');
  assert.match(JSON.stringify(cambiada.content), /Precios para equipos/);
  // Con UNA sección mandada (el popover), una copia no se confunde con «la que vuelve es ésa».
  const sola = emparejarEdicion([{ copiaDe: 'a' }] as TarjetaIA[], [env[0]]);
  assert.equal(sola.pares[0].nueva, true);
  // Copiar una sección con formulario le da ids nuevos a sus campos (son únicos en la landing, como «Duplicar»).
  const conForm: JsonNodo = { type: NODO.tarjeta, attrs: { id: 'f' }, content: [{ type: NODO.formulario, attrs: { campos: [{ id: 'c-1', tipo: 'email' }] } }] };
  const copia = copiaDeSeccion(conForm);
  const campo = (n: JsonNodo) => (n.content?.[0]?.attrs?.campos as { id: string }[])[0];
  assert.notEqual(campo(copia).id, 'c-1');
  assert.equal(campo(conForm).id, 'c-1', 'no muta la original');
});

test('5c. el plan: la copia va debajo de la suya, el orden en sus lugares, lo sacado se va y la página nunca queda vacía', () => {
  const actuales = [sec('a', 'Hero'), sec('b', 'Precios'), sec('c', 'FAQ'), sec('d', 'Contacto')];
  const copiaA = sec('n1', 'Hero');
  const plan = planDeAplicacion(actuales, [copiaA], { quitar: ['b'], orden: ['d', 'c', 'a'], copias: { n1: 'a' } });
  assert.deepEqual(ids(plan.resultado), ['d', 'c', 'a', 'n1']);
  assert.deepEqual(plan.quitadas, ['b']);
  assert.equal(plan.reordenada, true);
  const d = diffTarjetas(actuales, plan.resultado);
  assert.deepEqual([d.agregadas, d.quitadas, d.movidas], [1, 1, true]);
  assert.equal(resumenDeCambios(d), 'Agrega 1 sección · quita 1 · cambia el orden');
  assert.equal(resumenDeCambios(diffTarjetas(actuales, planDeAplicacion(actuales, [], { orden: ['b', 'a', 'c', 'd'] }).resultado)), 'Cambia el orden de las secciones');
  // Sacar la única: queda (la pantalla tampoco deja el documento sin secciones).
  const unica = planDeAplicacion([sec('a', 'Hero')], [], { quitar: ['a'] });
  assert.deepEqual([ids(unica.resultado), unica.quitadas], [['a'], []]);
  // Una que vuelve cambiada no se saca aunque venga en «quitar».
  assert.deepEqual(ids(planDeAplicacion(actuales, [sec('b', 'Precios 2')], { quitar: ['b'] }).resultado), ['a', 'b', 'c', 'd']);
  // Sin nada de la lista, el plan es el de siempre.
  const comoAntes = planDeAplicacion(actuales, [sec('b', 'Precios 2'), sec('n2', 'Nueva')]);
  assert.deepEqual([ids(comoAntes.resultado), comoAntes.quitadas, comoAntes.reordenada], [['a', 'b', 'n2', 'c', 'd'], [], false]);
  // ordenarPorIds: los nombrados, en el orden pedido y en SUS lugares; los demás quietos.
  assert.deepEqual(ordenarPorIds(['a', 'b', 'c', 'd', 'e'], (x) => x, ['e', 'b']), ['a', 'e', 'c', 'd', 'b']);
});

test('5d. la pantalla: «trQuitarYOrdenar» saca y reordena en UNA transacción, sin rehacer lo que no toca', () => {
  const ESQUEMA = new Schema({ nodes: {
    doc: { content: 'tarjeta+' },
    tarjeta: { content: 'paragraph+', attrs: { id: { default: '' } } },
    paragraph: { content: 'text*' },
    text: {},
  } });
  const doc = ESQUEMA.nodeFromJSON({ type: 'doc', content: ['a', 'b', 'c', 'd'].map((id) => sec(id, id.toUpperCase())) });
  const estado = EditorState.create({ doc });
  const idsDoc = (d: typeof doc) => { const out: string[] = []; d.forEach((n) => { out.push(String(n.attrs.id)); }); return out; };
  const sacar = trQuitarYOrdenar(estado, ['b'], null);
  assert.ok(sacar);
  assert.deepEqual(idsDoc(sacar.doc), ['a', 'c', 'd']);
  assert.equal(sacar.doc.child(0), doc.child(0), 'sólo sacar no rehace las demás (sus iframes no se recargan)');
  // Y el paso BORRA (sin contenido nuevo): reescribir la lista entera deja los mismos nodos y no se ve en el documento
  // (rotura I1), pero es un paso enorme para deshacer y mueve la selección.
  assert.ok(sacar.steps.length > 0 && sacar.steps.every((p) => !(p.toJSON() as { slice?: unknown }).slice), 'sólo sacar: el paso borra, no reescribe la lista');
  const ambos = trQuitarYOrdenar(estado, ['b'], ['d', 'c', 'a']);
  assert.deepEqual(idsDoc(ambos!.doc), ['d', 'c', 'a']);
  assert.equal(trQuitarYOrdenar(estado, [], ['a', 'b', 'c', 'd']), null, 'nada cambia: nada se despacha');
  assert.equal(trQuitarYOrdenar(EditorState.create({ doc: ESQUEMA.nodeFromJSON({ type: 'doc', content: [sec('a', 'A')] }) }), ['a'], null), null, 'nunca sin secciones');
});

test('5e. la cadena: la IA sabe pedirlo, el server lo valida, y la pantalla y la API lo aplican', () => {
  assert.match(FORMATO_EDITAR, /"quitar":\["id",\.\.\.\]/);
  assert.match(FORMATO_EDITAR, /"orden":\["id",\.\.\.\]/);
  assert.match(FORMATO_EDITAR, /"copiaDe"/);
  const ia = sinComentarios(leer('lib/editor-landing/ia.ts'));
  assert.match(ia, /pares\.map\(\(x, k\) => \(\{ \.\.\.x, tarjeta: conFotos\[k\] \}\)\)/, 'la copia no pierde que es nueva al ponerle las fotos');
  assert.match(ia, /const lista = cambiosDeLista\(raw, originales,/);
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /const plan = planDeAplicacion\(actuales, tarjetas, opcionesDePlan\(propuesta\)\);/);
  assert.match(panel, /const tr = trQuitarYOrdenar\(editor\.state, plan\.quitadas, plan\.reordenada \? plan\.resultado\.map\(idDe\) : null\);\s*if \(tr\) \{ editor\.view\.dispatch\(tr\); pasos\+\+; \}/, 'y se DESPACHA (rotura P1)');
  assert.match(panel, /planDeAplicacion\(propuesta\.enviadas, propuesta\.tarjetas, opcionesDePlan\(propuesta\)\)/, 'la revisión muestra lo que se saca');
  assert.match(panel, /msg = proponeAlgo\(r\)/, 'sólo sacar una sección también es una propuesta');
  assert.match(sinComentarios(leer('app/web-generator/editor/AskAgent.tsx')), /crear \? !r\.tarjetas\.length : !proponeAlgo\(r\)/);
  const server = sinComentarios(leer('lib/editor-landing/server.ts'));
  assert.match(server, /planDeAplicacion\(todas, propuestas, \{ anclaNuevas: activa \? dif\.idDe\(activa\) : null, quitar: r\.quitar, orden: r\.orden, copias: r\.copias \}\)/);
});

test('5f. una página que no entra entera: la del cursor completa, las que entren, y el resto resumidas (que no se cambian)', () => {
  const larga = (id: string, n: number) => sec(id, `${id.toUpperCase()} ` + 'palabra '.repeat(n));
  const pagina = [larga('a', 400), larga('b', 400), larga('c', 400), larga('d', 10)];
  const aGramatica = (t: JsonNodo) => ({ id: idDe(t), bloques: [{ t: 'parrafo', texto: JSON.stringify(t.content) }] });
  // Entra entera: va entera, sin resumidas.
  const entera = vistaQueEntra(pagina, aGramatica, { max: 1_000_000, foco: -1 })!;
  assert.deepEqual(entera.resumidas, []);
  // No entra: la del cursor (c) completa primero, después las que entren en orden; el resto, resumidas.
  const max = JSON.stringify({ tarjetas: [aGramatica(pagina[2]), aGramatica(pagina[3]), { id: 'a', resumida: true, titulo: 'x'.repeat(160) }, { id: 'b', resumida: true, titulo: 'x'.repeat(160) }] }, null, 1).length + 50;
  const v = vistaQueEntra(pagina, aGramatica, { max, foco: 2 })!;
  assert.ok(v, 'entra con resumidas');
  assert.deepEqual(v.resumidas, ['a', 'b']);
  assert.ok(v.json.length <= max, `${v.json.length} > ${max}`);
  assert.deepEqual(v.vista.map((x) => ('resumida' in x ? 'r' : 'c')), ['r', 'r', 'c', 'c'], 'en el orden de la página');
  assert.match(JSON.stringify(v.vista[0]), /"titulo":"A palabra/, 'la resumida dice cómo empieza');
  // Si la del cursor no entra, igual va (resumida): sacar o mover se puede pedir igual.
  assert.deepEqual(vistaQueEntra(pagina, aGramatica, { max: 3_000, foco: 0 })?.resumidas, ['a', 'b', 'c']);
  // UNA sola sección que no entra no se manda resumida (no se podría cambiar): «Es mucho de una vez», como antes.
  assert.equal(vistaQueEntra([pagina[0]], aGramatica, { max: 3_000, foco: -1 }), null);
  // Y si ni las resumidas entran, tampoco.
  assert.equal(vistaQueEntra(pagina, aGramatica, { max: 300, foco: -1 }), null);
  // Lo que vuelve con el id de una resumida no la cambia; una copia suya es la misma, tal cual.
  const r = emparejarEdicion([{ id: 'a', bloques: [{ t: 'titulo', texto: 'Inventado' }] }, { copiaDe: 'b', bloques: [{ t: 'titulo', texto: 'X' }] }] as TarjetaIA[], pagina, { resumidas: v.resumidas });
  assert.equal(r.pares.length, 1);
  assert.deepEqual([r.pares[0].nueva, r.pares[0].clon], [true, true]);
  assert.ok(r.descartes.some((d) => /iba resumida/.test(d)), r.descartes.join(' | '));
  // Y se puede sacar o mover (la lista no mira el contenido).
  assert.deepEqual(cambiosDeLista({ quitar: ['a'], orden: ['d', 'b', 'c'] }, pagina, []), { quitar: ['a'], orden: ['d', 'b', 'c'] });
  assert.match(FORMATO_EDITAR, /"resumida": true/);
  assert.match(sinComentarios(leer('lib/editor-landing/ia.ts')), /emparejarEdicion\(comoTarjetasIA\(raw\), originales, \{ resumidas \}\)/);
});

// ── 6. «Contenido»: todo, también lo oculto ─────────────────────────────────

type Nodo = NodoContenido & { attrs?: Record<string, string>; hijos: Nodo[] };
const tx = (data: string): Nodo => ({ nodeType: 3, data, childNodes: [], hijos: [], parentElement: null });
const el = (tagName: string, attrs: Record<string, string>, ...hijos: Nodo[]): Nodo => {
  const n: Nodo = { nodeType: 1, tagName: tagName.toUpperCase(), attrs, hijos, childNodes: hijos, parentElement: null, getAttribute: (a) => attrs[a] ?? null };
  for (const h of hijos) h.parentElement = n;
  return n;
};

test('6. «Contenido»: cada texto, imagen, fondo, enlace y campo, en orden, y lo oculto marcado', () => {
  const respuesta = el('p', { class: 'faq-a', hidden: '' }, tx('  Sí, se cancela cuando quieras.  '));
  const raiz = el('section', {},
    el('h2', {}, tx('Preguntas frecuentes')),
    el('details', {}, el('summary', {}, tx('¿Puedo cancelar?')), respuesta),
    el('a', { href: '#', class: 'btn' }, el('span', {}, tx('Empezar'))),
    el('div', { class: 'hero-bg' }, el('img', { src: 'https://x.com/logo.png', alt: 'Logo' })),
    el('select', {}, el('option', {}, tx('Argentina')), el('option', {}, tx('México'))),
    el('input', { type: 'email', placeholder: 'Tu email' }),
    el('input', { type: 'hidden', value: 'x' }),
    el('script', {}, tx('alert(1)')),
    el('svg', {}, el('text', {}, tx('ícono'))),
    // 4/11/2026: los íconos y los videos también, ocultos o no; lo de adentro de un reproductor es suyo.
    el('div', { hidden: '' }, el('svg', { class: 'ico-oculto' })),
    el('video', { src: 'https://x.com/demo.mp4' }, el('source', { src: 'https://x.com/demo.webm' })),
    el('iframe', { src: 'https://www.youtube.com/embed/abc' }),
    el('div', { 'data-calendly': 'https://calendly.com/x/30min' }, el('svg', {}), el('p', {}, tx('Agenda'))),
  );
  const c = contenidoDeDiseno(raiz, {
    oculto: (n) => (n as Nodo).attrs?.hidden !== undefined,
    fondo: (n) => ((n as Nodo).attrs?.class === 'hero-bg' ? 'https://x.com/fondo.jpg' : null),
  });
  const resumen = c.items.map((it) => `${it.tipo}:${it.tipo === 'texto' ? it.valor : it.tipo === 'imagen' ? it.alt : it.tipo === 'fondo' ? it.url : it.tipo === 'enlace' ? it.texto : it.tipo === 'campo' ? it.ayuda : it.tipo === 'video' ? it.src : ''}${it.oculto ? ' (oculto)' : ''}`);
  assert.deepEqual(resumen, [
    'texto:Preguntas frecuentes',
    'texto:¿Puedo cancelar?',
    'texto:Sí, se cancela cuando quieras. (oculto)',
    'enlace:Empezar',
    'texto:Empezar',
    'fondo:https://x.com/fondo.jpg',
    'imagen:Logo',
    'texto:Argentina',
    'texto:México',
    'campo:Tu email',
    'icono:',
    'icono: (oculto)',
    'video:https://x.com/demo.mp4',
    'video:https://www.youtube.com/embed/abc',
    'video:https://calendly.com/x/30min',
  ], 'sin el script, el texto de adentro de un ícono, el campo oculto ni lo de adentro de un reproductor');
  assert.equal(c.recortado, false);
  // Un texto se cambia con los espacios de sus bordes (no se pega a lo de al lado); vacío no.
  const nodo = respuesta.hijos[0];
  assert.equal(ponerTextoDeNodo(nodo, 'Sí, en  cualquier momento.'), true);
  assert.equal(nodo.data, ' Sí, en cualquier momento. ');
  assert.equal(ponerTextoDeNodo(nodo, '   '), false);
  // Con tope: se dice que se cortó.
  assert.equal(contenidoDeDiseno(raiz, { tope: 3 }).recortado, true);
  // El editor: el panel está en la barrita y lo que hace va por los caminos de siempre.
  const vista = sinComentarios(leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx'));
  assert.match(vista, /boton\('Contenido', <Icono nombre="lista" \/>/);
  assert.match(vista, /onCambiarImagen=\{\(img\) => \{ elegir\(img\); void cambiarImagen\(\); \}\}/, 'cambiar una imagen de la lista limpia su srcset como siempre');
  assert.match(vista, /onCambio=\{conRespiro\}/, 'escribir en la lista guarda');
  // Cambiar un ícono o un video de la lista va por el MISMO selector que al elegirlo con un clic.
  assert.match(vista, /onIcono=\{\(el, b\) => \{ elegir\(el\); abrirIcono\(b\); \}\}/);
  assert.match(vista, /onVideo=\{\(el, b\) => \{ elegir\(el\); void cambiarVideo\(b\); \}\}/);
  const panel = sinComentarios(leer('app/web-generator/editor/nodos/PanelContenidoDiseno.tsx'));
  assert.match(panel, /\{ id: 'icono', nombre: 'Íconos' \}, \{ id: 'video', nombre: 'Videos' \}/, 'las dos pestañas existen');
});

// ── 7. Lo que faltaba: <button>, elementos nuevos, duplicar por el chat ─────

test('7a. un <button> es un botón para el chat y la API: con destino pasa a <a> (sin lo de formulario), sin destino sigue', () => {
  const html = '<div><button type="submit" class="btn" onclick="x()" name="go">Empezar</button><a href="#" class="link">Ver más</a><button>Plano</button></div>';
  const enlaces = elementosDeHtmlEditable(html).filter((e) => e.tipo === 'enlace');
  assert.deepEqual(enlaces.map((e) => [e.n, (e as { texto: string }).texto]), [[1, 'Empezar'], [2, 'Ver más'], [3, 'Plano']]);
  const conDestino = conEnlaceDeDiseno(html, 1, { destino: 'https://wa.me/5491112345678' });
  assert.equal(typeof conDestino, 'string');
  assert.match(conDestino as string, /^<div><a class="btn" style="text-decoration:none;cursor:pointer" href="https:\/\/wa\.me\/5491112345678">Empezar<\/a><a href="#"/);
  assert.ok(!/type=|onclick|name=|<\/button><a href="#"/.test((conDestino as string).split('<a href="#"')[0]), 'sin type, onclick ni name, y cerrado como <a>');
  // Sin clase (se ve como el botón del navegador): en bloque en línea, como era.
  assert.match(conEnlaceDeDiseno(html, 3, { destino: '#precios' }) as string, /<a style="text-decoration:none;cursor:pointer;display:inline-block" href="#precios">Plano<\/a><\/div>$/);
  // Sólo el texto o los colores: sigue siendo un <button>.
  assert.match(conEnlaceDeDiseno(html, 1, { texto: 'Arrancar' }) as string, /<button type="submit" class="btn" onclick="x\(\)" name="go">Arrancar<\/button>/);
  // En el editor, el <a> nuevo se ve IGUAL: lo que cambió por la etiqueta va a su style (ni la manito ni lo que ejecuta).
  const a = new El('A');
  const antes = { display: 'inline-flex', 'padding-top': '12px', color: 'rgb(255, 255, 255)', 'font-family': '"Inter", sans-serif', 'background-image': 'url(javascript:alert(1))' };
  const ahora = { display: 'inline-block', 'padding-top': '12px', color: 'rgb(0, 0, 238)', 'font-family': 'Times', 'background-image': 'none' };
  assert.equal(igualarEstilo(a, antes, ahora), 3);
  assert.deepEqual([a.style.get('display'), a.style.get('color'), a.style.get('font-family'), a.style.get('padding-top'), a.style.get('background-image')],
    ['inline-flex', 'rgb(255, 255, 255)', '"Inter", sans-serif', undefined, undefined]);
  assert.match(sinComentarios(leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx')), /if \(a !== el && antes && win\) igualarEstilo\(comoDiseno\(a\), antes, fotoDeEstilo\(win\.getComputedStyle\(a\)\)\);/);
});

test('7b. elementos NUEVOS en la sección: debajo del elegido (o del bloque de un texto en línea), un botón con el estilo de los de la página', () => {
  const span = new El('SPAN');
  const titulo = new El('H2').hijo(span);
  const cta = new El('A', { href: 'https://original.com', class: 'btn btn-primary', id: 'cta' });
  const caja = new El('DIV').hijo(titulo, cta);
  const raiz = new El('SECTION').hijo(caja);
  const boton = nuevoBoton(documento, raiz) as El;
  assert.deepEqual([boton.tagName, boton.getAttribute('class'), boton.getAttribute('href'), boton.hasAttribute('id')], ['A', 'btn btn-primary', '#', false], 'copia del estilo, sin id y a «#»');
  agregarElemento(span, raiz, boton);
  assert.deepEqual(caja.hijos, [titulo, boton, cta], 'de un texto en línea, después de su bloque (no adentro del título)');
  const img = nuevaImagen(documento, 'https://ejemplo.supabase.co/x.png', 'Foto') as El;
  agregarElemento(raiz, raiz, img);
  assert.equal(raiz.hijos.at(-1), img, 'con la sección elegida, al final');
  assert.equal(img.style.get('max-width'), '100%');
  // Sin un botón en la sección, uno sobrio que lleva a «#».
  const solo = nuevoBoton(documento, new El('SECTION')) as El;
  assert.deepEqual([solo.getAttribute('href'), solo.style.get('display')], ['#', 'inline-block']);
  const vista = sinComentarios(leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx'));
  assert.match(vista, /onAgregar=\{\(q\) => void agregarNuevo\(q\)\}/);
  assert.match(vista, /\{esRaiz \? 'Agregar al final' : 'Agregar debajo'\}/);
});

test('7c. por el chat: «duplicar» un botón o una imagen deja la de antes y pone otra con los cambios; la numeración no se corre', () => {
  const html = '<p><a href="#" id="cta" class="btn">Empezar</a> <a href="#">Login</a> <a href="#">Precios</a></p><picture><source srcset="a.webp"><img src="a.jpg" id="foto" alt="A"></picture>';
  // HTML: la copia va justo después, sin id; una imagen con su <picture>.
  assert.equal(conCopiaDeElementoDeDiseno(html, 'enlace', 1), html.replace('<a href="#" id="cta" class="btn">Empezar</a>', '<a href="#" id="cta" class="btn">Empezar</a><a href="#" class="btn">Empezar</a>'));
  const fotos = conCopiaDeElementoDeDiseno(html, 'imagen', 1) as string;
  assert.equal((fotos.match(/<picture>/g) ?? []).length, 2);
  assert.equal((fotos.match(/id="foto"/g) ?? []).length, 1, 'la copia sin el id');
  assert.ok(!fotos.includes('data-gm-cambio'));
  // El chat: duplicar el 1 (con texto y destino nuevos) y quitar el 2 en el MISMO pedido: cada n es la que vio la IA.
  const base: JsonNodo = { type: NODO.tarjeta, attrs: { id: 't1' }, content: [{ type: NODO.htmlEditable, attrs: { html } }] };
  const ida = tarjetaABloques(base);
  const ref = (ida.bloques[0] as { ref: string }).ref;
  const descartes: string[] = [];
  const vuelta = bloquesATarjeta({ ...ida, bloques: [{ t: 'diseno', ref, botones: [
    { n: 1, duplicar: true, texto: 'Escríbenos', destino: 'https://wa.me/5491112345678' },
    { n: 2, quitar: true },
  ], imagenes: [{ n: 1, duplicar: true, busqueda: 'team meeting office' }] }] as TarjetaIA['bloques'] }, { base, descartes });
  const fuera = String(vuelta.content?.[0]?.attrs?.html);
  assert.match(fuera, /<a href="#" id="cta" class="btn">Empezar<\/a><a href="https:\/\/wa\.me\/5491112345678" class="btn">Escríbenos<\/a> {2}<a href="#">Precios<\/a>/, descartes.join(' | '));
  assert.ok(!fuera.includes('Login'));
  assert.equal((fuera.match(/<picture>/g) ?? []).length, 2, 'la imagen duplicada (sin foto resuelta queda igual a la de antes)');
  assert.match(GRAMATICA_IA, /Con "duplicar":true va OTRO botón igual justo después/);
});

// ── 8. Lo que midió el chat de punta a punta ─────────────────────────────────

test('8a. un texto se cambia por su lugar Y su texto de antes: si la IA cuenta mal, se ubica por el texto; lo que no está, se cae solo', () => {
  // Como tryholo.ai: el título partido en pedazos y textos repetidos.
  const html = '<h1><span>Make</span> <span>videos</span> <span>that sell</span></h1><p>Start free</p><a href="#">Start free</a><p>Pricing</p>';
  const base: JsonNodo = { type: NODO.tarjeta, attrs: { id: 't1' }, content: [{ type: NODO.htmlEditable, attrs: { html } }] };
  const ida = tarjetaABloques(base);
  const ref = (ida.bloques[0] as { ref: string }).ref;
  assert.deepEqual((ida.bloques[0] as { textos: string[] }).textos, ['Make', 'videos', 'that sell', 'Start free', 'Start free', 'Pricing']);
  const descartes: string[] = [];
  const vuelta = bloquesATarjeta({ ...ida, bloques: [{ t: 'diseno', ref, cambios: [
    { n: 2, antes: 'Make', texto: 'Hacé' },                 // contó mal (es el 1): va al «Make»
    { n: 5, antes: 'Start free', texto: 'Empezá gratis' },  // repetido: va al más cercano a 5 (el botón)
    { n: 9, antes: 'No existe', texto: 'X' },               // no está: se cae SÓLO éste
    { n: 6, antes: 'pricing', texto: 'Precios' },            // sin importar mayúsculas
  ] }] as TarjetaIA['bloques'] }, { base, descartes });
  const fuera = String(vuelta.content?.[0]?.attrs?.html);
  assert.equal(fuera, '<h1><span>Hacé</span> <span>videos</span> <span>that sell</span></h1><p>Start free</p><a href="#">Empezá gratis</a><p>Precios</p>');
  assert.ok(descartes.some((d) => /no encontré el texto «No existe»/.test(d)), descartes.join(' | '));
  assert.match(GRAMATICA_IA, /"cambios":\[\{"n":3,"antes":"el texto como está, copiado tal cual","texto":"el nuevo"\}\]/);
});

test('8b. lo que la IA dijo que hizo y no se pudo, el chat lo dice (la foto que no apareció, los textos que no se ubicaron)', () => {
  const avisos = avisosDeEdicion([
    'diseno «r1»: imagen 1: no encontré una para «team working in an office», queda la que estaba',
    'diseno «r2»: volvieron 14 textos y la sección tiene 15: queda como estaba',
    'diseno «r3»: imagen 2: no encontré una para «team working in an office», queda la que estaba',
    'otra cosa que no le importa a la persona',
  ]);
  assert.deepEqual(avisos, [
    'No encontré una foto de «team working in an office»: la imagen quedó como estaba.',
    'Una sección quedó con sus textos de antes: no pude ubicar cada cambio.',
  ]);
  assert.deepEqual(avisosDeEdicion([]), []);
  // Lo que el chat le contesta a la persona (12/11: por lo que dice, no por cómo está escrita la línea).
  assert.equal(
    resumenDeEdicion({ hay: true, resumenModelo: 'Cambié el titular.', noSePudo: avisos, cifras: [] }),
    'Cambié el titular. No encontré una foto de «team working in an office»: la imagen quedó como estaba. Una sección quedó con sus textos de antes: no pude ubicar cada cambio.',
  );
  assert.equal(resumenDeEdicion({ hay: false, resumenModelo: '', noSePudo: avisos.slice(1), cifras: [] }), 'Sin cambios. Una sección quedó con sus textos de antes: no pude ubicar cada cambio.');
  assert.equal(resumenDeEdicion({ hay: true, resumenModelo: '', noSePudo: [], cifras: [] }), 'Listo.');
  // …y el chat de editar arma su resumen con eso, pasándole lo que no se pudo.
  assert.match(sinComentarios(leer('lib/editor-landing/ia.ts')), /resumen: resumenDeEdicion\(\{[^}]*\bnoSePudo\b/);
});
