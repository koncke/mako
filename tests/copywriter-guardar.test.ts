// =============================================================================
// El Copywriter guarda guiones LARGOS y muchos guiones (verificación del Cerebro de 2f4df801e, 28/10/2026)
// =============================================================================
// ALTA: el compare-and-set comparaba el VALOR entero, que va en la URL del PATCH; desde ~6-8 KB PostgREST no la acepta
// (docs/hallazgos-infra.md, medido en prod el 12/10/2026). Desde ~900 palabras un guion no se guardaba MÁS (cada
// reintento comparaba contra el valor grande ya guardado). MEDIA: lo mismo con el índice, desde ~40 guiones, y cada
// «crear» fallido dejaba un documento huérfano.
//
// El arreglo es de RAÍZ (el Cerebro, f92b74992): `cambiarSettingSi` compara un valor largo en el server y filtra por
// `updated_at` (lib/settings-cas.ts), para todos los que lo llaman. Este test lo fija para el Copywriter: corre las funciones
// REALES en un node aparte (tests/_copywriter-guardar-hijo.ts) contra el PostgREST de mentira con el límite de URL de prod.
// Fija: un guion de más de 20 KB crece y se achica sin fallar, el compare-and-set sigue (dos a la vez: uno 409), 70 guiones
// con títulos largos (un índice de más de 10 KB) entran, un índice que falla no deja huérfanos, y ninguna URL pasa el tope.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let salida: Record<string, unknown> | null = null;
const correr = () => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_copywriter-guardar-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  })) as Record<string, unknown>;
  return salida;
};

test('un guion largo se sigue guardando, y se puede achicar', () => {
  const s = correr();
  assert.equal(s.error, undefined, String(s.error));
  assert.deepEqual(s.guardados, ['ok v2', 'ok v3', 'ok v4', 'ok v5'], 'desde ~8 KB cada guardado fallaba para siempre');
  assert.ok((s.bytesGuion as number) > 20_000, `el guion guardado mide ${s.bytesGuion}: el test no está probando un guion largo`);
  assert.equal(s.quedo, 1);
});

test('el compare-and-set sigue: dos guardados a la vez con la misma versión, uno gana y el otro 409', () => {
  assert.deepEqual(correr().carrera, ['409', 'ok']);
});

test('70 guiones con títulos largos entran en el índice, y un índice que falla no deja el documento huérfano', () => {
  const s = correr();
  assert.deepEqual(s.indice, { fallos: 0, paginas: 71 });
  assert.ok((s.bytesIndice as number) > 10_000, `el índice mide ${s.bytesIndice}: el test no está probando un índice largo`);
  assert.deepEqual(s.aLaVez, ['en el árbol', 'en el árbol', 'en el árbol'], 'tres crear a la vez: ninguno se pierde del árbol');
  const h = s.huerfano as { ok: boolean; docsAntes: number; docsDespues: number };
  assert.equal(h.ok, false);
  assert.equal(h.docsDespues, h.docsAntes, 'cada crear fallido dejaba un documento que nadie ve');
});

test('B7: si la escritura del índice LLEGA y el cliente ve un corte, el documento NO se borra', () => {
  // `cambiarIndice` devuelve `falla(500)` cuando `cambiarSettingSi` tira, y un timeout cuya escritura sí llegó deja la
  // fila puesta. Antes, `crear` leía ese fallo como «no se escribió», borraba el documento, y la página quedaba en la
  // lista abriendo «No existe» sobre un texto recién escrito. Ahora `crear` vuelve a leer el índice antes de borrar.
  const c = correr().cortado as { crear: string; filas: number; abre: string };
  assert.equal(c.filas, 1, 'la fila tiene que estar UNA vez en el árbol (la escritura llegó, y el reintento no la duplica)');
  assert.equal(c.abre, 'abre', 'la página quedó en la lista y el documento se había borrado: abría «No existe»');
  assert.equal(c.crear, 'ok', 'la creación salió (la fila está): devolver un error deja a la pantalla mintiendo');
});

test('ninguna URL pasa el tope de PostgREST, y nada sale a la red', () => {
  const s = correr();
  assert.ok((s.urlMasLarga as number) <= 8_000, `la URL más larga midió ${s.urlMasLarga}: un valor largo viajó en la URL`);
  assert.deepEqual(s.red, []);
});
