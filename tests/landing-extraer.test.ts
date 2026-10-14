// =============================================================================
// El extractor del copy de una página (lib/landing-extraer.ts), tanda 6 (14/10/2026)
// =============================================================================
// Pedido de Martín (14/10/2026), mirando «Importar con IA»: «El mimso error que nos saltaba con
// Mauricio "No pude leer el texto de esa página". Soluciona eso...». Lo que fija este archivo, sobre
// HTML SINTÉTICO (nada de una página de un cliente):
//   1. el texto que vive en un <div>, un <span>, un <td>, un <label> se LEE, y una sola vez: el de un
//      contenedor no repite el de sus hijos (un regex que agarra el contenedor entero lo repetía);
//   2. un desplegable se lee como PREGUNTA (<summary>, <button aria-expanded>, role=button) y su
//      respuesta como texto: el acordeón de Radix, el armado con divs y el <details> nativo;
//   3. un <a> dentro de una frase es parte de la frase; uno suelto es CTA si parece botón y si no es
//      navegación (no es copy), y lo de adentro de un <nav> no es copy salvo su botón de acción;
//   4. la app que se arma con JavaScript (`<div id="root"></div>` y scripts) da `bloqueada`, y una
//      página que nos contesta 403 se distingue de una que no existe (`bloqueaLaLectura`).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez sobre lib/landing-extraer.ts, con todo en
// verde antes (12 pass) y restaurado de memoria después (12 pass, sha256 igual). Pasan / fallan:
//   · CONTENEDORES sin 'div' (el texto propio de un div no se lee: lo de antes)            -> 8 / 4
//   · `vaciarTodo()` sin llamarse al abrir un bloque (lo de antes del hijo sale después)   -> 11 / 1
//   · <summary> leído como 'texto' en vez de 'pregunta'                                    -> 11 / 1
//   · <button aria-expanded> leído como 'cta' (sin mirar aria-expanded)                    -> 11 / 1
//   · RUIDO sin 'select' (las <option> de un <select> entran como copy)                   -> 11 / 1
//   · `enNav` ignorado al vaciar (el megamenú de un <nav> entra como copy)                 -> 11 / 1
//   · un <a> en una frase tratado siempre como enlace suelto (se pierde de la frase)       -> 11 / 1
//   · bloqueaLaLectura con 404 en ESTADOS_QUE_BLOQUEAN                                     -> 11 / 1
//   · RE_TOKEN sin la rama de las declaraciones (`<!doctype html>` entra como texto)       -> 9 / 3
//   · `bloqueada` nunca (palabras < 0)                                                     -> 11 / 1
//   · h4-h6 sin bajar a h3                                                                 -> 11 / 1
// Y una que dio VERDE, a propósito: sin el cierre implícito del <li> -> 12 / 0. No se ve en la
// salida: abrir un bloque ya vacía lo pendiente de los de abajo, así que un <li> sin cerrar no se
// come al siguiente con o sin él. Lo que cuida es la PROFUNDIDAD de la pila (una página vieja con
// miles de <li>/<p> sin cerrar haría cuadrático cada vaciado), y eso no se mide con una salida.
//
// SEGUNDA PASADA (14/10/2026, pendientes de las piezas del server): la marca de un desplegable es la
// del lector del navegador (`[DESPLEGABLE] pregunta → respuesta`, antes `[PREGUNTA]` con la respuesta
// suelta abajo) y `bloqueada` va null en la fila de una página leída en el navegador. Base en verde
// (13 pass), una rotura por vez, restaurada de memoria (sha256 igual). Pasan / fallan:
//   · textoDeBloques vuelve a escribir `[PREGUNTA]` (lo de antes)                   -> 9 / 4
//   · ninguna respuesta se marca (`respuesta = false`)                              -> 10 / 3
//   · un contenedor no abre su ítem (todos comparten el de arriba)                  -> 10 / 3
//   · trasPregunta mira sólo su ítem, sin la cadena (la región de Radix se pierde)  -> 10 / 3
//   · la respuesta toma sólo el primer renglón                                      -> 11 / 2
//   · bloqueadaParaGuardar devuelve la bandera de la página (lo de antes)           -> 12 / 1
//   · landing-analyst.ts: filaAnalizada vuelve a `p.bloqueada`                      -> 12 / 1
//   · landing-analyst.ts: el fallo después de una lectura guarda `pagina.bloqueada` -> 12 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ErrorDeLectura, MIN_PALABRAS, bloqueaLaLectura, bloqueadaParaGuardar, copyDeHtml, extraerBloques, textoDeBloques, type BloqueLanding,
} from '../lib/landing-extraer';

const pares = (bs: BloqueLanding[]) => bs.map((b) => `${b.tipo}:${b.texto}`);
const todo = (bs: BloqueLanding[]) => bs.map((b) => b.texto).join(' | ');

// ── 1. El texto de los contenedores, una sola vez ─────────────────────────────

test('el texto propio de un div se lee, y el de sus hijos no se repite', () => {
  const html = `<!doctype html><html><head><title>Oferta</title><style>.a{}</style></head><body>
    <section class="hero">
      <div class="wrap">
        <h1>Vende más con tu landing</h1>
        <div class="sub">Un sistema probado <span class="resalta">en 90 días</span> para tu equipo.</div>
        <p>Sin contratos.</p>
        Texto suelto al final del contenedor.
      </div>
    </section>
  </body></html>`;
  assert.deepEqual(pares(extraerBloques(html)), [
    'h1:Vende más con tu landing',
    'texto:Un sistema probado en 90 días para tu equipo.',
    'texto:Sin contratos.',
    'texto:Texto suelto al final del contenedor.',
  ]);
  // El texto del contenedor ANTES de un hijo sale antes que el hijo, y el de después, después: en el
  // orden en que se lee, no pegado al final.
  assert.deepEqual(pares(extraerBloques('<div>Antes del párrafo <p>El párrafo</p> después del párrafo</div>')), [
    'texto:Antes del párrafo', 'texto:El párrafo', 'texto:después del párrafo',
  ]);
});

test('una tabla de precios: cada celda es un bloque; un label y un span sueltos también', () => {
  const html = `<div><table><tr><th>Plan</th><th>Precio</th></tr><tr><td>Básico</td><td><span>$</span><span>49</span></td></tr></table>
    <form><label>Tu correo</label><input type="email"><input type="submit" value="Quiero mi lugar"></form>
    <span>Cupos limitados esta semana</span></div>`;
  assert.deepEqual(pares(extraerBloques(html)), [
    'texto:Plan', 'texto:Precio', 'texto:Básico', 'texto:$ 49', 'texto:Tu correo', 'cta:Quiero mi lugar', 'texto:Cupos limitados esta semana',
  ]);
});

test('los <li> y los <p> sin cerrar no se comen al siguiente', () => {
  const html = '<ul><li>Uno<li>Dos<li>Tres</ul><p>Primero<p>Segundo<div>Tercero</div>';
  assert.deepEqual(pares(extraerBloques(html)), ['lista:Uno', 'lista:Dos', 'lista:Tres', 'texto:Primero', 'texto:Segundo', 'texto:Tercero']);
});

test('lo que no es copy, afuera: scripts, estilos, las opciones de un select, comentarios y el doctype', () => {
  const html = `<!doctype html><!-- un comentario --><body><script>var x = "<p>no</p>";</script><noscript>Activa JavaScript</noscript>
    <select><option>Argentina</option><option>México</option></select><textarea>borrador</textarea>
    <div>Lo único que se lee</div></body>`;
  assert.deepEqual(pares(extraerBloques(html)), ['texto:Lo único que se lee']);
});

// ── 2. Los desplegables ───────────────────────────────────────────────────────

test('acordeón de Radix (como lo sirve un sitio con SSR): la pregunta es PREGUNTA, no un título; la respuesta montada se lee', () => {
  const item = (q: string, r: string, id: number) => `
    <div data-state="closed" data-orientation="vertical" class="border-b">
      <h3 data-orientation="vertical" data-state="closed" class="flex">
        <button type="button" aria-controls="radix-:r${id}:" aria-expanded="false" data-state="closed" class="flex flex-1 items-center">${q}<svg width="15" height="15"><path d="M3 5"></path></svg></button>
      </h3>
      <div data-state="closed" id="radix-:r${id}:" hidden="" role="region" class="overflow-hidden text-sm">${r}</div>
    </div>`;
  const html = `<section><h2>Preguntas frecuentes</h2><div data-orientation="vertical">
    ${item('¿Cuánto dura el programa?', '<div class="pb-4 pt-0">Doce semanas, con una sesión por semana.</div>', 1)}
    ${item('¿Hay garantía?', '', 2)}
  </div><p>¿Tienes otra duda? Escríbenos.</p></section>`;
  assert.deepEqual(pares(extraerBloques(html)), [
    'h2:Preguntas frecuentes',
    'pregunta:¿Cuánto dura el programa?',
    'texto:Doce semanas, con una sesión por semana.',
    'pregunta:¿Hay garantía?',
    'texto:¿Tienes otra duda? Escríbenos.',
  ]);
  // Tanda 6: la marca del lector del navegador. La respuesta montada va con su pregunta; la que no vino
  // en el HTML no se inventa, y el párrafo de DESPUÉS del acordeón no se le pega a la última pregunta.
  assert.equal(textoDeBloques(extraerBloques(html)), [
    '## Preguntas frecuentes',
    '[DESPLEGABLE] ¿Cuánto dura el programa? → Doce semanas, con una sesión por semana.',
    '[DESPLEGABLE] ¿Hay garantía?',
    '¿Tienes otra duda? Escríbenos.',
  ].join('\n'));
});

test('acordeón armado con divs: la respuesta escondida con display:none se lee (antes no se leía ninguna)', () => {
  const html = `<div class="faq">
    <div class="faq-item"><div class="faq-q" role="button" aria-expanded="false" tabindex="0">¿Puedo pagar en cuotas?</div>
      <div class="faq-a" style="display:none">Sí, hasta en 6 cuotas sin interés.</div></div>
    <div class="faq-item"><div class="faq-q" onclick="abrir(this)">¿Qué pasa si no me sirve?</div>
      <div class="faq-a" style="display:none">Te devolvemos el dinero en 30 días.</div></div>
  </div>`;
  assert.deepEqual(pares(extraerBloques(html)), [
    'pregunta:¿Puedo pagar en cuotas?',
    'texto:Sí, hasta en 6 cuotas sin interés.',
    'texto:¿Qué pasa si no me sirve?',
    'texto:Te devolvemos el dinero en 30 días.',
  ]);
  // El que no se declara desplegable (sin aria-expanded ni role) se lee como texto, sin la marca.
  assert.equal(textoDeBloques(extraerBloques(html)), [
    '[DESPLEGABLE] ¿Puedo pagar en cuotas? → Sí, hasta en 6 cuotas sin interés.',
    '¿Qué pasa si no me sirve?',
    'Te devolvemos el dinero en 30 días.',
  ].join('\n'));
});

test('details/summary: la pregunta y la respuesta, esté en un <p>, suelta o en varios renglones', () => {
  const html = `<details><summary>¿Cómo pago?</summary><p>Con tarjeta o transferencia.</p></details>
    <details open><summary><strong>¿Cuándo empiezo?</strong></summary>El lunes siguiente a tu inscripción.</details>
    <details><summary>¿Qué incluye?</summary><p>Tres cosas:</p><ul><li>Las clases</li><li>La comunidad</li></ul></details>
    <p>Un párrafo después de los desplegables.</p>`;
  assert.deepEqual(pares(extraerBloques(html)), [
    'pregunta:¿Cómo pago?', 'texto:Con tarjeta o transferencia.', 'pregunta:¿Cuándo empiezo?', 'texto:El lunes siguiente a tu inscripción.',
    'pregunta:¿Qué incluye?', 'texto:Tres cosas:', 'lista:Las clases', 'lista:La comunidad', 'texto:Un párrafo después de los desplegables.',
  ]);
  assert.equal(textoDeBloques(extraerBloques(html)), [
    '[DESPLEGABLE] ¿Cómo pago? → Con tarjeta o transferencia.',
    '[DESPLEGABLE] ¿Cuándo empiezo? → El lunes siguiente a tu inscripción.',
    '[DESPLEGABLE] ¿Qué incluye? → Tres cosas: Las clases La comunidad',
    'Un párrafo después de los desplegables.',
  ].join('\n'));
  assert.doesNotMatch(textoDeBloques(extraerBloques(html)), /\[PREGUNTA\]/, 'volvió el formato viejo');
});

// ── 3. Los links y el menú ────────────────────────────────────────────────────

test('un link en una frase es de la frase; uno suelto es CTA si parece botón, y si no es navegación', () => {
  const html = `<div>
    <p>Lee <a href="/terminos">los términos</a> antes de empezar.</p>
    <div>Escríbenos por <a href="https://wa.me/1">WhatsApp</a> cuando quieras.</div>
    <a href="/blog">Blog</a>
    <a class="btn btn-primary" href="#form">Lo quiero</a>
    <a href="https://calendly.com/x">Agenda tu llamada</a>
    <button>Enviar</button>
  </div>`;
  assert.deepEqual(pares(extraerBloques(html)), [
    'texto:Lee los términos antes de empezar.',
    'texto:Escríbenos por WhatsApp cuando quieras.',
    'cta:Lo quiero',
    'cta:Agenda tu llamada',
    'cta:Enviar',
  ]);
});

test('lo de adentro de un <nav> no es copy (el megamenú), salvo su botón de acción', () => {
  const html = `<header><nav><div><h2>Producto</h2><ul><li><a href="/a">Diseño</a></li><li><a href="/b">Hosting</a></li></ul>
    <p>Todo lo que necesitas</p></div><a class="cta" href="/demo">Agenda una demo</a></nav>
    <div role="navigation"><span>Inicio</span></div></header>
    <main><h1>El título de verdad</h1></main>`;
  assert.deepEqual(pares(extraerBloques(html)), ['cta:Agenda una demo', 'h1:El título de verdad']);
});

// ── 4. La app que se arma en el navegador, y la página que nos rechaza ───────

test('copyDeHtml: una app de React/Vite da `bloqueada` con 0 palabras; el título sale del <head>', () => {
  const spa = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Mi sistema | Oferta</title>
    <meta name="description" content="Una descripción"><script type="module" src="/assets/index-abc.js"></script></head>
    <body><noscript><img src="https://www.facebook.com/tr?id=1"></noscript><div id="root"></div>
    <script>(function(){ var t = 'texto que no es copy'; })();</script></body></html>`;
  const c = copyDeHtml(spa);
  assert.equal(c.titulo, 'Mi sistema | Oferta');
  assert.equal(c.descripcion, 'Una descripción');
  assert.equal(c.palabras, 0);
  assert.equal(c.bloqueada, true);
  // Y una página con texto de sobra en divs ya no es «bloqueada» (antes daba 0 palabras: no había <p>).
  const parrafo = Array.from({ length: MIN_PALABRAS }, (_, i) => `palabra${i}`).join(' ');
  assert.equal(copyDeHtml(`<body><div class="texto">${parrafo}</div></body>`).bloqueada, false);
});

test('bloqueaLaLectura: 401/403/406/429 se leen en el navegador; un 404 o un error de red, no', () => {
  for (const s of [401, 403, 406, 429]) assert.equal(bloqueaLaLectura(new ErrorDeLectura('x', s)), true, String(s));
  for (const s of [404, 410, 500, 503]) assert.equal(bloqueaLaLectura(new ErrorDeLectura('x', s)), false, String(s));
  assert.equal(bloqueaLaLectura(new Error('No se pudo conectar con la página')), false);
  assert.equal(bloqueaLaLectura('403'), false);
});

test('el formato del texto plano: títulos con #, botones, renglones y desplegables marcados', () => {
  assert.equal(
    textoDeBloques([{ tipo: 'h1', texto: 'A' }, { tipo: 'h3', texto: 'B' }, { tipo: 'cta', texto: 'C' }, { tipo: 'lista', texto: 'D' }, { tipo: 'pregunta', texto: 'E' }, { tipo: 'texto', texto: 'F' }]),
    '# A\n### B\n[BOTÓN] C\n• D\n[DESPLEGABLE] E\nF',
  );
  // Sólo lo marcado como respuesta se pega a la pregunta; una respuesta suelta (sin pregunta) es texto.
  assert.equal(
    textoDeBloques([{ tipo: 'pregunta', texto: 'G' }, { tipo: 'texto', texto: 'H', respuesta: true }, { tipo: 'lista', texto: 'I', respuesta: true }, { tipo: 'cta', texto: 'J' }, { tipo: 'texto', texto: 'K', respuesta: true }]),
    '[DESPLEGABLE] G → H I\n[BOTÓN] J\nK',
  );
  assert.ok(todo(extraerBloques('<h5>Chico</h5>')).includes('Chico'));
  assert.deepEqual(pares(extraerBloques('<h5>Chico</h5>')), ['h3:Chico'], 'h4-h6 cuentan como h3');
});

// ── 5. Lo que se guarda de una página leída en el navegador ──────────────────

test('bloqueada en la fila: null si la leyó el navegador (no sabemos), y lo de siempre si no', () => {
  const base = { bloqueada: false };
  assert.equal(bloqueadaParaGuardar({ ...base, leidaEnNavegador: { interacciones: [] } }), null);
  assert.equal(bloqueadaParaGuardar({ bloqueada: true }), true, 'el copy pegado a mano sigue diciendo que no se lee sola');
  assert.equal(bloqueadaParaGuardar(base), false);
  // Y es lo que escribe el Landing Analyst en la fila, en el análisis y en el fallo.
  const an = readFileSync(join(__dirname, '..', 'lib/landing-analyst.ts'), 'utf8').replace(/\r\n/g, '\n')
    .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const fila = an.slice(an.indexOf('function filaAnalizada('), an.indexOf('function filaError('));
  assert.match(fila, /bloqueada: bloqueadaParaGuardar\(p\),/);
  assert.doesNotMatch(an, /bloqueada: (p|pagina)\.bloqueada\b/, 'una fila volvió a guardar la bandera de la página tal cual');
});
