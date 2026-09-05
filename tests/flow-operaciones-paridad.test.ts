// =============================================================================
// Las dos copias del catálogo tienen que CONTESTAR lo mismo, no parecerse
// =============================================================================
// `lib/flow-operaciones.ts` es la fuente y `extension/operaciones.js` se genera de
// ahí, con un `--check` en el pre-push. Pero ese chequeo compara TEXTO contra la
// plantilla del generador — y la plantilla tiene las FUNCIONES escritas a mano.
//
// ⚠️ ESO YA SE DESINCRONIZÓ, EL MISMO DÍA EN QUE SE ESCRIBIÓ. Se arregló
// `operacionDelCuerpo` en el TS (detectar con el token, etiquetar con la frase) y
// el JS siguió con la versión vieja: el `--check` daba «al día», porque comparaba
// el archivo contra una plantilla que también estaba vieja. Una guarda que compara
// una copia contra otra copia no puede ver que las dos se movieron juntas.
//
// Lo que sí lo ve es preguntarle lo mismo a las dos. Este test es diferencial: si
// una implementación cambia y la otra no, alguna respuesta se separa.
//
// Importa porque de estas funciones sale si una generación PAGADA se reconoce, y
// con qué codificación hay que escribir el prompt al repetir el pedido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ts from '../lib/flow-operaciones';

/** El catalogo de la extension, cargado como modulo ES.
 *
 * Adentro de una funcion y no arriba: el transform de tsx emite CJS y ahi el
 * top-level await no existe.
 */
const cargarJs = () => import(
  pathToFileURL(resolve(import.meta.dirname, '..', 'extension', 'operaciones.js')).href,
) as Promise<typeof ts>;

/** Cuerpos de prueba, incluidos los que llegan de verdad. */
function casos(): string[] {
  const out: string[] = ['', 'f.req=%5B%5D', 'f.req=%5B%5B%22ngNC2%22%5D%5D'];
  for (const o of ts.OPERACIONES) {
    if (!o.frase) continue;
    // Las tres formas en que puede viajar una frase, incluida la que importa.
    out.push(new URLSearchParams({ 'f.req': JSON.stringify([[o.frase]]) }).toString());
    out.push(encodeURIComponent(JSON.stringify([o.frase])));
    out.push(String(o.frase));
    out.push(JSON.stringify(JSON.stringify([o.frase])));
  }
  return out;
}

test('las dos copias del catálogo traen las mismas operaciones', async () => {
  const js = await cargarJs();
  assert.deepEqual(
    js.OPERACIONES, ts.OPERACIONES,
    'El catálogo de la extensión no es el del server. Corré:\n'
    + '  node --import tsx scripts/sync-operaciones.mjs',
  );
});

test('`operacionDelCuerpo` contesta lo mismo en las dos', async () => {
  const js = await cargarJs();
  for (const c of casos()) {
    assert.deepEqual(
      js.operacionDelCuerpo(c), ts.operacionDelCuerpo(c),
      'Las dos implementaciones se separaron sobre este cuerpo:\n  '
      + JSON.stringify(c.slice(0, 120))
      + '\n\nLa del `--check` compara el archivo contra la plantilla del generador, así\n'
      + 'que si las dos se mueven juntas no ve nada. Arreglá la plantilla de\n'
      + 'scripts/sync-operaciones.mjs y volvé a generar.',
    );
  }
});

test('`dondeAparece` contesta lo mismo en las dos', async () => {
  const js = await cargarJs();
  const anclas = ts.OPERACIONES.flatMap((o) => [o.token, o.frase]).filter(Boolean) as string[];
  for (const c of casos()) {
    for (const a of anclas) {
      assert.equal(
        js.dondeAparece(c, a), ts.dondeAparece(c, a),
        `se separaron con el ancla ${JSON.stringify(a.slice(0, 40))}`,
      );
    }
  }
});

test('`operacionDe` y `A_ENSENAR` contestan lo mismo', async () => {
  const js = await cargarJs();
  for (const o of ts.OPERACIONES) {
    assert.deepEqual(js.operacionDe(o.op), ts.operacionDe(o.op), `difieren en ${o.op}`);
  }
  assert.deepEqual(js.operacionDe('no-existe'), ts.operacionDe('no-existe'));
  assert.deepEqual(js.A_ENSENAR, ts.A_ENSENAR);
});
