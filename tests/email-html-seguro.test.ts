// =============================================================================
// El cuerpo HTML de un email de /chatbot: el saneo, el texto de respaldo y el envío
// =============================================================================
// Tercera tanda (09/10/2026, punto 12 del pedido y decisión 12 del diseño): el editor del email es el
// editor rico de las lecciones, el paso guarda `cuerpo_html` (saneado con una lista blanca) y el motor
// lo manda como HTML; `cuerpo` queda como el texto plano de respaldo, DERIVADO.
//
// Lo que fija este test:
//   · la lista blanca de lib/email-html-seguro.ts: lo que el editor escribe pasa, los vectores de
//     siempre no (script, on*, javascript: con entidades y tabs, data:, svg, style libre, iframe);
//   · que la salida se ARMA DE CERO (idempotente: sanear lo saneado devuelve lo mismo);
//   · el texto plano (`textoDeHtmlEmail`): párrafos, listas, celdas y la dirección de un link;
//   · las variables con el valor ESCAPADO (un nombre con `<b>` o `"` no abre nada);
//   · el render (`renderEmailHtml` con `bodyHtml`): el HTML reemplaza al texto, con el estilo en
//     línea de un correo, y un email sin HTML sale como siempre;
//   · el motor (lib/nutricion.ts, leído como fuente porque es server-only): `setSecuenciaPasos`
//     guarda el HTML por las funciones de este módulo y el envío lo vuelve a sanear.
//
// ── Roturas (09/10/2026) ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sanearHtmlEmail, textoDeHtmlEmail, aplicarVariablesHtml, htmlEmailVacio, cuerpoHtmlAGuardar,
  cuerpoHtmlEntrante, problemaDeCuerpoHtml, TOPE_HTML_EMAIL, TOPE_HTML_EMAIL_ENTRADA,
} from '../lib/email-html-seguro';
import { renderEmailHtml, htmlDeCuerpoTexto, estiloDeCorreo } from '../lib/email-html';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que escribe el editor rico (TipTap) con cada botón de su barra. */
const DEL_EDITOR = [
  '<p>Hola <strong>Ana</strong>, <em>mira</em> <u>esto</u> y <s>lo viejo</s> con <code>código</code>.</p>',
  '<h2>Tu visita</h2><h3>El lunes</h3><p style="text-align: center">centrado</p>',
  '<ul><li><p>uno</p></li><li><p>dos</p></li></ul><ol start="3"><li><p>tres</p></li></ol>',
  '<blockquote><p>una cita</p></blockquote><pre><code>const a = 1;</code></pre><hr>',
  '<p><span style="color: #2563EB">azul</span> y <mark data-color="#fde68a" style="background-color: #fde68a; color: inherit">resaltado</mark></p>',
  '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://valle.mx/visita?a=1&amp;b=2">la visita</a></p>',
  '<table style="min-width: 75px"><colgroup><col style="min-width: 25px"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>A</p></th><th><p>B</p></th></tr><tr><td colspan="2"><p>c</p></td></tr></tbody></table>',
];

// ── La lista blanca ─────────────────────────────────────────────────────────────────────────

test('lo que escribe el editor rico pasa, con su forma', () => {
  const s = DEL_EDITOR.map((h) => sanearHtmlEmail(h));
  assert.equal(s[0], DEL_EDITOR[0], 'las marcas pasan tal cual');
  assert.equal(s[1], '<h2>Tu visita</h2><h3>El lunes</h3><p style="text-align:center;">centrado</p>');
  assert.equal(s[2], DEL_EDITOR[2], 'las listas y el `start` pasan');
  assert.equal(s[3], DEL_EDITOR[3]);
  assert.equal(s[4], '<p><span style="color:#2563EB;">azul</span> y <mark style="background-color:#fde68a;">resaltado</mark></p>',
    'el color pasa; `color: inherit` y `data-color` no');
  assert.equal(s[5], '<p><a href="https://valle.mx/visita?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">la visita</a></p>',
    'el link pasa, con el `&` escapado y sus atributos fijos');
  assert.equal(s[6], '<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td colspan="2"><p>c</p></td></tr></tbody></table>',
    'la tabla pasa sin los anchos en px; colspan="1" es el default y no se escribe');
  // b/i/strike/del/ins y los títulos chicos pasan con el nombre del editor.
  assert.equal(sanearHtmlEmail('<b>a</b><i>b</i><strike>c</strike><del>d</del><ins>e</ins><h1>f</h1><h5>g</h5>'),
    '<strong>a</strong><em>b</em><s>c</s><s>d</s><u>e</u><h1>f</h1><h3>g</h3>');
});

test('sanear lo saneado devuelve lo mismo (la salida se arma de cero)', () => {
  const sucios = [...DEL_EDITOR, '<p onclick=x()>a<script>b</script><a href="javascript:x">c</a><img src="https://x.io/a.png" data-ancho="50" data-alinea="centro" alt="f">'];
  for (const h of sucios) {
    const una = sanearHtmlEmail(h);
    assert.equal(sanearHtmlEmail(una), una, `no es idempotente: ${h}`);
  }
});

test('los vectores de siempre no pasan', () => {
  const casos: Array<[string, RegExp]> = [
    ['<script>alert(1)</script><p>ok</p>', /script|alert/i],
    ['<p onclick="alert(1)" onmouseover=alert(2)>ok</p>', /on[a-z]+=|alert/i],
    ['<img src=x onerror=alert(1)>', /<img|onerror|alert/i],
    ['<a href="javascript:alert(1)">a</a>', /href|javascript/i],
    ['<a href="java&#09;script:alert(1)">a</a>', /href|script/i],
    ['<a href="&#106;avascript:alert(1)">a</a>', /href|avascript/i],
    ['<a href=" JaVaScRiPt:alert(1)">a</a>', /href/i],
    // Con host y todo: la URL «parsea» y tiene hostname. Lo que la frena es el ESQUEMA.
    ['<a href="javascript://valle.mx/%0Aalert(1)">a</a><a href="ftp://valle.mx/a">b</a>', /href/i],
    ['<a href="data:text/html,<script>alert(1)</script>">a</a>', /href|data:|script/i],
    ['<a href="vbscript:x">a</a><a href="file:///etc/passwd">b</a><a href="/api/x">c</a><a href="//evil.com">d</a>', /href/i],
    ['<img src="http://x.io/a.png"><img src="data:image/png;base64,AAAA"><img src="https://u:p@x.io/a.png">', /<img/i],
    ['<svg><animate onbegin=alert(1)><p>dentro</p></svg>', /svg|animate|alert|dentro/i],
    ['<style>p{color:red}</style><iframe src="javascript:alert(1)"></iframe><object data="x"></object>', /style|iframe|object|javascript|color:red/i],
    ['<p style="background:url(javascript:alert(1));color:expression(alert(1))">a</p>', /style|url|expression/i],
    ['<span style="color: red; position: fixed; top:0">a</span>', /style/i],
    ['<!-- <script>alert(1)</script> --><p>ok</p>', /script|<!--/i],
    ['<form action="https://x.io"><input name="t"><button>Mandar</button></form>', /form|input|button|Mandar/i],
    ['<div><textarea><script>alert(1)</script></textarea></div>', /textarea|script/i],
  ];
  for (const [entrada, prohibido] of casos) {
    const s = sanearHtmlEmail(entrada);
    assert.doesNotMatch(s, prohibido, `pasó algo de ${entrada} → ${s}`);
  }
  // Un link con un espacio (el panel del editor lo acepta: `new URL` lo codifica) NO se descarta: el
  // espacio no abre nada, sale escapado. Descartarlo borraba el link en silencio al guardar.
  assert.equal(sanearHtmlEmail('<a href="https://valle.mx/mi visita">v</a>'), '<a href="https://valle.mx/mi visita" target="_blank" rel="noopener noreferrer">v</a>');
  // Un link sin destino válido pierde la etiqueta pero no el texto.
  assert.equal(sanearHtmlEmail('<p><a href="javascript:x">el texto</a> sigue</p>'), '<p>el texto sigue</p>');
  // El texto con `<` o `&` sueltos sale escapado; las entidades bien escritas se quedan.
  assert.equal(sanearHtmlEmail('<p>a < b & c &lt;d&gt; &amp; e</p>'), '<p>a &lt; b &amp; c &lt;d&gt; &amp; e</p>');
});

test('una imagen https pasa con su tamaño; un video insertado sale como LINK a su dirección', () => {
  assert.equal(sanearHtmlEmail('<img src="https://cdn.valle.mx/a.png" alt="Fachada" data-ancho="50" data-alinea="centro" width="900">'),
    '<img src="https://cdn.valle.mx/a.png" alt="Fachada" data-ancho="50" data-alinea="centro">');
  assert.equal(sanearHtmlEmail('<img src="https://cdn.valle.mx/a.png" data-ancho="55px">'), '<img src="https://cdn.valle.mx/a.png" alt="">',
    'un ancho fuera de la lista no se escribe');
  assert.equal(sanearHtmlEmail('<p>a</p><iframe src="https://www.youtube.com/embed/abc" sandbox=""></iframe>'),
    '<p>a</p><p><a href="https://www.youtube.com/embed/abc" target="_blank" rel="noopener noreferrer">https://www.youtube.com/embed/abc</a></p>');
});

test('un HTML a medio cerrar se cierra; un cierre suelto no cierra nada', () => {
  assert.equal(sanearHtmlEmail('<p>a <strong>b'), '<p>a <strong>b</strong></p>');
  assert.equal(sanearHtmlEmail('</p></strong><p>a</p></em>'), '<p>a</p>');
  assert.equal(sanearHtmlEmail('<a href="https://a.io">x <a href="https://b.io">y</a> z</a>'),
    '<a href="https://a.io" target="_blank" rel="noopener noreferrer">x y z</a>', 'un link adentro de otro pierde la etiqueta');
});

// ── El texto plano de respaldo ──────────────────────────────────────────────────────────────

test('el texto plano: párrafos, listas con viñeta o número, celdas y la dirección de un link', () => {
  assert.equal(textoDeHtmlEmail(DEL_EDITOR[0]), 'Hola Ana, mira esto y lo viejo con código.');
  assert.equal(textoDeHtmlEmail(DEL_EDITOR[1]), 'Tu visita\n\nEl lunes\n\ncentrado');
  assert.equal(textoDeHtmlEmail(DEL_EDITOR[2]), '• uno\n• dos\n\n3. tres');
  assert.equal(textoDeHtmlEmail('<ul><li><p>a</p><ul><li><p>a1</p></li></ul></li></ul>'), '• a\n  • a1');
  assert.equal(textoDeHtmlEmail(DEL_EDITOR[5]), 'la visita (https://valle.mx/visita?a=1&b=2)', 'sin la dirección, un correo de sólo texto no lleva a ningún lado');
  assert.equal(textoDeHtmlEmail('<p><a href="https://valle.mx">https://valle.mx</a></p>'), 'https://valle.mx', 'si el texto ya la dice, no se repite');
  assert.equal(textoDeHtmlEmail(DEL_EDITOR[6]), 'A · B\nc');
  assert.equal(textoDeHtmlEmail('<p>uno<br>dos</p><p>a &amp; b&nbsp;c &lt;d&gt;</p>'), 'uno\ndos\n\na & b c <d>');
  assert.equal(textoDeHtmlEmail('<p>a</p><script>x</script>'), 'a', 'el texto sale del HTML YA saneado');
});

test('vacío es vacío: un párrafo sin nada no es un cuerpo', () => {
  assert.equal(htmlEmailVacio('<p></p>'), true);
  assert.equal(htmlEmailVacio('<p> </p><p><br></p>'), true);
  assert.equal(htmlEmailVacio('<p>x</p>'), false);
  assert.equal(htmlEmailVacio('<p><img src="https://x.io/a.png"></p>'), false, 'una imagen sola tiene algo que ver');
  assert.equal(cuerpoHtmlAGuardar('<p></p>'), null);
  assert.equal(cuerpoHtmlAGuardar(42), null);
  assert.equal(cuerpoHtmlAGuardar('<p onclick="x">a</p>'), '<p>a</p>');
});

// ── Las variables ───────────────────────────────────────────────────────────────────────────

test('las variables, por contexto: escapadas en el texto, codificadas en una URL', () => {
  const html = sanearHtmlEmail('<p>Hola {{lead_nombre}}, <a href="https://valle.mx/v?n={{lead_nombre}}">tu visita</a> {{otra}}</p>');
  const r = aplicarVariablesHtml(html, { lead_nombre: 'Ana "<b>" & Co' });
  assert.equal(r, '<p>Hola Ana &quot;&lt;b&gt;&quot; &amp; Co, <a href="https://valle.mx/v?n=Ana%20%22%3Cb%3E%22%20%26%20Co" target="_blank" rel="noopener noreferrer">tu visita</a> {{otra}}</p>',
    'un nombre no abre una etiqueta ni rompe la URL; lo que el motor no conoce queda crudo, como en un WhatsApp');
  assert.equal(sanearHtmlEmail(r), r, 'después de las variables sigue siendo HTML saneado');
  // El caso que se perdía: el link de un lead con un espacio en el nombre, después del saneo del render.
  const correo = renderEmailHtml({ subject: 's', bodyText: '', bodyHtml: aplicarVariablesHtml(html, { lead_nombre: 'Ana Pérez' }) });
  assert.ok(correo.includes('href="https://valle.mx/v?n=Ana%20P%C3%A9rez"'), 'el link del lead desapareció del correo');
  // Un destino que es SÓLO una variable no pasó el saneo (no tiene esquema), y un valor no cambia el esquema.
  assert.equal(sanearHtmlEmail('<a href="{{link}}">x</a>'), 'x');
  assert.equal(aplicarVariablesHtml('<a href="https://x.io/{{lead_nombre}}">x</a>', { lead_nombre: 'javascript:alert(1)' }),
    '<a href="https://x.io/javascript%3Aalert(1)" target="_blank" rel="noopener noreferrer">x</a>');
});

// ── Lo que guarda un paso ───────────────────────────────────────────────────────────────────

test('el HTML de antes sigue SÓLO si quien guarda no lo manda y no tocó el texto', () => {
  const previo = { cuerpo: 'Hola Ana', cuerpo_html: '<p>Hola <strong>Ana</strong></p>' };
  assert.equal(cuerpoHtmlEntrante({ cuerpo: 'Hola Ana' }, previo), previo.cuerpo_html, 'otra pantalla que no sabe del HTML no le borra el formato');
  assert.equal(cuerpoHtmlEntrante({ cuerpo: 'Hola Ana, ¿vienes?' }, previo), null, 'si cambió el texto, gana el texto');
  assert.equal(cuerpoHtmlEntrante({ cuerpo: 'Hola Ana', cuerpo_html: '' }, previo), '', 'un vacío explícito lo saca');
  assert.equal(cuerpoHtmlEntrante({ cuerpo: 'x', cuerpo_html: '<p>x</p>' }, previo), '<p>x</p>');
  assert.equal(cuerpoHtmlEntrante({ cuerpo: 'Hola Ana' }, null), null);
});

test('un email que no entra no se recorta: se rechaza', () => {
  assert.equal(problemaDeCuerpoHtml('<p>corto</p>'), null);
  assert.equal(problemaDeCuerpoHtml(`<p>${'a'.repeat(TOPE_HTML_EMAIL + 10)}</p>`), 'es un email demasiado largo');
  assert.equal(problemaDeCuerpoHtml('<!-- x -->'.repeat(Math.ceil(TOPE_HTML_EMAIL_ENTRADA / 10) + 1)), 'es un email demasiado largo',
    'el crudo también cuenta: el saneo recorta la entrada');
  assert.equal(problemaDeCuerpoHtml(null), null);
});

// ── El render ───────────────────────────────────────────────────────────────────────────────

test('el render: el HTML reemplaza al texto, con el estilo en línea de un correo', () => {
  const html = renderEmailHtml({ subject: 'Tu visita', bodyText: 'TEXTO DE RESPALDO', bodyHtml: DEL_EDITOR[6] + DEL_EDITOR[2] + DEL_EDITOR[5] });
  assert.ok(!html.includes('TEXTO DE RESPALDO'), 'con HTML, el texto va sólo como parte de texto');
  assert.ok(html.includes('<table style="border-collapse:collapse;width:100%;margin:0 0 16px;">'), 'la tabla sin borde no se distingue del texto');
  assert.ok(html.includes('<td colspan="2" style="border:1px solid #EAECF1;'), 'el atributo propio va antes del estilo');
  assert.match(html, /<li style="margin:0 0 4px;"><p style="margin:0;">uno<\/p><\/li>/, 'adentro de una lista el párrafo no lleva margen');
  assert.match(html, /<a href="https:\/\/valle\.mx\/visita\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer" style="color:#2F6FED;text-decoration:underline;">/);
  // El color que eligió quien escribe le gana al de la plantilla: va DESPUÉS.
  assert.ok(renderEmailHtml({ subject: 's', bodyText: '', bodyHtml: '<p style="text-align:center">x</p>' }).includes('<p style="margin:0 0 16px;text-align:center;">x</p>'));
  // Lo que llega por `bodyHtml` se vuelve a sanear: ningún llamador puede olvidarse.
  assert.ok(!renderEmailHtml({ subject: 's', bodyText: '', bodyHtml: '<p>a</p><script>alert(1)</script>' }).includes('alert(1)'));
});

test('sin HTML, o con un HTML vacío, el email sale como siempre', () => {
  const antes = renderEmailHtml({ subject: 's', bodyText: '*Hola* Ana' });
  assert.equal(renderEmailHtml({ subject: 's', bodyText: '*Hola* Ana', bodyHtml: '' }), antes);
  assert.equal(renderEmailHtml({ subject: 's', bodyText: '*Hola* Ana', bodyHtml: '<p></p>' }), antes, 'un `<p></p>` no puede dejar el correo en blanco');
  assert.ok(antes.includes('<strong>Hola</strong> Ana'));
});

test('una imagen del editor sale con su ancho en %; centrada, como bloque', () => {
  assert.equal(estiloDeCorreo('img', [], [['src', 'https://x.io/a.png'], ['data-ancho', '50'], ['data-alinea', 'centro']]),
    'max-width:100%;height:auto;border:0;width:50%;display:block;margin:0 auto;');
  assert.equal(estiloDeCorreo('p', ['ul', 'li'], []), 'margin:0;');
  assert.equal(estiloDeCorreo('p', [], []), 'margin:0 0 16px;');
});

test('un email de antes abre en el editor con las mismas marcas con que sale', () => {
  assert.equal(htmlDeCuerpoTexto('Hola *Ana*, _mira_ ~esto~\n\nVisita https://valle.mx/v.'),
    '<p>Hola <strong>Ana</strong>, <em>mira</em> <span style="text-decoration:line-through;">esto</span></p><p>Visita <a href="https://valle.mx/v" target="_blank" rel="noopener noreferrer">https://valle.mx/v</a>.</p>');
  assert.equal(htmlDeCuerpoTexto(''), '');
  assert.equal(htmlDeCuerpoTexto('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>', 'el texto de antes se escapaba, y se sigue escapando');
});

// ── El motor (lib/nutricion.ts es server-only: se lee el fuente) ───────────────────────────

test('setSecuenciaPasos guarda el HTML por las funciones de este módulo, y deriva el texto', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  const ini = motor.indexOf('export async function setSecuenciaPasos(');
  const fn = motor.slice(ini, motor.indexOf('\n}\n', ini));
  assert.ok(fn.length > 2000, `no encontré setSecuenciaPasos (${fn.length})`);
  assert.match(fn, /const html = canal === 'email' \? cuerpoHtmlAGuardar\(cuerpoHtmlEntrante\(p, emailsPrevios\.get\(idDe\(flujo, i\)\)\)\) : null;/,
    'sólo un email guarda HTML, saneado, y con el merge del escritor que no lo manda');
  assert.match(fn, /return html \? \{ cuerpo: textoDeHtmlEmail\(html\), cuerpo_html: html \} : \{ cuerpo: typeof p\.cuerpo === 'string' \? p\.cuerpo : '' \};/,
    'el texto de respaldo lo deriva el server del HTML guardado');
  // Y el paso de MENSAJE lo usa (con el canal ya resuelto: un audio nunca es email).
  const limpio = fn.slice(fn.indexOf('const limpio = pasos'), fn.indexOf('const grafo = normalizar(limpio)'));
  assert.match(limpio, /\.\.\.cuerpoDelPaso\(p, flujo, i, comun\.canal\),/);
  assert.doesNotMatch(limpio, /cuerpo: typeof p\.cuerpo === 'string'/, 'el cuerpo de un mensaje lo decide UNA función');
  assert.match(fn, /problemaDeCuerpoHtml\(p\.cuerpo_html\)/, 'un email demasiado largo se rechaza antes de escribir');
  assert.ok(fn.indexOf('problemaDeCuerpoHtml(') < fn.indexOf(".update({ pasos: grafo"), 'el rechazo va antes de la escritura');
  // Una acción no lleva cuerpo HTML.
  assert.match(fn, /if \(a\?\.ok\) return \{ \.\.\.comun, asunto: null, preheader: null, cuerpo: '', template_wa: null, accion: a\.accion \};/);
});

test('el envío de email vuelve a sanear el HTML y le pone las variables escapadas', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  const ini = motor.indexOf("} else if (emailOn && paso.canal === 'email') {");
  const rama = motor.slice(ini, motor.indexOf('await supabase.from(\'nutricion_envios\').insert(', ini));
  assert.ok(rama.length > 500, `no encontré la rama de email (${rama.length})`);
  assert.match(rama, /const html = typeof paso\.cuerpo_html === 'string' && paso\.cuerpo_html \? sanearHtmlEmail\(paso\.cuerpo_html\) : '';/);
  assert.match(rama, /\.\.\.\(html \? \{ bodyHtml: aplicarVariablesHtml\(html, vars\) \} : \{\}\),/, 'sin HTML, el correo de siempre');
  assert.match(rama, /bodyText: cuerpo,/);
  assert.match(rama, /text: cuerpo,/, 'la parte de texto es el texto plano de respaldo');
  assert.doesNotMatch(rama, /aplicarVariables\(paso\.cuerpo_html/, 'las variables sobre el HTML van ESCAPADAS (aplicarVariablesHtml)');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés del scratchpad (C-romper.mjs): UNA rotura por vez, corre este archivo y restaura de memoria.
// Base 16 / 16. 11 roturas, 11 cazadas:
//   R1. `hrefSeguro` sin mirar el esquema                       → 0 la primera vez: el hostname vacío
//       frenaba `javascript:alert(1)` igual. Con `javascript://valle.mx/%0Aalert(1)` (que SÍ tiene
//       host) en los vectores → 1.
//   R2. el texto sin escapar el `<`                             → 1
//   R3. las variables con `aplicarVariables` sobre el HTML       → 1
//   R4. la regex estricta del href de antes (sin espacios)      → 0 la primera vez: con las variables
//       codificadas ya no llega un espacio por ahí. Con el link tipeado con un espacio → 1.
//   R5. `renderEmailHtml` sin volver a sanear `bodyHtml`        → 1
//   R6. el envío con `aplicarVariables(paso.cuerpo_html, …)`    → 1
//   R7. `setSecuenciaPasos` sin el merge (`p.cuerpo_html` solo)  → 1
//   R8. el merge conservando el HTML aunque cambie el texto     → 1
//   R9. el texto plano con un salto después de la viñeta        → 1
//  R10. `svg` fuera de lo que se va con su contenido            → 1
//  R11. un link adentro de otro, escrito                        → 1
// El primer arnés de este archivo encontró además un bug real, no una rotura: las variables se
// ponían sobre el HTML ya armado, y el saneo del render descartaba el link de un lead con un espacio
// en el nombre. De ahí las variables POR CONTEXTO en la pasada del saneo.
