// =============================================================================
// Hacer videos de avatar NO saca anuncios del historial (item 558, 6/11/2026)
// =============================================================================
// El síntoma: el historial del Video Generator guardaba 10 entradas y las dos
// acciones de «AI Avatar» escriben ahí (`app/ai-avatar/actions.ts`,
// `app/video-editor/avatar/actions.ts`). Cada avatar empujaba un anuncio afuera —y
// con el anuncio se iba el único puntero a sus clips, que están PAGADOS: los .mp4
// quedan en el bucket colgados de un `planId` que sólo vivía en esa fila.
//
// Lo que se fija acá, EJECUTADO contra un `app_settings` en memoria (el molde del
// proceso hijo con `react-server` + `mock.module` es tests/ig-historial.test.ts):
//
//   1. el cupo por tipo: 12 avatares no sacan NI UNO de los 10 anuncios;
//   2. dentro del cupo, lo que no se pagó se va primero (las dos reglas viejas
//      siguen valiendo DENTRO de cada cupo, no sólo globalmente);
//   3. el que se está guardando nunca se cae, aunque no tenga un solo clip;
//   4. el recorte NO reordena: el orden que se guarda es el que entró (el recorte
//      viejo devolvía `[nuevo, ...pagados, ...sin pagar]` y lo dejaba guardado así);
//   5. un historial YA GUARDADO —sin el campo `tipo`— se lee idéntico: mismo
//      largo, mismo orden. Es la condición de desplegar esto sin tocarle el
//      historial a nadie;
//   6. `conAvatar` es el único que sella el tipo, y un plan del Video Generator
//      sigue siendo un anuncio;
//   7. la lectura de la API de MaKo (`leerHistorialEstricto`) devuelve LO MISMO que
//      la pantalla: tenía su propia copia del tope, y una copia que no se enteró
//      del cupo deja a MaKo contestando por WhatsApp una lista más corta que la
//      que la persona está mirando.
//
// Correr: node --import tsx --test tests/video-historial-cupos.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (6/11/2026): base 7 de 7, once roturas, CAYERON LAS ONCE,
// cada una restaurada y verificada por md5. La rotura va arriba de su test con
// cuántos rojos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CUPOS, clipsPagados, recortarPorCupo, tipoDePlan } from '../app/video-generator/historial-cupos';
import { conAvatar, type AvatarIA } from '../app/video-editor/avatar/avatares';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * El historial con `app_settings` EN MEMORIA. ⚠️ `--conditions=react-server` porque
 * `video-datos.ts` es `server-only`: sin eso el import tira y no se ejecuta nada.
 */
const EN_MEMORIA = `
const base = new Map();
const WS = 9;
mock.module(${url('lib/settings.ts')}, { exports: {
  getSetting: async (k) => base.get(WS + '|' + k) ?? null,
  setSetting: async (k, v) => { base.set(WS + '|' + k, v); },
  getSettingEstricto: async (k) => base.get(WS + '|' + k) ?? null,
} });
const { guardarEnHistorial, leerHistorial, KEY_HISTORIAL_VIDEO } = await import(${url('app/video-generator/video-datos.ts')});
const sembrar = (lista) => base.set(WS + '|' + KEY_HISTORIAL_VIDEO, JSON.stringify(lista));
const guardado = () => JSON.parse(base.get(WS + '|' + KEY_HISTORIAL_VIDEO) ?? 'null');
/** Un plan como lo guarda el Video Generator: \`clips\` son las tomas, \`video\` las filmadas. */
const plan = (id, o = {}) => ({
  id, pedido: id, at: '2026-11-06T00:00:00Z',
  plan: { titulo: id, puestaId: 'plano-secuencia', clips: [{ n: 1 }] },
  ...(o.pagados ? { video: Object.fromEntries(Array.from({ length: o.pagados }, (_, i) => [String(i + 1), { url: 'https://x/' + id + '-' + i + '.mp4' }])) } : {}),
  ...(o.tipo ? { tipo: o.tipo } : {}),
});
`;

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings',
    '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

// ── 1. El cupo por tipo ──────────────────────────────────────────────────────

// rotura (`conAvatar` sin `tipo: 'avatar'`): 1 fallo, 6 pases.
// rotura (`tipoDePlan` devolviendo siempre 'anuncio': el cupo vuelve a ser compartido): 4 fallos, 3 pases.
// rotura (`CUPOS.avatar` en 0): 3 fallos, 4 pases.
// rotura (`.slice(0, cupo)` corrido a `cupo + 1`): 4 fallos, 3 pases.
test('12 videos de avatar no sacan NI UNO de los 10 anuncios (ejecutado, con app_settings en memoria)', () => {
  const r = hijo(`import { mock } from 'node:test';${EN_MEMORIA}
// Diez anuncios FILMADOS: cada uno con un clip pagado, que es el puntero que se perdía.
for (let i = 1; i <= 10; i++) await guardarEnHistorial(plan('anuncio-' + i, { pagados: 1 }));
const anunciosAntes = (await leerHistorial()).map((e) => e.id);
// Y ahora alguien se pone a hacer avatares.
for (let i = 1; i <= 12; i++) await guardarEnHistorial(plan('avatar-' + i, { tipo: 'avatar', pagados: 1 }));
const despues = await leerHistorial();
console.log(JSON.stringify({
  anunciosAntes,
  anunciosDespues: despues.filter((e) => e.tipo !== 'avatar').map((e) => e.id),
  avatares: despues.filter((e) => e.tipo === 'avatar').map((e) => e.id),
  total: despues.length,
}));`);
  assert.equal((r.anunciosAntes as string[]).length, 10);
  assert.deepEqual(r.anunciosDespues, r.anunciosAntes, 'los 10 anuncios siguen ahí, y en el mismo orden');
  assert.equal((r.avatares as string[]).length, CUPOS.avatar, 'los avatares se recortan contra SU cupo');
  assert.deepEqual(r.avatares, Array.from({ length: 10 }, (_, i) => `avatar-${12 - i}`), 'y los que quedan son los últimos 10, del más nuevo al más viejo');
});

// ── 2 y 3. Las dos reglas viejas, DENTRO del cupo ────────────────────────────

// rotura (el `protegido` sacado de la prioridad de `recortarPorCupo`): 3 fallos, 4 pases.
// rotura (la prioridad de lo pagado anulada, `...resto` a secas): 2 fallos, 5 pases.
test('dentro del cupo: lo que no se pagó se va primero, y el que se guarda NUNCA se cae', () => {
  const r = hijo(`import { mock } from 'node:test';${EN_MEMORIA}
// Nueve anuncios pagados + uno sin filmar, y entra el once SIN un solo clip.
for (let i = 1; i <= 9; i++) await guardarEnHistorial(plan('pago-' + i, { pagados: 2 }));
await guardarEnHistorial(plan('sin-filmar'));
await guardarEnHistorial(plan('el-nuevo'));
const ids = (await leerHistorial()).map((e) => e.id);
// Y lo mismo DENTRO del cupo de los avatares: no hereda la decisión de los anuncios.
for (let i = 1; i <= 9; i++) await guardarEnHistorial(plan('av-pago-' + i, { tipo: 'avatar', pagados: 1 }));
await guardarEnHistorial(plan('av-sin-filmar', { tipo: 'avatar' }));
await guardarEnHistorial(plan('av-nuevo', { tipo: 'avatar' }));
const avs = (await leerHistorial()).filter((e) => e.tipo === 'avatar').map((e) => e.id);
console.log(JSON.stringify({ ids, avs }));`);
  const ids = r.ids as string[];
  assert.equal(ids.length, 10);
  assert.ok(ids.includes('el-nuevo'), 'el que se acaba de guardar no se cae aunque no tenga clips');
  assert.ok(!ids.includes('sin-filmar'), 'el que se fue es el que no costó nada');
  for (let i = 1; i <= 9; i++) assert.ok(ids.includes(`pago-${i}`), `pago-${i} tenía clips: no se tira`);
  const avs = r.avs as string[];
  assert.equal(avs.length, 10);
  assert.ok(avs.includes('av-nuevo') && !avs.includes('av-sin-filmar'), 'las dos reglas valen igual dentro del cupo de avatares');
});

// ── 4. El orden ──────────────────────────────────────────────────────────────

// rotura (`recortarPorCupo` devolviendo `[...sobreviven]`, el regrupado): 2 fallos, 5 pases.
test('el recorte decide QUIÉN se queda, no en qué orden: el guardado conserva el orden de entrada', () => {
  const r = hijo(`import { mock } from 'node:test';${EN_MEMORIA}
// Intercalados: pagado, sin pagar, pagado… Cruzar el tope no puede subir los pagados.
for (let i = 1; i <= 11; i++) await guardarEnHistorial(plan('p-' + i, i % 2 ? { pagados: 1 } : {}));
console.log(JSON.stringify({ ids: guardado().map((e) => e.id) }));`);
  // Entraron del 1 al 11, y `guardarEnHistorial` pone el nuevo adelante: 11, 10, 9…
  // El 11 es impar (pagado) y es además el protegido; de los diez restantes se cae
  // el más viejo sin pagar, que es `p-2`. Lo que importa es que el resto NO se mueva.
  assert.deepEqual(r.ids, ['p-11', 'p-10', 'p-9', 'p-8', 'p-7', 'p-6', 'p-5', 'p-4', 'p-3', 'p-1']);
});

// ── 5. Lo ya guardado ────────────────────────────────────────────────────────

// rotura (`tipoDePlan` devolviendo siempre 'avatar': lo viejo cae en el cupo del avatar): 4 fallos, 3 pases.
// rotura (`CUPOS.anuncio` en 5): 4 fallos, 3 pases.
test('un historial YA GUARDADO (sin el campo `tipo`) se lee idéntico: desplegar esto no le toca el historial a nadie', () => {
  const r = hijo(`import { mock } from 'node:test';${EN_MEMORIA}
// Tal cual estaría hoy en app_settings: diez planes viejos, ninguno con \`tipo\`.
const viejo = Array.from({ length: 10 }, (_, i) => plan('viejo-' + (10 - i), { pagados: i % 3 === 0 ? 1 : 0 }));
sembrar(viejo);
const leido = await leerHistorial();
console.log(JSON.stringify({
  antes: viejo.map((e) => e.id),
  despues: leido.map((e) => e.id),
  conTipo: leido.filter((e) => 'tipo' in e).length,
}));`);
  assert.deepEqual(r.despues, r.antes, 'mismo largo y mismo orden');
  assert.equal(r.conTipo, 0, 'y no se les inventa un tipo al leerlos');
});

// ── 6. Quién sella el tipo ───────────────────────────────────────────────────

const avatar: AvatarIA = {
  id: 'media-1', url: 'https://x/a.jpg', lugar: 'La oficina', puestaId: 'plano-secuencia',
  deAnuncio: 'Anuncio viejo', escena: { n: 1, desde: 1, hasta: 1, lugar: 'La oficina', prompt: 'p' },
};
const recien = {
  id: 'n', pedido: 'n', at: '2026-11-06T00:00:00Z',
  plan: { titulo: 'n', puestaId: 'plano-secuencia', clips: [{ n: 1 }] },
} as unknown as PlanGuardado;

// rotura (`conAvatar` sin `tipo: 'avatar'`): 1 fallo, 6 pases — y lo caza ESTE test.
// rotura (`tipoDePlan` con `!==` en vez de `===`): 1 fallo, 6 pases.
test('`conAvatar` es lo que sella el tipo; un plan del Video Generator sigue siendo un anuncio', () => {
  assert.equal(tipoDePlan(recien), 'anuncio', 'un plan sin el campo es un anuncio');
  assert.equal(conAvatar(recien, avatar).tipo, 'avatar');
  assert.equal(tipoDePlan(conAvatar(recien, avatar)), 'avatar');
  // Y una basura guardada en el campo NO se lee como avatar: el default es el
  // conservador, porque un anuncio leído como avatar se muda a un cupo donde una
  // tanda de avatares nuevos lo evicta.
  assert.equal(tipoDePlan({ tipo: 'Avatar' }), 'anuncio');
  assert.equal(tipoDePlan({ tipo: 17 }), 'anuncio');
  // Las dos acciones de avatar pasan por `conAvatar` ANTES de guardar: es lo que
  // hace que sellar en un solo lugar alcance para las dos.
  for (const ruta of ['app/ai-avatar/actions.ts', 'app/video-editor/avatar/actions.ts']) {
    const src = sinComentarios(leer(ruta));
    assert.match(src, /const item = conAvatar\(plan\.item, avatar\);\s*\n\s*await guardarEnHistorial\(item\);/, ruta);
  }
});

// ── 7. La otra lectura ───────────────────────────────────────────────────────

// rotura (`leerHistorialEstricto` con `.slice(0, 10)` otra vez): 1 fallo, 6 pases.
test('la lectura de la API de MaKo devuelve LO MISMO que la pantalla (tenía su propia copia del tope)', () => {
  const r = hijo(`import { mock } from 'node:test';${EN_MEMORIA}
const { leerHistorialEstricto } = await import(${url('lib/api-mako/areas/video.helpers.ts')});
for (let i = 1; i <= 10; i++) await guardarEnHistorial(plan('anuncio-' + i, { pagados: 1 }));
for (let i = 1; i <= 10; i++) await guardarEnHistorial(plan('avatar-' + i, { tipo: 'avatar', pagados: 1 }));
console.log(JSON.stringify({
  pantalla: (await leerHistorial()).map((e) => e.id),
  api: (await leerHistorialEstricto()).map((e) => e.id),
}));`);
  assert.equal((r.pantalla as string[]).length, CUPOS.anuncio + CUPOS.avatar);
  assert.deepEqual(r.api, r.pantalla);
});

// ── La pieza pura, sola ──────────────────────────────────────────────────────

// ⚠️ Dos cosas de `recortarPorCupo` NO son observables y por eso no hay rotura: sacar
// el `continue` del camino corto y pasar su `<=` a `<`. Las dos mandan una lista que
// entra en su cupo por el camino de la prioridad, que la devuelve entera y en orden
// de entrada igual. Es redundancia a propósito, no una rama sin probar.
test('`recortarPorCupo` y `clipsPagados` sobre listas a mano', () => {
  const e = (id: string, tipo?: 'avatar', urls = 0) => ({
    id,
    ...(tipo ? { tipo } : {}),
    video: Object.fromEntries(Array.from({ length: urls }, (_, i) => [String(i), { url: `u${i}` }])),
  });
  assert.equal(clipsPagados(e('a')), 0);
  assert.equal(clipsPagados(e('a', undefined, 3)), 3);
  assert.equal(clipsPagados({ id: 'a' }), 0, 'sin `video` son cero, no un tiro');
  assert.equal(clipsPagados({ id: 'a', video: { '1': undefined, '2': { url: 'u' } } }), 1, 'una marca vacía no cuenta');

  // Por debajo del cupo no se toca nada, y las dos clases conviven.
  const mezcla = [e('a1'), e('v1', 'avatar'), e('a2'), e('v2', 'avatar')];
  assert.deepEqual(recortarPorCupo(mezcla).map((x) => x.id), ['a1', 'v1', 'a2', 'v2']);

  // Un cupo lleno de avatares no toca al único anuncio, esté donde esté.
  const muchos = [
    ...Array.from({ length: 12 }, (_, i) => e(`v${i}`, 'avatar')),
    e('el-anuncio'),
  ];
  const quedan = recortarPorCupo(muchos).map((x) => x.id);
  assert.equal(quedan.at(-1), 'el-anuncio', 'y sigue al final: el orden es el de entrada');
  assert.equal(quedan.length, CUPOS.avatar + 1);
});
