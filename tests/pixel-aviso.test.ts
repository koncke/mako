// =============================================================================
// El aviso fijo «Actualiza el Pixel» (pedido de Martín, 06/10/2026)
// =============================================================================
// «dentro de MaKo que siempre aparezca una notificación que no se pueda cerrar,
// pero que sea sutil, como lo tenemos en el CRM de "Revisar"». Lo que se cuida:
//   · que NO le salga a quien nunca pegó el Pixel (sin fila de versión);
//   · que el umbral no sea SNIPPET_VERSION (un aviso que no se cierra y se prende
//     con cada mejora del código es un aviso que se aprende a no leer);
//   · que no caiga al workspace 1, que es un cliente;
//   · que no se pueda cerrar y que lleve al lugar exacto;
//   · que comparta la esquina con «A revisar» sin pisarse;
//   · que el link funcione estando ya en /integraciones.
//
// Probado rompiéndolo el 06/10/2026 (con todo puesto: 7 pasan / 0 fallan):
//   · pixelParaActualizar devuelve viejo:true sin fila         -> 6 / 1
//   · PIXEL_MINIMO_AVISO = SNIPPET_VERSION (importado)         -> 0 / 1 (el archivo
//     ni carga: landing-token trae server-only, y el guard del fuente cae igual)
//   · la ruta cae a OWNER_WS con ws null                        -> 6 / 1
//   · el componente gana un botón «Cerrar»                      -> 6 / 1
//   · el layout monta los dos avisos FUERA del contenedor       -> 6 / 1
//   · MakoConfirmGate vuelve a `position: 'fixed'`              -> 6 / 1
//   · se saca el rearme de la ref en IntegracionesBoard         -> 6 / 1
// (el de la esquina que no tapa se agregó después y lleva su rotura adentro)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PIXEL_MINIMO_AVISO, pixelParaActualizar, RUTA_PIXEL,
  clavePagina, versionEnHtml, anotarVersionDePagina, veredictoPixel, paraMirar, parsearMapaVersiones,
} from '../lib/pixel-aviso';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('sin fila de versión NO hay aviso: el negocio nunca pegó el Pixel', () => {
  // Medido el 06/10/2026: los ws 9, 10, 15 y 17 tienen token, ninguna versión y cero visitas.
  assert.deepEqual(pixelParaActualizar(null), { viejo: false, instalada: null });
  assert.deepEqual(pixelParaActualizar(undefined), { viejo: false, instalada: null });
  assert.deepEqual(pixelParaActualizar(''), { viejo: false, instalada: null });
  assert.deepEqual(pixelParaActualizar('x'), { viejo: false, instalada: null });
  assert.deepEqual(pixelParaActualizar('0'), { viejo: false, instalada: null });
  // Los casos medidos: la 18 (ws 11 y 13), la 15 (ws 14), la 21 con Clarity adentro (ws1).
  assert.deepEqual(pixelParaActualizar('18'), { viejo: true, instalada: 18 });
  assert.deepEqual(pixelParaActualizar('15'), { viejo: true, instalada: 15 });
  assert.deepEqual(pixelParaActualizar('21'), { viejo: true, instalada: 21 });
  assert.deepEqual(pixelParaActualizar(String(PIXEL_MINIMO_AVISO)), { viejo: false, instalada: PIXEL_MINIMO_AVISO });
});

test('el umbral es una constante PROPIA, no SNIPPET_VERSION', () => {
  const src = sinComentarios(leer('lib/pixel-aviso.ts'));
  assert.match(src, /export const PIXEL_MINIMO_AVISO = \d+;/, 'el umbral se escribe a mano, como número');
  assert.doesNotMatch(src, /SNIPPET_VERSION/, 'atado a SNIPPET_VERSION, el aviso que no se cierra se prende con cada mejora del código');
});

test('la ruta NO cae al workspace 1 y no sale sin workspace', () => {
  const src = sinComentarios(leer('app/api/integraciones/landing/version/route.ts'));
  assert.doesNotMatch(src, /OWNER_WS/, 'el ws1 es un cliente: el super admin sin ?ws= vería el aviso del Pixel de Mauricio');
  assert.match(src, /if \(ws == null\) return NO\(\);/, 'sin workspace resuelto no hay aviso');
  assert.match(src, /tabEnCapa\('integraciones'/, 'sólo para la capa que tiene la pestaña donde se arregla');
});

test('el aviso no se puede cerrar y lleva al modal del Pixel', () => {
  const src = sinComentarios(leer('app/_components/AvisoPixelViejo.tsx'));
  assert.doesNotMatch(src, /onClose|Cerrar|Después|✕|×/, 'no se cierra: se apaga sola cuando la página manda la versión nueva');
  assert.match(src, /href=\{RUTA_PIXEL\}/, 'el destino sale de la constante, no de un literal suelto');
  assert.equal(RUTA_PIXEL, '/integraciones?abrir=landing');
});

test('la esquina es UN contenedor y los dos avisos van adentro', () => {
  const src = sinComentarios(leer('app/layout.tsx'));
  const i = src.indexOf('<EsquinaAvisos>');
  const f = src.indexOf('</EsquinaAvisos>', i);
  assert.ok(i > 0 && f > i, 'el layout no monta el contenedor de la esquina');
  const adentro = src.slice(i, f);
  assert.match(adentro, /<AvisoPixelViejo \/>/);
  assert.match(adentro, /<MakoConfirmGate \/>/);
  assert.equal((src.match(/<MakoConfirmGate \/>/g) ?? []).length, 1, 'una sola «A revisar», y adentro de la esquina');
});

test('«A revisar» ya no es fixed: la posición la pone la esquina', () => {
  const src = sinComentarios(leer('app/_components/MakoConfirmGate.tsx'));
  const i = src.indexOf('const marco');
  assert.ok(i > 0);
  const marco = src.slice(i, src.indexOf('};', i));
  assert.ok(marco.length < 600, `el recorte quedó en ${marco.length}: está mirando otra cosa`);
  assert.doesNotMatch(marco, /position: 'fixed'/, 'dos piezas fijas en la misma esquina se pisan');
});

test('estando ya en /integraciones, el link vuelve a abrir el modal', () => {
  const src = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.match(src, /if \(!abrir\) \{ yaAbierto\.current = false; return; \}/, 'sin rearmar la ref, un segundo ?abrir=landing no abre nada');
});

test('⚠️ la esquina NO tapa el «Publicar» del lienzo ni el «Enviar» de un chat, y va debajo de los modales', () => {
  // La revisión del 06/10/2026 lo midió en Chrome: en /automations el lienzo llega al borde de
  // la ventana y su «Publicar» vive a 12 px del rincón; la pastilla, que no se cierra, le
  // caía encima (un clic en «Publicar» abría /integraciones). Y con z 65 quedaba encima de
  // cinco modales de z 60. Medido con la marca puesta: la pastilla sube a 64 px y el centro
  // de «Publicar» vuelve a ser «Publicar».
  //
  // PROBADO ROMPIÉNDOLO, de a una: el contenedor con `bottom: 20` fijo, con `zIndex: 65`,
  // sin la regla de globals.css, el lienzo sin la marca y el chat sin la marca → las cinco
  // dan 7 pasan / 1 falla (este test).
  const esq = sinComentarios(leer('app/_components/EsquinaAvisos.tsx'));
  assert.match(esq, /bottom: 'var\(--esquina-abajo, 20px\)'/, 'la esquina dejó de poder subir');
  const z = Number(esq.match(/zIndex: (\d+)/)?.[1]);
  assert.ok(z > 0 && z < 60, `la esquina tiene z ${z}: queda encima de los modales de z 60`);
  assert.match(leer('app/globals.css'), /:root:has\(\[data-esquina-ocupada\]\) \{ --esquina-abajo: \d+px; \}/,
    'nadie hace subir la esquina');
  assert.match(sinComentarios(leer('app/_components/Lienzo.tsx')), /accion && <div data-no-pan data-esquina-ocupada/,
    'el «Publicar» del lienzo no se declara: la pastilla le cae encima');
  assert.match(sinComentarios(leer('app/whatsapp/_shared/ChatHilo.tsx')), /data-esquina-ocupada=\{puedeComponer/,
    'el «Enviar» de un chat no se declara: la pastilla le cae encima');
});

// ── «Ya publiqué y sigue apareciendo»: la versión POR PÁGINA, y lo que SIRVE la página ──

const snip = (sv: number | null) =>
  `<script>(function () {\n  var ENDPOINT = 'https://hola-mako.com/api/track/vsl';\n${sv == null ? '' : `  var SV = ${sv};\n`}})();</script>`;

test('⚠️ la versión que SIRVE la página se lee del HTML, y si hay dos copias gana la vieja', () => {
  // Medido el 06/10/2026: la portada del ws1 ya servía `var SV = 22;` y MaKo seguía
  // diciendo 21, porque sólo se enteraba por las visitas.
  //
  // PROBADO ROMPIÉNDOLO: con `Math.max` en vez de `Math.min` → 1 falla (éste).
  assert.equal(versionEnHtml(`<html>${snip(22)}</html>`), 22);
  // Pegar el nuevo sin sacar el viejo deja los dos corriendo: eso no es «al día».
  assert.equal(versionEnHtml(`${snip(21)}${snip(22)}`), 21);
  // Con nuestro endpoint y sin versión es un código anterior al versionado.
  assert.equal(versionEnHtml(snip(null)), 1);
  // Sin nuestro endpoint, un `var SV` cualquiera no dice nada: puede entrar por un
  // administrador de etiquetas y no estar en el HTML.
  assert.equal(versionEnHtml('<script>var SV = 22;</script>'), null);
  assert.equal(versionEnHtml(''), null);
});

test('⚠️ una página con la LÍNEA DEL CARGADOR está al día, salvo que también tenga una copia vieja pegada', () => {
  // El cargador (lib/pixel-cargador.ts, 09/10/2026) sirve siempre el Pixel del día: la
  // página que lo trae no tiene nada que repegar aunque sus visitas viejas digan 18.
  //
  // PROBADO ROMPIÉNDOLO (09/10/2026, con todo en verde antes: 14 pass / 0 fail en este archivo):
  //   · `versionEnHtml` sin la rama del cargador     → 13 / 1 (éste)
  //   · Math.max en vez de Math.min                    → 12 / 2 (éste y el de las dos copias)
  //   · el default de `actual` en 1 en vez del mínimo → 13 / 1 (éste)
  const linea = `<script src="https://hola-mako.com/m.js?id=mko_${'c3'.repeat(16)}" defer></script>`;
  assert.equal(versionEnHtml(`<html><body>x${linea}</body></html>`, 23), 23, 'la página con el cargador sirve la versión de hoy');
  // Sin `actual` (quien llama no conoce SNIPPET_VERSION), vale el mínimo: alcanza para apagar el aviso.
  assert.equal(versionEnHtml(linea), PIXEL_MINIMO_AVISO);
  // Dos copias, gana la más vieja: la pegada sigue corriendo y mandando sus eventos.
  assert.equal(versionEnHtml(`${snip(18)}${linea}`, 23), 18);
  assert.equal(versionEnHtml(`${linea}${snip(null)}`, 23), 1);
  assert.equal(versionEnHtml(`${snip(23)}${linea}`, 23), 23);
  // Un `/m.js` cualquiera sin un token no es el nuestro.
  assert.equal(versionEnHtml('<script src="https://cdn.x.com/m.js?id=ab"></script>', 23), null);
  // Y el veredicto se apaga aunque las visitas de esa página digan 18.
  const P = 'https://pagina-con-cargador.com';
  assert.equal(veredictoPixel({
    guardada: '18', mapa: { 'pagina-con-cargador.com': { v: 18, t: '' } }, paginas: [P],
    servidas: { 'pagina-con-cargador.com': versionEnHtml(linea, 23) },
  }).viejo, false);
});

test('la clave de una página es la misma para el beacon y para el aviso', () => {
  assert.equal(clavePagina('https://www.Ejemplo.com/landing/?utm_source=fb#arriba'), 'ejemplo.com/landing');
  assert.equal(clavePagina('ejemplo.com'), 'ejemplo.com');
  assert.equal(clavePagina('https://ejemplo.com/'), 'ejemplo.com');
  assert.equal(clavePagina('localhost'), null);
  assert.equal(clavePagina(''), null);
});

test('el mapa por página se escribe sólo cuando cambia, y tiene techo', () => {
  // Lo escribe un endpoint PÚBLICO: sin techo, cualquiera que lea el código fuente
  // de la página lo infla con URLs inventadas.
  //
  // PROBADO ROMPIÉNDOLO: sin el recorte del tope → 1 falla (éste).
  const t = (n: number) => `2026-10-06T10:${String(n).padStart(2, '0')}:00.000Z`;
  assert.equal(anotarVersionDePagina({ 'a.com': { v: 22, t: t(1) } }, 'a.com', 22, t(2)), null, 'escribió sin cambio');
  assert.deepEqual(anotarVersionDePagina({}, 'a.com', 22, t(1)), { 'a.com': { v: 22, t: t(1) } });
  let m = {};
  for (let i = 0; i < 5; i++) m = anotarVersionDePagina(m, `p${i}.com`, 22, t(i), 3) ?? m;
  assert.deepEqual(Object.keys(m).sort(), ['p2.com', 'p3.com', 'p4.com'], 'el tope no sacó las más viejas');
  assert.deepEqual(parsearMapaVersiones('{"a.com":{"v":"21","t":"x"},"b.com":{"v":-1}}'), { 'a.com': { v: 21, t: 'x' } });
  assert.deepEqual(parsearMapaVersiones('no es json'), {});
});

test('⚠️ el veredicto: se apaga al republicar, y no se apaga por la ÚLTIMA visita de OTRA página', () => {
  const P = 'https://multiplicatusresultados.com';
  // El caso del reporte: el setting dice 21, ninguna visita nueva, y la página ya sirve
  // la 22 → no hay que pedir nada.
  //
  // PROBADO ROMPIÉNDOLO, de a una: ignorando `servidas` → 1 falla (éste); decidiendo
  // con el setting del negocio en vez de la página → 1 falla (éste).
  assert.equal(veredictoPixel({ guardada: '21', mapa: {}, paginas: [P], servidas: { 'multiplicatusresultados.com': 22 } }).viejo, false);
  // Sin poder leer la página, manda lo que dicen sus visitas, y si no hay, el negocio.
  assert.equal(veredictoPixel({ guardada: '21', mapa: {}, paginas: [P], servidas: { 'multiplicatusresultados.com': null } }).viejo, true);
  // Dos páginas: el último evento vino de la nueva (setting 22) y la otra sigue en la
  // 15. Con el setting del workspace el aviso se apagaba; por página, no.
  const dos = veredictoPixel({
    guardada: '22',
    mapa: { 'a.com': { v: 22, t: '' }, 'b.com': { v: 15, t: '' } },
    paginas: ['https://a.com', 'https://b.com'],
  });
  assert.equal(dos.viejo, true, 'el último evento de otra página apagó el aviso');
  assert.equal(dos.instalada, 15);
  // Nunca pegó el Pixel (sin fila de versión) → no hay aviso, por más páginas que tenga.
  assert.equal(veredictoPixel({ guardada: null, mapa: {}, paginas: [P] }).viejo, false);
  // Sin páginas declaradas, decide la versión del negocio.
  assert.equal(veredictoPixel({ guardada: '18', mapa: {}, paginas: [] }).viejo, true);
  // Sólo se va a mirar lo que, sin mirarlo, daría viejo.
  assert.deepEqual(paraMirar({ guardada: '22', mapa: { 'a.com': { v: 22, t: '' }, 'b.com': { v: 15, t: '' } }, paginas: ['https://a.com', 'https://b.com'] }), ['https://b.com']);
});

test('⚠️ el cableado: el beacon anota cada página en el pageview, y los tres lectores miran la página', () => {
  // PROBADO ROMPIÉNDOLO, de a una: el beacon sin el `tipo === 'pageview'`, la ruta del
  // aviso volviendo al setting, el WhatsApp sin mirar lo que sirve la página y el
  // diagnóstico sin la versión servida → las cuatro dan 1 falla (éste).
  const beacon = sinComentarios(leer('app/api/track/vsl/route.ts'));
  const anotar = beacon.slice(beacon.indexOf('async function anotarVersionSnippet('), beacon.indexOf('type Payload'));
  assert.match(anotar, /if \(tipo === 'pageview'\) \{[\s\S]*anotarVersionDePagina\(/, 'el beacon dejó de anotar la versión de cada página');
  assert.match(beacon, /anotarVersionSnippet\(payload\.sv, payload\.landing_url, payload\.tipo_evento\)/, 'el beacon no le pasa el tipo de evento');
  const ruta = sinComentarios(leer('app/api/integraciones/landing/version/route.ts'));
  assert.match(ruta, /runWithWorkspace\(ws, \(\) => estadoPixel\(\)\)/, 'el aviso volvió a decidir con el setting del workspace');
  assert.doesNotMatch(ruta, /getSetting\(SNIPPET_VERSION_KEY\)/, 'el aviso volvió a decidir con el setting del workspace');
  const cron = sinComentarios(leer('app/api/cron/tracking-vigilante/route.ts'));
  const iServida = cron.indexOf('versionServida(v.url');
  assert.ok(iServida > 0 && iServida < cron.indexOf('atrasadas.push(v.url)'), 'el WhatsApp nombra la página sin mirar lo que sirve');
  const token = sinComentarios(leer('lib/landing-token.ts'));
  assert.match(token, /const instalada = Math\.max\([\s\S]{0,200}servida \?\? 0,/, 'el diagnóstico dejó de sumar la versión servida');
});
