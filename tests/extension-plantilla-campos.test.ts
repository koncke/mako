// =============================================================================
// Un campo de la plantilla que se captura y no se guarda no da error NUNCA
// =============================================================================
// `MAKO_GUARDAR_PIDO` arma el objeto que se persiste CAMPO POR CAMPO. Todo lo que
// el espejo capture y no esté nombrado ahí se pierde al guardar — la captura anda,
// el guardado anda, y lo único que no llega es el campo que decide.
//
// ⚠️ ESTE TEST EXISTE PORQUE YA PASÓ, EL MISMO DÍA EN QUE SE AGREGÓ EL CAMPO.
//
// `sentinela` —lo que dice si MaKo aprendió a pedirle un video al Flow nuevo— se
// escribía en la captura y moría en ese `out.push`. `aprendioGenerar` leía
// `undefined` siempre, así que el popup pedía generar de nuevo por más clips que la
// persona pagara, en créditos de Google del cliente.
//
// Nada falla: no hay excepción, no hay log, y el estado que se muestra es
// exactamente el que corresponde a «todavía no aprendió». Es indistinguible de la
// verdad.
//
// El test compara las dos puntas: lo que el espejo ESCRIBE en una plantilla contra
// lo que el guardado NOMBRA. Si aparece un campo nuevo en la captura y nadie lo suma
// al push, esto lo dice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'injected.js'), 'utf8',
);

/** Los campos que el espejo de XHR pone en una plantilla al capturarla. */
function camposCapturados(): string[] {
  const m = /plantillas\.set\(clase, \{([\s\S]*?)\n\s*\}\);/.exec(src);
  assert.ok(m, 'no encontré el `plantillas.set` del espejo de XHR');
  // Sin los comentarios: adentro de este bloque hay varios, y una palabra suelta de
  // un comentario se leeria como un campo. Un extractor que inventa campos hace que
  // el test falle sobre algo que esta bien, y un test asi lo apaga alguien.
  const sinComentarios = m[1].replace(/^\s*\/\/.*$/gm, '');
  return [...sinComentarios.matchAll(/^\s*([a-zA-Z_$][\w$]*)\s*[:,]/gm)]
    .map((x) => x[1])
    .filter((k) => !['if', 'try', 'catch', 'return', 'const', 'let'].includes(k));
}

/** Los campos que el guardado nombra al persistir. */
function camposGuardados(): string[] {
  const m = /out\.push\(\{([\s\S]*?)\}\);/.exec(src);
  assert.ok(m, 'no encontré el `out.push` de MAKO_GUARDAR_PIDO');
  return [...m[1].matchAll(/([a-zA-Z_$][\w$]*)\s*(?::|,|\})/g)].map((x) => x[1]);
}

test('todo campo capturado por el espejo se guarda, o se declara descartado', () => {
  // ⚠️ La lista blanca es corta a propósito, y cada entrada dice POR QUÉ no se
  // guarda. Un campo que no está en ninguna de las dos listas es el bug que este
  // test caza.
  const NO_SE_GUARDAN: Record<string, string> = {
    cuando: 'lo repone `guardarPlantillas` con la hora del guardado, que es la que vale.',
  };

  const capturados = camposCapturados();
  const guardados = new Set(camposGuardados());
  const perdidos = capturados.filter((c) => !guardados.has(c) && !(c in NO_SE_GUARDAN));

  assert.deepEqual(
    perdidos, [],
    'Estos campos se capturan y NO llegan al storage:\n  ' + perdidos.join('\n  ')
    + '\n\nEl `out.push` de MAKO_GUARDAR_PIDO nombra los campos uno por uno, así que lo'
    + '\nque no esté ahí se pierde en silencio. Sumalos, o declaralos en NO_SE_GUARDAN'
    + '\ncon el motivo.',
  );
});

test('`sentinela` viaja: es el campo que dice si MaKo aprendió', () => {
  // El caso concreto, fijado por su nombre. Los de arriba lo cubren en general;
  // éste deja el porqué pegado al campo que costó los clips.
  assert.ok(
    camposGuardados().includes('sentinela'),
    'Sin `sentinela` en el guardado, `aprendioGenerar` es `undefined` para siempre y '
    + 'el popup pide generar de nuevo por más veces que la persona pague.',
  );
});
