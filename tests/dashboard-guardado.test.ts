// =============================================================================
// El AUTOGUARDADO del Dashboard con versión (tanda v5, paquete «La edición»): app/dashboard/guardado.ts (la
// cola, pura) y su cableado en app/dashboard/EditorInforme.tsx y app/dashboard/page.tsx.
// =============================================================================
// Antes el editor hacía un upsert ciego del informe ENTERO y la API de MaKo escribía con compare-and-set: ganaba
// el último, y una pestaña vieja (con el saneo de antes) borraba en su primer guardado lo que su versión no
// conocía. Desde v5 la pantalla manda la versión que leyó y la ruta contesta la nueva, o 409. Lo que fija esto:
//   · UNO DETRÁS DEL OTRO: dos guardados en vuelo con la misma versión chocarían ENTRE SÍ (el segundo, 409, y la
//     pantalla diría «Cambió en otra pestaña» sobre un cambio propio). Mientras uno viaja, el siguiente espera, y
//     de varios esperando sólo sale el ÚLTIMO (es el informe entero).
//   · La versión del próximo sale de la RESPUESTA del anterior.
//   · Un 409 (con o sin `conflicto`) PARA la cola y avisa UNA vez; otro fallo avisa y sigue, con la misma versión.
//   · Volver a lo de antes MIENTRAS viaja otra cosa se manda (si no, el server se queda con lo del medio).
// Correr: npx tsx --test tests/dashboard-guardado.test.ts
//
// ── Roturas (12/10/2026, scratchpad p5/romper.mjs: una por vez, restaurada de MEMORIA y verificada por hash,
//    nunca con git). Base: 10 pasan / 0 fallan; al final, 10 / 0. Cada rotura tumbó SU test (pasan / fallan):
//   · `pedir` que arranca otra corrida aunque haya una en vuelo          -> 7 / 3  «uno detrás…», «un 409…» y «volver a lo de antes…»
//   · la versión que no se toma de la respuesta (queda la leída)        -> 9 / 1  «la versión del próximo…»
//   · un 409 que no para la cola                                         -> 9 / 1  «un 409 para la cola…»
//   · un 500 que también para la cola                                    -> 9 / 1  «un fallo que no es 409…»
//   · comparar contra lo último guardado y no contra lo que viaja       -> 9 / 1  «volver a lo de antes…»
//   · el reemplazo de lo que espera que pierde el keepalive              -> 9 / 1  «el keepalive…»
//   · el envío sin su `catch` (un fetch que tira deja la cola en vuelo) -> 9 / 1  «un envío que tira…»
//   · `leerRespuestaGuardado` sin leer `conflicto`                       -> 9 / 1  «leer la respuesta…»
//   · el cuerpo del guardado sin la versión                              -> 9 / 1  «la pantalla manda la versión…»
//   · page.tsx sin pasar `versionInicial`                                -> 9 / 1  «la página baja la versión…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearColaGuardado, leerRespuestaGuardado, type RespuestaGuardado } from '../app/dashboard/guardado';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

/** Un `enviar` que no contesta hasta que el test lo dice: así se ve qué sale mientras uno viaja. */
function servidor() {
  const llamadas: Array<{ json: string; version: string | null; keepalive: boolean; contestar: (r: RespuestaGuardado) => void; tirar: () => void }> = [];
  const enviar = (json: string, version: string | null, keepalive: boolean) => new Promise<RespuestaGuardado>((ok, mal) => {
    llamadas.push({ json, version, keepalive, contestar: ok, tirar: () => mal(new Error('red')) });
  });
  return { llamadas, enviar };
}
/** Deja correr los microtasks (la cola arranca en uno y sigue después de cada respuesta). */
const tic = () => new Promise<void>((r) => setTimeout(r, 0));

test('uno detrás del otro: mientras uno viaja no sale otro, y de los que esperan sólo sale el último', async () => {
  const s = servidor();
  const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alConflicto: () => {} });
  void cola.pedir('A');
  await tic();
  assert.equal(s.llamadas.length, 1);
  void cola.pedir('B');
  void cola.pedir('C');
  await tic();
  assert.equal(s.llamadas.length, 1, 'salió otro con el primero en vuelo: los dos chocan con la misma versión');
  assert.ok(cola.pendiente());
  s.llamadas[0].contestar({ ok: true, version: 'v1' });
  await tic();
  assert.deepEqual(s.llamadas.map((l) => l.json), ['A', 'C'], 'B era un informe viejo: sólo vale el último');
  s.llamadas[1].contestar({ ok: true, version: 'v2' });
  await tic();
  assert.equal(cola.pendiente(), false);
  assert.equal(cola.ultimo(), 'C');
});

test('la versión del próximo guardado es la que contestó el server en el anterior', async () => {
  const s = servidor();
  const guardados: string[] = [];
  const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alGuardar: (j) => guardados.push(j), alConflicto: () => {} });
  void cola.pedir('A');
  await tic();
  assert.equal(s.llamadas[0].version, 'v0', 'el primero va con la versión que se LEYÓ');
  s.llamadas[0].contestar({ ok: true, version: 'v7' });
  await tic();
  assert.equal(cola.version(), 'v7');
  void cola.pedir('B');
  await tic();
  assert.equal(s.llamadas[1].version, 'v7', 'el segundo fue con la versión vieja: el server lo rebotaría con un 409 propio');
  s.llamadas[1].contestar({ ok: true, version: null });
  await tic();
  assert.equal(cola.version(), null, 'un 200 sin versión (un guardado de antes) deja la versión en null, no la inventa');
  assert.deepEqual(guardados, ['A', 'B']);
});

test('un 409 para la cola, con o sin `conflicto`: avisa UNA vez y no manda nada más (ni lo que esperaba)', async () => {
  for (const conflicto of [true, false]) {
    const s = servidor();
    const avisos: boolean[] = [];
    const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alConflicto: (c) => avisos.push(c) });
    void cola.pedir('A');
    await tic();
    void cola.pedir('B'); // espera detrás de A
    s.llamadas[0].contestar({ ok: false, status: 409, conflicto });
    await tic();
    assert.deepEqual(avisos, [conflicto]);
    assert.equal(cola.parada(), true);
    void cola.pedir('C');
    await tic();
    assert.equal(s.llamadas.length, 1, `con ${conflicto ? '' : 'un 409 sin '}conflicto se siguió guardando: pisaría lo de la otra pestaña`);
    assert.equal(avisos.length, 1, 'el aviso se repite en cada cambio');
  }
});

test('un fallo que no es 409 avisa y sigue: lo que no entró se reintenta con la MISMA versión', async () => {
  const s = servidor();
  const fallos: Array<[boolean, string]> = [];
  const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alFallar: (ka, j) => fallos.push([ka, j]), alConflicto: () => assert.fail('un 500 no es un conflicto') });
  void cola.pedir('A');
  await tic();
  s.llamadas[0].contestar({ ok: false, status: 500, conflicto: false });
  await tic();
  assert.deepEqual(fallos, [[false, 'A']], 'el fallo no dice qué no entró');
  assert.equal(cola.parada(), false, 'un 500 paró la cola: lo que siga no se guardaría nunca');
  assert.equal(cola.ultimo(), 'U', 'lo que falló no cuenta como guardado');
  void cola.pedir('A');
  await tic();
  assert.equal(s.llamadas.length, 2, 'lo que falló no se vuelve a mandar');
  assert.equal(s.llamadas[1].version, 'v0', 'el server no cambió la versión: el reintento va con la misma');
});

test('volver a lo de antes MIENTRAS viaja otra cosa se manda (si no, el server se queda con lo del medio)', async () => {
  const s = servidor();
  const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alConflicto: () => {} });
  void cola.pedir('U');
  await tic();
  assert.equal(s.llamadas.length, 0, 'lo igual a lo guardado no se manda');
  void cola.pedir('A');
  await tic();
  void cola.pedir('U'); // Ctrl+Z con A en vuelo
  s.llamadas[0].contestar({ ok: true, version: 'v1' });
  await tic();
  assert.deepEqual(s.llamadas.map((l) => l.json), ['A', 'U'], 'el deshacer no se guardó: el server quedó con A');
  // Y lo igual a lo que YA viaja no se duplica.
  s.llamadas[1].contestar({ ok: true, version: 'v2' });
  await tic();
  void cola.pedir('B');
  await tic();
  void cola.pedir('B');
  await tic();
  assert.equal(s.llamadas.length, 3);
});

test('el keepalive de la pestaña que se oculta no se pierde si después llega otro cambio', async () => {
  const s = servidor();
  const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alConflicto: () => {} });
  void cola.pedir('A');
  await tic();
  void cola.pedir('B', true); // la pestaña se oculta con A en vuelo
  void cola.pedir('C'); // y el último cambio le gana a B
  s.llamadas[0].contestar({ ok: true, version: 'v1' });
  await tic();
  assert.equal(s.llamadas[1].json, 'C');
  assert.equal(s.llamadas[1].keepalive, true, 'sin keepalive, el navegador corta el pedido al cerrar la pestaña');
});

test('un envío que tira (la red) cuenta como fallo y la cola no queda «en vuelo» para siempre', async () => {
  const s = servidor();
  let fallos = 0;
  const cola = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: s.enviar, alFallar: () => { fallos++; }, alConflicto: () => {} });
  const p = cola.pedir('A');
  await tic();
  s.llamadas[0].tirar();
  await p;
  assert.equal(fallos, 1);
  assert.equal(cola.pendiente(), false, 'quedó en vuelo: nada más se guardaría');
  // Y un envío que contesta en el acto (sin esperar nada) tampoco la deja trabada.
  const inmediata = crearColaGuardado({ version: 'v0', ultimo: 'U', enviar: async () => ({ ok: true, version: 'v1' }), alConflicto: () => {} });
  await inmediata.pedir('A');
  assert.equal(inmediata.pendiente(), false, 'la cola quedó «en vuelo» para siempre');
  await inmediata.pedir('B');
  assert.equal(inmediata.ultimo(), 'B', 'el segundo no salió');
});

test('leer la respuesta: la versión de un 200, el `conflicto` de un 409, y el estado del resto', async () => {
  const resp = (status: number, cuerpo?: unknown) => new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status });
  assert.deepEqual(await leerRespuestaGuardado(resp(200, { tablero: {}, version: 'abc' })), { ok: true, version: 'abc' });
  assert.deepEqual(await leerRespuestaGuardado(resp(200, { ok: true })), { ok: true, version: null });
  assert.deepEqual(await leerRespuestaGuardado(resp(409, { error: 'x', conflicto: true })), { ok: false, status: 409, conflicto: true });
  assert.deepEqual(await leerRespuestaGuardado(resp(409, { error: 'Recarga la página' })), { ok: false, status: 409, conflicto: false });
  assert.deepEqual(await leerRespuestaGuardado(resp(500)), { ok: false, status: 500, conflicto: false });
});

const EDITOR = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));

test('la pantalla manda la versión que leyó, por la cola, y un 409 se dice con «Recargar»', () => {
  const mandar = bloque(EDITOR, 'const mandar = useCallback(', '}, [guardable, show]);');
  assert.ok(mandar.length < 1800, `el recorte mide ${mandar.length}: está mirando otra cosa`);
  assert.match(mandar, /if \(!guardable \|\| json === ultimoGuardado\.current\) return;/, 'el closer o un link guardarían');
  assert.match(mandar, /crearColaGuardado\(\{\s*version: versionLeida\.current,/);
  assert.match(mandar, /body: `\{"accion":"guardar","version":\$\{JSON\.stringify\(v\)\},"tablero":\$\{j\}\}`/, 'el guardado salió sin la versión: vuelve el upsert ciego');
  assert.match(mandar, /await cola\.pedir\(json, keepalive\);/);
  assert.equal((EDITOR.match(/accion":"guardar"|accion: 'guardar'/g) ?? []).length, 1, 'un segundo camino de guardado se saltea la cola');
  assert.match(mandar, /alConflicto: \(\) => \{ setConflicto\(true\); show\('Cambió en otra pestaña'/);
  assert.match(EDITOR, /const versionLeida = useRef\(versionInicial\);/);
  assert.match(EDITOR, /\{conflicto && [^\n]*accion=\{\{ label: 'Recargar', onClick: recargar \}\}/);
  assert.match(EDITOR, /const recargar = useCallback\(\(\) => \{ window\.location\.href = conWs\(/, '«Recargar» sin el ?ws= deja al super admin mirando su propia cuenta');
});

test('la página baja la versión de lo que leyó (el cerrador no: no guarda)', () => {
  const page = sinComentarios(leer('app/dashboard/page.tsx'));
  assert.match(page, /version = lectura\.version;/);
  assert.match(page, /versionInicial=\{version\}/);
});
