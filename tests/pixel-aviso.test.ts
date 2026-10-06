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
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PIXEL_MINIMO_AVISO, pixelParaActualizar, RUTA_PIXEL } from '../lib/pixel-aviso';

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
