// =============================================================================
// «Ya te sigo» vuelve a la condición de antes y el lead recibe el recurso (ticket #29 de Leandro, Fiesta Music, 29/10/2026)
// =============================================================================
// Leandro (`mako_doer_conv` 1716, ws10): «el DM de rechazo tiene "Ya te sigo", que vuelve a la condición "Te sigue en
// Instagram". Cuando el lead lo toca no pasa nada, siga o no siga a la cuenta… Sin eso, quien tarda en seguirnos se queda
// sin el recurso». Su diagnóstico («el botón no puede llevar a una tarjeta por la que el lead ya pasó») NO era la causa:
// la base (la 680, inscripción 659 y la vuelta de antes del lead 5436) muestra que el motor SÍ volvía a la condición y
// anotaba el «Seguinos» como enviado otra vez. Lo que el lead veía como «no pasa nada» eran tres cosas:
//   1. la clave de Zernio era (inscripción, vuelta, tarjeta): la segunda vez del MISMO «Seguinos» repetía la clave, y Zernio
//      contestaba lo de antes SIN mandar nada (`claveDeEnvio` ahora lleva la pasada);
//   2. un toque del mismo botón dentro del minuto era «repetido» y se tiraba: el que seguía la cuenta y volvía a tocar
//      enseguida no recibía nada (ahora es repetido sólo si la tarjeta no volvió a salir desde el toque anterior);
//   3. «¿te sigue?» se preguntaba con la caché de Zernio (`refresh=false`), que guarda la respuesta «briefly»: un follow de
//      hace un momento no se veía (ahora la vía rápida de UN lead pregunta con `refresh=true`, lo que pide su doc).
// Y como cada toque ahora SÍ manda un DM, hay un tope de toques por vuelta (`TOPE_TOQUES_POR_VUELTA`).
//
// Por la ENTRADA REAL: el webhook de Zernio y el motor de verdad contra una base en memoria y un Zernio de mentira que hace
// lo que hace el de verdad con la Idempotency-Key y con el «¿te sigue?» (tests/_boton-vuelve-hijo.ts).
//
// Correr: node --import tsx --test tests/boton-vuelve-a-la-condicion.test.ts
// ROTURAS: al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerMarcaToque, marcaToque, vueltaDeToque, TOPE_TOQUES_POR_VUELTA } from '../lib/botones-social';
import { comentarioDispara } from '../lib/palabras-clave';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '');

type Paso = { llego: string[]; zernio: string[]; sigue: string[]; insc: string[]; envios: string[]; marca: string | null; historial: string[] };
type Salida = { pasos: Record<string, Paso>; otros: string[] };
const salidas = new Map<string, Salida>();
const correr = (esc: 'gate' | 'tope'): Salida => {
  if (!salidas.has(esc)) {
    const out = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx',
      join(RAIZ, 'tests/_boton-vuelve-hijo.ts'), esc], { cwd: RAIZ, encoding: 'utf8', timeout: 150_000, maxBuffer: 32 * 1024 * 1024 });
    const i = out.lastIndexOf('@@R@@');
    assert.ok(i >= 0, `el hijo no terminó: ${out.slice(-1500)}`);
    salidas.set(esc, JSON.parse(out.slice(i + 5).trim()) as Salida);
  }
  return salidas.get(esc)!;
};
const SEGUINOS = 'Todavía no te veo entre nuestr';
const cuantos = (xs: string[], x: string) => xs.filter((y) => y === x).length;

test('el caso de Leandro: «Ya te sigo» antes de seguir → OTRO «Seguinos»; la sigue, toca → el link; el doble toque no repite', () => {
  const { pasos: p, otros } = correr('gate');
  assert.deepEqual(otros, [], 'nada sale a la red real');
  assert.deepEqual(p['0_comento'].llego, ['Te dejo el recurso por el que '], 'comenta y le llega el DM con «Obtener recurso»');
  // 1. «Obtener recurso» sin seguir la cuenta: el «Seguinos».
  assert.deepEqual(p['1_obtener_sin_seguir'].llego.slice(1), [SEGUINOS]);
  assert.deepEqual(p['1_obtener_sin_seguir'].insc, ['activa nodo=m3'], 'espera el toque de «Ya te sigo»');
  // 2. ⚠️ «Ya te sigo» SIN seguirla: vuelve a la MISMA condición (una de antes) y le LLEGA otra vez el «Seguinos». Antes Zernio
  //    devolvía la respuesta guardada de la primera (misma clave) y no mandaba nada: «no pasa nada».
  assert.equal(cuantos(p['2_ya_te_sigo_sin_seguir'].llego, SEGUINOS), 2, 'el segundo «Seguinos» LLEGA');
  assert.ok(p['2_ya_te_sigo_sin_seguir'].zernio.some((z) => /^entregado POST \/inbox\/conversations\/conv_ana\/messages key=nutri:\d+:\d+:m3:p2#0$/.test(z)), 'con la clave de la segunda pasada');
  // 3. ⚠️ La sigue y vuelve a tocar ENSEGUIDA (menos de un minuto): el link. Antes era un «doble toque» y se tiraba.
  assert.equal(p['3_la_sigue_y_toca'].llego.at(-1), '¡Acá está!', 'le llega el recurso');
  assert.deepEqual(p['3_la_sigue_y_toca'].insc, ['completada nodo=null']);
  // ⚠️ «¿Te sigue?» SIN la caché de Zernio en cada toque: con la caché, el follow de recién decía «no».
  assert.deepEqual(p['3_la_sigue_y_toca'].sigue, ['fresco', 'fresco', 'fresco']);
  // 4. El doble toque de verdad (nada salió de esa tarjeta desde el toque anterior): no se manda el link dos veces.
  assert.deepEqual(p['4_doble_toque'].llego, p['3_la_sigue_y_toca'].llego);
  assert.deepEqual(p['4_doble_toque'].envios, p['3_la_sigue_y_toca'].envios);
  // Nada «guardado» ni rechazado por Zernio en todo el caso: cada cosa que el motor anotó como enviada, salió.
  for (const [n, x] of Object.entries(p)) assert.ok(x.zernio.every((z) => z.startsWith('entregado')), `${n}: ${x.zernio.join(' | ')}`);
});

test('el tope: quien toca sin parar recibe a lo sumo TOPE_TOQUES_POR_VUELTA «Seguinos», y el historial dice por qué', () => {
  const p = correr('tope').pasos['1_toca_sin_parar'];
  assert.equal(TOPE_TOQUES_POR_VUELTA, 10);
  // «Obtener recurso» + doce «Ya te sigo», sin seguir nunca: diez toques mueven, diez «Seguinos»; los otros tres, no.
  assert.equal(cuantos(p.llego, SEGUINOS), TOPE_TOQUES_POR_VUELTA);
  assert.equal(p.historial.filter((h) => /no la muevo más\.$/.test(h)).length, 3);
  assert.equal(leerMarcaToque(p.marca)?.veces, TOPE_TOQUES_POR_VUELTA);
  assert.deepEqual(p.insc, ['activa nodo=m3']);
});

test('la marca del toque: la de antes se lee con 0 toques, y la vuelta es inscripto_at en ms', () => {
  assert.deepEqual(leerMarcaToque('m3:b1@2026-10-29T16:16:43.884Z'), { firma: 'm3:b1', at: '2026-10-29T16:16:43.884Z', veces: 0, vuelta: '' }, 'la marca de producción de antes del arreglo');
  const m = { firma: 'm3:b1', at: '2026-10-29T16:16:43.884Z', veces: 3, vuelta: vueltaDeToque('2026-10-29T16:15:24.044Z') };
  assert.equal(m.vuelta, String(Date.parse('2026-10-29T16:15:24.044Z')));
  assert.deepEqual(leerMarcaToque(marcaToque(m)), m, 'ida y vuelta');
  assert.equal(leerMarcaToque(null), null);
  assert.equal(leerMarcaToque(''), null);
  assert.equal(vueltaDeToque(null), '');
});

test('el cableado: la ventana mira si la tarjeta volvió a salir, el tope corta antes de mover, y sólo la vía rápida pregunta fresco', () => {
  const n = sinComentarios(leer('lib/nutricion.ts'));
  const toque = n.slice(n.indexOf('export async function tocarBoton('), n.indexOf('export async function alContestar('));
  assert.match(toque, /if \(!\(await vecesQueSalio\(db, f\.id, nodoId, marca\.at\)\)\) return 'repetido';/);
  assert.ok(toque.indexOf('if (veces >= TOPE_TOQUES_POR_VUELTA) {') < toque.indexOf(".update({ paso_actual: j, nodo_actual: boton.siguiente"), 'el tope corta ANTES de mover');
  assert.match(toque, /await setSetting\(keyToque, marcaToque\(\{ firma, at: ahora, veces: veces \+ 1, vuelta \}\)\)/);
  // La pasada sale de lo que YA salió (enviado o simulado): un fallo no cuenta, su reintento repite la clave.
  assert.match(n, /\.eq\('inscripcion_id', inscId\)\.eq\('nodo_id', nodo\)\.in\('estado', \['enviado', 'simulado'\]\);/);
  assert.match(n, /hechosDeLeads\(supabase, leadsQueDeciden, filasQueDeciden, \{ fresco: opts\?\.soloLeadId != null \}\)/);
});

// El punto 2 del ticket: «que /docs explique las palabras clave del disparador y el "Contiene / Es exactamente"». La guía
// (app/api-mako/Articulos.tsx) dice las reglas de VERDAD: cada ejemplo que da, pasado por `comentarioDispara`.
test('/docs: la guía de palabras clave y botones dice lo que hace el código (y el tope de verdad)', () => {
  assert.match(leer('app/api-mako/articulos-meta.ts'), /\{ titulo: 'Guías', articulos: \[[^\]]*'instagram-palabras-botones'/);
  const art = leer('app/api-mako/Articulos.tsx');
  assert.match(art, /\{slug === 'instagram-palabras-botones' && <InstagramPalabrasBotones \/>\}/);
  const g = art.slice(art.indexOf('function InstagramPalabrasBotones('), art.indexOf('function MigrarCurso('));
  for (const x of ['<strong>Contiene</strong>', '<strong>Es exactamente</strong>', 'No distingue mayúsculas ni tildes', 'La «ñ» sí cuenta', 'Un emoji es una palabra propia', `Hasta ${TOPE_TOQUES_POR_VUELTA} toques por inscripción`]) {
    assert.ok(g.includes(x), `la guía dice «${x}»`);
  }
  // Los ejemplos de la guía, con la regla de verdad.
  assert.equal(comentarioDispara('PruebaFM', ['prúebafm']), true, '«PruebaFM» y «prúebafm» son la misma');
  assert.equal(comentarioDispara('año', ['ano']), false, 'la ñ cuenta');
  assert.equal(comentarioDispara('quiero la guía!', ['guía']), true);
  assert.equal(comentarioDispara('guiar', ['guía']), false, 'contiene = la palabra entera');
  assert.equal(comentarioDispara('¡Guía!', ['guía'], 'exacta'), true);
  assert.equal(comentarioDispara('la guía', ['guía'], 'exacta'), false);
  assert.equal(comentarioDispara('Fiesta 🎉', ['fiesta'], 'exacta'), true, 'sin emoji en la palabra, los del comentario no cuentan');
  assert.equal(comentarioDispara('me encanta🔥', ['🔥']), true, 'un emoji es una palabra');
  assert.equal(comentarioDispara('Fiesta🎉', ['fiesta']), true, '«Fiesta🎉» se lee «fiesta 🎉»');
});

// ROTURAS (29/10/2026, una por vez, restaurando byte a byte; base 5 / 0):
//   la clave sin la pasada (sin `yaSalio + 1`) → 3 / 2 (el segundo «Seguinos» es la respuesta guardada: no llega);
//   la ventana de antes (`return 'repetido'` sin mirar si la tarjeta volvió a salir) → 2 / 3 (el toque después de seguir se tira);
//   «¿te sigue?» con la caché en el motor (`fresco: false`) → 3 / 2; con `?refresh=false` fijo en lib/zernio.ts → 4 / 1;
//   sin el tope (`veces >= 99`) → 4 / 1; la marca que no suma (`veces` sin + 1) → 3 / 2;
//   la pasada contando también los fallos (sin el `.in('estado', …)`) → 4 / 1; la guía que dice otra cosa de la «ñ» → 4 / 1.
