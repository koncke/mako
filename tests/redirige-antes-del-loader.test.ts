// =============================================================================
// Una página con loader que REDIRIGE lo hace en su layout, antes del loader (23/10/2026, ticket #7)
// =============================================================================
// Un `redirect()` adentro de una página con `loading.tsx` va adentro del stream (200 + meta refresh, no 307). En /general
// la carrera con la hidratación tiró «Minified React error #310» en el router de Next (errores_app id 5; /general dejó el
// loader). /plan y /second-brain redirigen al super admin y se quedan con el loader (Martín lo pidió): la redirección va en
// su LAYOUT, que queda afuera del loading.tsx y devuelve el 307. El layout no recibe la query ni sabe la ruta: las dos las
// pone el proxy en headers que pisa (lib/pedido-actual.ts).
// ROTURAS (23/10/2026, una por vez y restaurada; base 5 / 0): el proxy sin HEADER_QUERY → 4 / 1; el layout de /plan sin el
// chequeo de la ruta exacta (redirigiría también /plan/agencia: un bucle) → 4 / 1; el de /second-brain sin `quienOpera` →
// 4 / 1; `queryComoSearchParams` que pierde los repetidos → 4 / 1.
// Correr: node --import tsx --test tests/redirige-antes-del-loader.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryComoSearchParams } from '../lib/pedido-actual-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la query llega al layout como la recibe una página: un valor, o la lista si se repite', () => {
  assert.deepEqual(queryComoSearchParams('?tarea=abc&cliente=7'), { tarea: 'abc', cliente: '7' });
  assert.deepEqual(queryComoSearchParams('?chat=1&chat=2&chat=3'), { chat: ['1', '2', '3'] });
  assert.deepEqual(queryComoSearchParams(''), {});
});

test('el proxy pone la ruta Y la query, pisando las que mande el cliente', () => {
  const proxy = sinComentarios(leer('proxy.ts'));
  assert.match(proxy, /headers\.set\(HEADER_RUTA, req\.nextUrl\.pathname\);\n\s*headers\.set\(HEADER_QUERY, req\.nextUrl\.search\);/);
  assert.match(leer('lib/api-tab.ts'), /export const HEADER_QUERY = 'x-mako-query';/);
});

test('/plan: el layout manda al super admin a /plan/agencia SÓLO en la ruta exacta, con la misma decisión que la página', () => {
  const lay = sinComentarios(leer('app/plan/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/plan'\) \{/, 'sin la ruta exacta redirigiría también /plan/agencia: un bucle');
  const pag = sinComentarios(leer('app/plan/page.tsx'));
  // La condición y el destino, iguales en los dos.
  for (const pedazo of ["if (sesion?.rol === 'admin' && !(await estaImpersonando())) {", 'redirect(await rutaConWs(`/plan/agencia${qs ? `?${qs}` : \'\'}`));', "else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);"]) {
    assert.ok(lay.includes(pedazo), `el layout no tiene «${pedazo}»`);
    assert.ok(pag.includes(pedazo), `la página no tiene «${pedazo}» (el layout la copia: cambiar los dos)`);
  }
  assert.match(lay, /return children;\n\}/);
});

test('/second-brain: el layout manda a quien opera al Ops Center SÓLO en la ruta exacta, con la decisión de la página', () => {
  const lay = sinComentarios(leer('app/second-brain/layout.tsx'));
  assert.match(lay, /if \(ruta === '\/second-brain' && \(await quienOpera\(\)\)\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(query\)\)\);/);
  assert.match(sinComentarios(leer('app/second-brain/page.tsx')), /if \(opera\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(q\)\)\);/);
});

test('las páginas con loader que redirigen al super admin tienen su layout que redirige antes', () => {
  for (const seg of ['plan', 'second-brain']) {
    assert.ok(leer(`app/${seg}/loading.tsx`).length > 0, `${seg} sin loader: este test ya no hace falta para él`);
    assert.match(leer(`app/${seg}/layout.tsx`), /redirect\(/, `${seg} tiene loader y redirige sólo adentro: el redirect va al stream`);
  }
});
