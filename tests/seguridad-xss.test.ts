// =============================================================================
// XSS (auditoría de seguridad del 14/10/2026): la media de WhatsApp y el texto rico del tablero
// =============================================================================
// Dos hallazgos, el mismo modo de falla: algo que escribe OTRO (el remitente de un WhatsApp, un
// closer o un setter por /api/todo) terminaba dibujado como HTML activo en el origen de la app, con
// la sesión de quien lo abría (el super admin, el admin del workspace).
//
//   1. La media. app/api/admin/mako-chats/media y la rama `?media=` de
//      app/api/whatsapp/evolution/mensajes servían los bytes con el `mimetype` que eligió quien mandó
//      el mensaje. Un documento declarado `text/html` se abría en una pestaña de hola-mako.com.
//      Ahora pasa por `cabecerasDeMedia`: lista blanca (imagen raster, audio, video, PDF), lo demás
//      `application/octet-stream` + `attachment`, y siempre `nosniff`. El bloque está DOS veces (un
//      route.ts no exporta nada que no sea de Next): acá se lee de los dos fuentes, se compara, y el
//      de una ruta se COMPILA y se ejecuta, así que lo que se prueba es el código de producción y no
//      una copia escrita en el test.
//   2. El tablero. RichText dibujaba `innerHTML = mdAHtml(valor)` con el valor crudo, y `stripHtml`
//      parseaba en un `div` del documento (que corre el `onerror` de un `<img>` sin montarlo). Ahora
//      se dibuja por `paraDibujar` (lista blanca: `sanearHtmlEmail`), `stripHtml` usa DOMParser, y el
//      server guarda saneado (`sanearDetalle`/`sanearNotas` en lib/todo.ts, también en los mappers de
//      lib/plan-board.ts).
//
// ⚠️ NO HAY DOM EN LOS TESTS DE ESTA CASA (sin jsdom). Lo puro se EJECUTA (`paraDibujar`, `esHtml`,
//    `sanitizeHtml`, y lib/todo.ts en un hijo con `--conditions=react-server`, porque abre con
//    `import 'server-only'`); lo que sólo corre en el navegador (`stripHtml` con DOMParser, el efecto
//    que dibuja, `contenidoDe`) y los call sites del server se leen como TEXTO, sin comentarios y con
//    los saltos de línea normalizados — un guard que lee comentarios encuentra lo que el archivo DICE.
//
// ⚠️ PROBADO ROMPIÉNDOLO (14/10/2026): diecisiete roturas, una por vez, sobre el archivo real,
//    restaurado desde la copia en memoria (hash verificado). Con todo en su lugar: 11 pass / 0 fail.
//    Las diecisiete cayeron; cada una y lo que tumbó está en «LAS ROTURAS», al final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { paraDibujar, esHtml, sanitizeHtml, mdAHtml } from '../app/plan/board/RichText';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(resolve(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: `//` de línea entera o al final de una línea de código, y bloques. */
const vivo = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([;,{}()\]])[ \t]*\/\/.*$/gm, '$1');

/** El pedazo entre `desde` y `hasta` (la primera vez que aparece `hasta` después de `desde`). */
function bloque(src: string, desde: string, hasta: string, quien: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}» en ${quien}: el guard perdió su ancla`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}» en ${quien}`);
  return src.slice(i, j);
}

// ── 1. La media ──────────────────────────────────────────────────────────────────────────────

const RUTA_ADMIN = 'app/api/admin/mako-chats/media/route.ts';
const RUTA_BANDEJA = 'app/api/whatsapp/evolution/mensajes/route.ts';
const NOMBRES_MEDIA = ['MIME_EN_LINEA', 'EXTENSION_DESCARGA', 'cabecerasDeMedia'];

/** El código de `cabecerasDeMedia` y sus dos constantes, sacado del fuente con el parser de TS. */
function codigoDeMedia(ruta: string): string {
  const src = leer(ruta);
  const sf = ts.createSourceFile(ruta, src, ts.ScriptTarget.Latest, true);
  const partes: string[] = [];
  for (const st of sf.statements) {
    const nombre = ts.isFunctionDeclaration(st) ? st.name?.text
      : ts.isVariableStatement(st) ? st.declarationList.declarations.map((d) => d.name.getText(sf)).join(',')
        : undefined;
    if (nombre && NOMBRES_MEDIA.includes(nombre)) partes.push(st.getText(sf));
  }
  assert.equal(partes.length, NOMBRES_MEDIA.length, `${ruta}: no están las tres piezas de la media (${NOMBRES_MEDIA.join(', ')})`);
  return partes.join('\n');
}

type Cabeceras = Record<string, string>;
const cabecerasDeMedia = (() => {
  const js = ts.transpileModule(codigoDeMedia(RUTA_ADMIN), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(`${js}\nreturn cabecerasDeMedia;`)() as (m: unknown, largo: number) => Cabeceras;
})();

test('media: las dos rutas tienen el MISMO bloque de cabeceras (son gemelas)', () => {
  const norm = (s: string) => vivo(s).replace(/\s+/g, ' ').trim();
  assert.equal(norm(codigoDeMedia(RUTA_BANDEJA)), norm(codigoDeMedia(RUTA_ADMIN)),
    'el bloque de la media cambió en UNA de las dos rutas: la otra sigue sirviendo con la regla vieja');
});

test('media: sólo imagen raster, audio, video y PDF salen con su tipo; lo demás sale para DESCARGAR', () => {
  // Lo que el hilo dibuja o el navegador muestra sin correr nada: pasa, sin parámetros.
  for (const [mime, sale] of [
    ['image/jpeg', 'image/jpeg'], ['image/png', 'image/png'], ['image/webp', 'image/webp'], ['IMAGE/GIF', 'image/gif'],
    ['audio/ogg; codecs=opus', 'audio/ogg'], ['audio/mpeg', 'audio/mpeg'], ['video/mp4', 'video/mp4'],
    ['application/pdf', 'application/pdf'],
  ] as const) {
    const c = cabecerasDeMedia(mime, 10);
    assert.equal(c['Content-Type'], sale, `${mime} tendría que salir como ${sale}`);
    assert.equal(c['Content-Disposition'], undefined, `${mime} se dibuja: no lleva attachment`);
    assert.equal(c['X-Content-Type-Options'], 'nosniff');
  }
  // Todo lo que un navegador puede EJECUTAR (o no se sabe qué es) sale como bytes para descargar.
  for (const mime of [
    'text/html', 'TEXT/HTML; charset=utf-8', ' text/html ', 'image/svg+xml', 'IMAGE/SVG+XML', 'application/xhtml+xml',
    'text/xml', 'application/xml', 'text/javascript', 'application/javascript', 'multipart/x-mixed-replace',
    'image/svg+xml; charset=utf-8', 'image/png\r\nSet-Cookie: a=b', 'image/png\nx', '', 'constructor', '__proto__',
    'application/octet-stream', 'text/plain',
  ]) {
    const c = cabecerasDeMedia(mime, 10);
    assert.equal(c['Content-Type'], 'application/octet-stream', `${JSON.stringify(mime)} NO puede salir con su tipo`);
    assert.match(c['Content-Disposition'] ?? '', /^attachment; filename="adjunto(\.[a-z]+)?"$/, `${JSON.stringify(mime)} sale para descargar`);
    assert.equal(c['X-Content-Type-Options'], 'nosniff');
  }
  for (const vacio of [undefined, null, 42, {}]) {
    assert.equal(cabecerasDeMedia(vacio, 0)['Content-Type'], 'application/octet-stream', `${String(vacio)} → octet-stream`);
  }
  // Un documento conocido se descarga con SU extensión (si no, la computadora no sabe con qué abrirlo).
  assert.equal(cabecerasDeMedia('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1)['Content-Disposition'], 'attachment; filename="adjunto.docx"');
  assert.equal(cabecerasDeMedia('text/html', 1)['Content-Disposition'], 'attachment; filename="adjunto"', 'un HTML no se descarga como .html');
  assert.equal(cabecerasDeMedia('__proto__', 1)['Content-Disposition'], 'attachment; filename="adjunto"');
  assert.equal(cabecerasDeMedia('image/png', 1234)['Content-Length'], '1234');
});

test('media: las dos rutas responden con `cabecerasDeMedia`, nunca con el mimetype del remitente', () => {
  const admin = vivo(leer(RUTA_ADMIN));
  assert.match(admin, /return new Response\(bytes, \{ headers: cabecerasDeMedia\(media\.mimetype, bytes\.length\) \}\);/,
    'la ruta del admin no sirve por `cabecerasDeMedia`');
  assert.doesNotMatch(admin, /'Content-Type':\s*media\./, 'la ruta del admin volvió a copiar el mimetype a la cabecera');
  assert.equal((admin.match(/new Response\(bytes/g) ?? []).length, 1, 'hay otra respuesta con los bytes en la ruta del admin');

  const bandeja = vivo(leer(RUTA_BANDEJA));
  const rama = bloque(bandeja, 'if (media) {', 'if (avatar) {', RUTA_BANDEJA);
  assert.match(rama, /return new Response\(bytes, \{ headers: cabecerasDeMedia\(r\.mimetype, bytes\.length\) \}\);/,
    'la rama `?media=` de la bandeja no sirve por `cabecerasDeMedia`');
  assert.doesNotMatch(rama, /Content-Type/, 'la rama `?media=` arma su propio Content-Type');
  assert.doesNotMatch(rama, /r\.mimetype\s*\|\|/, 'la rama `?media=` volvió a usar el mimetype del remitente');
});

// ── 2. El tablero: lo que se dibuja ──────────────────────────────────────────────────────────

/** Ataques clásicos. Cada uno, dibujado, no puede dejar NADA que corra. */
const ATAQUES = [
  // El del hallazgo, tal cual: un `<b>` para que cuente como HTML más el manejador.
  '<b>x</b><img src=x onerror=alert(1)>',
  '<div>hola</div><img src=x onerror="alert(document.cookie)">',
  '<div><a href="javascript:alert(1)">clic</a></div>',
  '<div><a href="java&#09;script:alert(1)">clic</a></div>',
  '<div><a href="JaVaScRiPt:alert(1)">clic</a></div>',
  '<div><a href=" javascript:alert(1)">clic</a></div>',
  '<div><a href="data:text/html,<script>alert(1)</script>">clic</a></div>',
  '<b>x</b><svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  '<b>x</b><svg onload=alert(1)></svg>',
  '<b>x</b><iframe src="javascript:alert(1)"></iframe>',
  '<b>x</b><iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<b>x</b><script>alert(1)</script>',
  '<b>x</b><style>@import url(https://evil.example/x.css)</style>',
  '<b>x</b><object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">',
  '<b>x</b><math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<b>x</b><form action="https://evil.example"><input name=a><button>ir</button></form>',
  '<div style="background:url(javascript:alert(1))">x</div><b>y</b>',
  '<span style="color:expression(alert(1))">x</span><b>y</b>',
  '<b onmouseover=alert(1)>x</b>',
  '<b>x</b><img src=x onerror=alert(1)//',
  '<b>x</b><base href="https://evil.example/">',
  '<b>x</b><meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<b>x</b><img src="http://evil.example/pixel.gif">',
  '<b>x</b><a href="https://ok.example" onclick="alert(1)">link</a>',
  '<b>x</b><details open ontoggle=alert(1)>',
  '<b>x</b><video><source onerror=alert(1)></video>',
];

/** Lo que NO puede quedar en un HTML dibujado. */
function asegurarInerte(html: string, origen: string) {
  assert.doesNotMatch(html, /<[^>]*\son[a-z]+\s*=/i, `${origen}: quedó un manejador on…=\n${html}`);
  assert.doesNotMatch(html, /<(script|style|svg|math|iframe|object|embed|form|input|button|base|meta|link|template|details|video|audio|source)\b/i, `${origen}: quedó una etiqueta activa\n${html}`);
  assert.doesNotMatch(html, /(href|src|action|data)\s*=\s*"?\s*(javascript|data|vbscript):/i, `${origen}: quedó un esquema ejecutable\n${html}`);
  assert.doesNotMatch(html, /\sstyle="[^"]*(url\(|expression\()/i, `${origen}: quedó un estilo activo\n${html}`);
  assert.doesNotMatch(html, /<img\b(?![^>]*\ssrc="https:)/i, `${origen}: quedó una imagen que no es https\n${html}`);
}

test('tablero: lo que se DIBUJA pasa por la lista blanca (el ataque del hallazgo y los clásicos)', () => {
  for (const a of ATAQUES) {
    asegurarInerte(paraDibujar(a), `paraDibujar(${JSON.stringify(a)})`);
    // NotasLista dibuja `sanitizeHtml(mdAHtml(texto))`: la misma cuenta, por el export que usa.
    asegurarInerte(sanitizeHtml(mdAHtml(a)), `sanitizeHtml(mdAHtml(${JSON.stringify(a)}))`);
  }
  // El del hallazgo, exacto: queda la negrita, se va la imagen.
  assert.equal(paraDibujar('<b>x</b><img src=x onerror=alert(1)>'), '<strong>x</strong>');
  // Un texto SIN etiquetas de formato no es HTML: se dibuja ESCAPADO, como texto.
  assert.equal(paraDibujar('texto <img src=x onerror=alert(1)> sin formato'), '<div>texto &lt;img src=x onerror=alert(1)&gt; sin formato</div>');
});

/** Lo que escriben de verdad el editor (Chrome) y MaKo. */
const HTML_EDITOR = [
  '<div>Primera línea</div><div>Segunda línea</div>',
  '<div><b>Por qué</b></div><div>Porque sí &amp; porque no</div><div><br></div><ul><li>uno</li><li>dos</li></ul>',
  '<h3>Listo cuando</h3><div><u>subrayado</u> y <i>itálica</i></div>',
  'primer renglón sin div<div>segundo</div>',
  '<div>it`s</div><div>use `x` acá</div>',
  '<div><span style="color: rgb(220, 38, 38);">rojo</span> y <a href="https://hola-mako.com/plan">un link</a></div>',
];
const MARKDOWN = [
  '**Qué pidió**\n- uno\n- dos\n\nY después & antes < 3 > 1.',
  'Detalle técnico: `archivo.ts:12` y `style={{`',
  '1.158 `<button>` sueltos; reemplazar `<div>` por `<section>` y `<a href>` por `<Link>`',
  '**Por qué**\nporque `<textarea>` no cierra',
];
/** HTML del editor con markdown de MaKo pegado atrás (`fusionarDetalle`: `${viejo}\n\n${nuevo}`). */
const MEZCLA = [
  '<div><b>Qué es</b></div><div>lo del dueño</div>\n\n**Evidencia**\n- usar `<button>` nativo y no `<div onclick>`\n- y nada más',
];

test('tablero: la forma del editor y del markdown sobrevive al saneo (renglones, negritas, listas, títulos)', () => {
  // Los renglones del editor son `<div>`: la otra lista blanca de la casa (lib/html-seguro.ts) los
  // juntaba en uno solo (medido: «Primera líneaSegunda línea»). Ésta no.
  assert.equal(paraDibujar(HTML_EDITOR[0]), '<div>Primera línea</div><div>Segunda línea</div>');
  assert.equal(paraDibujar(HTML_EDITOR[1]), '<div><strong>Por qué</strong></div><div>Porque sí &amp; porque no</div><div><br></div><ul><li>uno</li><li>dos</li></ul>');
  assert.equal(paraDibujar(HTML_EDITOR[2]), '<h3>Listo cuando</h3><div><u>subrayado</u> y <em>itálica</em></div>');
  assert.equal(paraDibujar(HTML_EDITOR[4]), '<div>it`s</div><div>use `x` acá</div>', 'una comilla suelta no puede cruzar de un renglón al otro');
  assert.match(paraDibujar(HTML_EDITOR[5]), /<span style="color:rgb\(220,38,38\);">rojo<\/span>/);
  assert.match(paraDibujar(HTML_EDITOR[5]), /<a href="https:\/\/hola-mako\.com\/plan" target="_blank" rel="noopener noreferrer">un link<\/a>/);
  // El markdown: lo que arma `mdAHtml` ya es seguro, y el saneo no le cambia ni un carácter.
  for (const md of MARKDOWN) {
    assert.equal(esHtml(md), false, `es markdown: ${md}`);
    assert.equal(paraDibujar(md), mdAHtml(md), `el saneo tocó el markdown convertido: ${md}`);
  }
  // Idempotente: lo dibujado, vuelto a dibujar, es lo mismo (si no, cada vuelta «cambiaría» algo).
  for (const x of [...HTML_EDITOR, ...MARKDOWN, ...MEZCLA, ...ATAQUES]) {
    const d = paraDibujar(x);
    assert.equal(paraDibujar(d), d, `no es idempotente: ${x}`);
  }
});

test('tablero: una etiqueta CITADA entre comillas invertidas no se lleva el resto del texto', () => {
  // Medido antes de `CODIGO`: `<div>1.158 `<button>` sueltos y el resto</div>` → `<div>1.158 `</div>`.
  assert.equal(paraDibujar('<div>1.158 `<button>` sueltos y el resto</div>'), '<div>1.158 `&lt;button&gt;` sueltos y el resto</div>');
  const mezcla = paraDibujar(MEZCLA[0]);
  assert.match(mezcla, /y nada más/, 'el texto después del `<button>` citado se perdió');
  assert.match(mezcla, /`&lt;div onclick&gt;`/, 'lo citado tiene que quedar como TEXTO');
  asegurarInerte(mezcla, 'la mezcla');
  // Y lo citado no cuenta para decidir si es HTML: un detalle de MaKo que HABLA de etiquetas se
  // convierte como markdown (antes se tomaba por HTML y se veían los `**` crudos).
  assert.equal(esHtml('usar `<div>` y no `<button>`'), false);
  assert.equal(esHtml('usar <div> suelto'), true, 'sin comillas sigue contando como HTML (igual que antes)');
});

test('tablero: RichText dibuja por `paraDibujar`, guarda por `contenidoDe`, y `stripHtml` no usa un div del documento', () => {
  const rt = vivo(leer('app/plan/board/RichText.tsx'));
  // El saneo es la lista blanca, no la regex vieja.
  const san = bloque(rt, 'export function sanitizeHtml(', '\n}', 'RichText.tsx');
  assert.match(san, /return sanearHtmlEmail\(citadoComoTexto\(html\)\);/, '`sanitizeHtml` dejó de ser la lista blanca');
  assert.doesNotMatch(san, /\.replace\(/, '`sanitizeHtml` volvió a ser una lista negra por regex');
  // Lo que se dibuja: el efecto pinta `paraDibujar(value)` y nunca el valor crudo.
  const efecto = bloque(rt, 'useEffect(() => {\n    const ed = ref.current;', '}, [value, focused]);', 'RichText.tsx');
  assert.match(efecto, /const html = paraDibujar\(value\);\s*if \(ed\.innerHTML !== html\) ed\.innerHTML = html;/, 'el efecto no dibuja por `paraDibujar`');
  assert.match(efecto, /dibujado\.current = contenidoDe\(ed\);/, 'el efecto no anota lo dibujado (sin eso, abrir y cerrar guarda)');
  assert.equal((rt.match(/\.innerHTML\s*=(?!=)/g) ?? []).length, 1, 'hay otra asignación a innerHTML en RichText');
  assert.match(rt, /export const paraDibujar = \(valor: string\): string => sanitizeHtml\(mdAHtml\(valor \|\| ''\)\);/);
  // Lo que se guarda desde la pantalla: inerte, sin la decoración del plegado, por la lista blanca.
  const cont = bloque(rt, 'function contenidoDe(', '\n}', 'RichText.tsx');
  assert.match(cont, /new DOMParser\(\)\.parseFromString\(ed\.innerHTML, 'text\/html'\)/, '`contenidoDe` no lee en un documento inerte');
  assert.match(cont, /querySelectorAll\('\[contenteditable="false"\]'\)\.forEach\(\(n\) => n\.remove\(\)\)/, '`contenidoDe` no saca la decoración (el «Resumen» se guardaría)');
  assert.match(cont, /sanitizeHtml\(doc\.body\.innerHTML\)/);
  const commit = bloque(rt, 'const commit = () => {', '\n  };', 'RichText.tsx');
  assert.match(commit, /const html = contenidoDe\(ed\);/);
  assert.match(commit, /if \(html === dibujado\.current\) return;/, 'sin la vara de lo dibujado, abrir y cerrar escribe una edición fantasma');
  // `stripHtml`: un documento de DOMParser, nunca un elemento del documento activo.
  const strip = bloque(rt, 'export function stripHtml(', '\n}', 'RichText.tsx');
  assert.doesNotMatch(strip, /document\.createElement/, '`stripHtml` volvió a parsear en un elemento del documento (corre el onerror)');
  assert.doesNotMatch(strip, /\.innerHTML\s*=/, '`stripHtml` volvió a asignar innerHTML');
  assert.match(strip, /new DOMParser\(\)\.parseFromString\(html, 'text\/html'\)/);
  assert.doesNotMatch(rt, /document\.createElement\(/, 'RichText vuelve a crear elementos en el documento activo');
});

// ── 3. El tablero: lo que se guarda (lib/todo.ts y lib/plan-board.ts) ────────────────────────

type SalidaServer = {
  detalle: Record<string, string>;
  esHtml: Record<string, boolean>;
  doble: Record<string, string>;
  notas: Record<string, string>;
};

const NOTAS = {
  ataque: JSON.stringify([{ id: 'n1', ts: 1, texto: '<b>x</b><img src=x onerror=alert(1)>', extra: 'queda' }, { id: 'n2', ts: 2, texto: 'limpia' }]),
  limpia: JSON.stringify([{ id: 'n1', ts: 1, texto: '<div><strong>ok</strong></div>' }, { id: 'n2', ts: 2, texto: 'a & b' }]).replace('[', '[ '),
  vieja: '<b>nota vieja</b><img src=x onerror=alert(1)>',
  viejaTexto: 'nota vieja sin formato & con <3',
  rota: '[ no es json <b>x</b><img src=x onerror=alert(1)>',
  noTexto: JSON.stringify([{ id: 'n1', ts: 1, texto: ['<b>x</b><img src=x onerror=alert(1)>'] }]),
  sueltas: JSON.stringify(['<b>x</b><img src=x onerror=alert(1)>']),
};
const FLIP = '<a href="javascript:alert(1)">a & b</a>';

/** lib/todo.ts abre con `import 'server-only'`: se ejecuta en un HIJO con la condición `react-server`
 *  (el molde de tests/html-seguro.test.ts), UNA vez para todo el corpus. */
let salidaServer: SalidaServer | undefined;
function correrServer(): SalidaServer {
  salidaServer ??= correrHijo();
  return salidaServer;
}
function correrHijo(): SalidaServer {
  const corpus = [...ATAQUES, ...HTML_EDITOR, ...MARKDOWN, ...MEZCLA, FLIP];
  const todo = JSON.stringify(resolve(RAIZ, 'lib/todo.ts'));
  const codigo = `
    import { pathToFileURL } from 'node:url';
    import { readFileSync } from 'node:fs';
    const { sanearDetalle, sanearNotas, esHtmlDetalle } = await import(pathToFileURL(${todo}).href);
    const { corpus, notas } = JSON.parse(readFileSync(0, 'utf8'));
    const detalle = {}, esHtml = {}, doble = {}, salNotas = {};
    for (const x of corpus) { detalle[x] = sanearDetalle(x); esHtml[x] = esHtmlDetalle(x); doble[x] = sanearDetalle(sanearDetalle(x)); }
    for (const [k, v] of Object.entries(notas)) salNotas[k] = sanearNotas(v);
    console.log(JSON.stringify({ detalle, esHtml, doble, notas: salNotas }));
  `;
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, input: JSON.stringify({ corpus, notas: NOTAS }), stdio: ['pipe', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  return JSON.parse(linea) as SalidaServer;
}

test('server: el detalle se GUARDA saneado si es HTML, y el markdown de MaKo queda intacto', { timeout: 180_000 }, () => {
  const s = correrServer();
  // Los dos lados dicen lo mismo de qué es HTML: si no, el server guardaría como HTML saneado lo que
  // la pantalla dibuja escapado como markdown (o al revés).
  for (const x of Object.keys(s.esHtml)) assert.equal(s.esHtml[x], esHtml(x), `RichText y lib/todo.ts no coinciden en si es HTML: ${x}`);
  // Los ataques: guardados, ya no traen nada que corra. Los que no tienen etiquetas de formato se
  // guardan como están, y es seguro porque se dibujan ESCAPADOS.
  for (const a of ATAQUES) {
    if (esHtml(a)) asegurarInerte(s.detalle[a], `sanearDetalle(${JSON.stringify(a)})`);
    else assert.equal(s.detalle[a], a);
  }
  assert.equal(s.detalle['<b>x</b><img src=x onerror=alert(1)>'], '<strong>x</strong>');
  // El markdown, byte a byte: un `&` guardado como `&amp;` se vería «&amp;» en la pantalla.
  for (const md of MARKDOWN) assert.equal(s.detalle[md], md, `el saneo al guardar tocó el markdown: ${md}`);
  // Guardar no cambia lo que se VE (lo guardado, dibujado, es lo mismo que lo dibujado sin guardar)…
  for (const x of [...HTML_EDITOR, ...MARKDOWN, ...MEZCLA]) {
    assert.equal(paraDibujar(s.detalle[x]), paraDibujar(x), `guardar cambió lo que se ve: ${x}`);
  }
  // …y guardar dos veces es guardar una.
  for (const x of Object.keys(s.doble)) assert.equal(s.doble[x], s.detalle[x], `sanearDetalle no es idempotente: ${x}`);
  // Si el saneo se lleva TODAS las etiquetas de formato, lo que queda sigue siendo HTML (un `<div>`):
  // sin eso se leería como markdown y el `&amp;` se escaparía otra vez («&amp;amp;» en pantalla).
  assert.equal(s.detalle[FLIP], '<div>a &amp; b</div>');
  assert.equal(paraDibujar(s.detalle[FLIP]), '<div>a &amp; b</div>');
});

test('server: las notas se GUARDAN saneadas, nota por nota, y una lista limpia vuelve byte a byte', { timeout: 180_000 }, () => {
  const s = correrServer();
  const ataque = JSON.parse(s.notas.ataque) as Array<Record<string, unknown>>;
  assert.equal(ataque[0].texto, '<strong>x</strong>', 'la nota con el ataque no se saneó');
  assert.equal(ataque[0].extra, 'queda', 'lo demás de la nota tiene que viajar intacto');
  assert.deepEqual(ataque[1], { id: 'n2', ts: 2, texto: 'limpia' });
  assert.equal(s.notas.limpia, NOTAS.limpia, 'una lista sin nada que sanear se reescribió');
  assert.equal(s.notas.vieja, '<strong>nota vieja</strong>', 'la nota vieja (texto suelto) no se saneó');
  assert.equal(s.notas.viejaTexto, NOTAS.viejaTexto);
  asegurarInerte(s.notas.rota, 'un «[» que no es JSON');
  assert.equal(JSON.parse(s.notas.noTexto)[0].texto, '<strong>x</strong>', 'un `texto` que no es string también se dibuja (String(...)) y se sanea');
  assert.deepEqual(JSON.parse(s.notas.sueltas), ['<strong>x</strong>']);
});

test('server: TODAS las escrituras del detalle y las notas pasan por el saneo (lib/todo.ts y lib/plan-board.ts)', () => {
  const todo = vivo(leer('lib/todo.ts'));
  const crear = bloque(todo, 'export async function crearTarea(', '\n}', 'lib/todo.ts');
  assert.match(crear, /detalle: typeof input\.detalle === 'string' \? sanearDetalle\(input\.detalle\)/, 'crearTarea guarda el detalle sin sanear');
  const lote = bloque(todo, 'export async function crearTareasDesde(', '\n}', 'lib/todo.ts');
  assert.match(lote, /detalle: typeof it\.detalle === 'string' \? sanearDetalle\(it\.detalle\)/, 'crearTareasDesde guarda el detalle sin sanear');
  const editar = bloque(todo, 'export async function editarTarea(', '\n}', 'lib/todo.ts');
  assert.match(editar, /upd\.detalle = typeof patch\.detalle === 'string' \? sanearDetalle\(patch\.detalle\) : patch\.detalle;/, 'editarTarea guarda el detalle sin sanear');
  assert.match(editar, /upd\.notas = sanearNotas\(String\(patch\.notas \?\? ''\)\)\.slice\(0, 6000\);/, 'editarTarea guarda las notas sin sanear');
  const crearCat = bloque(todo, 'export async function crearCategoria(', '\n}', 'lib/todo.ts');
  assert.match(crearCat, /detalle: typeof detalle === 'string' \? sanearDetalle\(detalle\)/, 'crearCategoria guarda el detalle sin sanear');
  const editarCat = bloque(todo, 'export async function editarCategoria(', '\n}', 'lib/todo.ts');
  assert.match(editarCat, /upd\.detalle = typeof patch\.detalle === 'string' \? sanearDetalle\(patch\.detalle\) : patch\.detalle;/, 'editarCategoria guarda el detalle sin sanear');
  assert.match(editarCat, /upd\.notas = sanearNotas\(String\(patch\.notas \?\? ''\)\)\.slice\(0, 6000\);/, 'editarCategoria guarda las notas sin sanear');
  // Ningún `detalle`/`notas` crudo quedó en una escritura.
  assert.doesNotMatch(todo, /upd\.detalle = patch\.detalle;/);
  assert.doesNotMatch(todo, /upd\.notas = String\(patch\.notas/);

  const board = vivo(leer('lib/plan-board.ts'));
  assert.match(board, /import \{ sanearDetalle, sanearNotas \} from '@\/lib\/todo';/);
  const t2r = bloque(board, 'function taskToRow(', '\n}', 'lib/plan-board.ts');
  assert.match(t2r, /detalle: sanearDetalle\(t\.detalle \|\| ''\)/, 'taskToRow guarda el detalle sin sanear');
  assert.match(t2r, /notas: sanearNotas\(t\.notas \?\? ''\)/, 'taskToRow guarda las notas sin sanear');
  const l2r = bloque(board, 'function labelToRow(', '\n}', 'lib/plan-board.ts');
  assert.match(l2r, /detalle: sanearDetalle\(l\.detalle \|\| ''\)/, 'labelToRow guarda el detalle sin sanear');
  assert.match(l2r, /notas: sanearNotas\(l\.notas \?\? ''\)/, 'labelToRow guarda las notas sin sanear');
});

test('server y pantalla usan la MISMA regla de «esto es HTML» (las dos regex son gemelas)', () => {
  const rt = vivo(leer('app/plan/board/RichText.tsx'));
  const todo = vivo(leer('lib/todo.ts'));
  const re = (src: string, nombre: string, quien: string) => {
    const m = new RegExp(`const ${nombre} = (/.+/[gimsuy]*);`).exec(src);
    assert.ok(m, `no encontré ${nombre} en ${quien}`);
    return m[1];
  };
  assert.equal(re(todo, 'ES_HTML_DETALLE', 'lib/todo.ts'), re(rt, 'ES_HTML', 'RichText.tsx'), '`ES_HTML` cambió de un solo lado');
  assert.equal(re(todo, 'CODIGO_CITADO', 'lib/todo.ts'), re(rt, 'CODIGO', 'RichText.tsx'), '`CODIGO` cambió de un solo lado');
});

// =============================================================================
// LAS ROTURAS (14/10/2026). Base: 11 pass / 0 fail. Cada una, hecha sobre el archivo real,
// corrida con `node --import tsx --test tests/seguridad-xss.test.ts` y restaurada de memoria:
//
//  #  Qué se rompió                                                        Resultado  Qué cayó
//  1  admin: `'Content-Type': media.mimetype` de vuelta                    10 / 1     «responden con cabecerasDeMedia»
//  2  bandeja: `text/html` en MIME_EN_LINEA (sólo ahí)                     10 / 1     «el MISMO bloque» (las gemelas)
//  3  admin: `text/html` e `image/svg+xml` en MIME_EN_LINEA                9 / 2      gemelas + «sólo imagen raster…»
//  4  admin: sin `nosniff`                                                 9 / 2      gemelas + «sólo imagen raster…»
//  5  bandeja: la rama `?media=` con `r.mimetype ||` de vuelta             10 / 1     «responden con cabecerasDeMedia»
//  6  `sanitizeHtml` = identidad                                           6 / 5      lo dibujado, la forma, lo citado, el fuente de RichText, el server
//  7  el efecto dibuja `mdAHtml(value)` crudo                              10 / 1     el fuente de RichText
//  8  `stripHtml` vuelve a `document.createElement('div')`                10 / 1     el fuente de RichText
//  9  sin escapar lo citado en la pantalla (`citadoComoTexto` = identidad)  9 / 2      «una etiqueta CITADA» + el server (guardar cambiaba lo que se ve)
// 10  `contenidoDe` sin sacar lo `contenteditable="false"`                 10 / 1     el fuente de RichText
// 11  `commit` sin `html === dibujado.current`                             10 / 1     el fuente de RichText
// 12  `editarTarea`: `upd.detalle = patch.detalle;`                        10 / 1     «TODAS las escrituras»
// 13  `sanearDetalle` sanea todo, sin mirar si es HTML                     9 / 2      el markdown intacto + las notas (una nota de texto se reescribía)
// 14  `sanearDetalle` sin el `<div>` cuando se va todo el formato          10 / 1     el server (FLIP: «&amp;amp;» en pantalla)
// 15  `taskToRow`: `detalle: t.detalle || ''`                              10 / 1     «TODAS las escrituras»
// 16  `sanearNotas` devuelve el campo crudo                                10 / 1     las notas
// 17  `ES_HTML_DETALLE` del server sin `a`                                 9 / 2      el server (no coinciden en si es HTML) + las gemelas
//
// ⚠️ Lo que sólo corre en el navegador (7, 8, 10, 11) lo ve SÓLO el test que lee el fuente: no hay
//    DOM acá. Si alguien reescribe esas funciones con otra forma, ese test se pone rojo aunque la
//    regla siga en pie: hay que actualizar el ancla, no borrar la guarda.
// =============================================================================
