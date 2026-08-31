// =============================================================================
// La instrucción y su guard hablan el MISMO vocabulario
// =============================================================================
// El defecto que motivó este archivo, y es de manual: la instrucción de encuadre
// que se le manda al modelo decía «close-up, FACE and shoulders filling the
// frame», y `mencionaCara()` rechaza todo prompt que contenga `face`. O sea que
// se le pedía al modelo copiar literalmente una línea que el guard de al lado
// prohíbe, y el resultado era que TODAS las escenas se rechazaban — con un
// mensaje que además acusaba a MaKo de «describir a la persona».
//
// La regla que queda: **el vocabulario de una instrucción y el de su guard son el
// mismo vocabulario.** Si el guard prohíbe una palabra, la instrucción no la
// puede usar. Y esto no se puede dejar librado a que alguien se acuerde: son dos
// archivos distintos y la contradicción no rompe nada hasta que llega una
// respuesta real.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mencionaCara } from '../lib/escenas-core';

const RAIZ = process.cwd();

/**
 * El fuente sin comentarios.
 *
 * ⚠️ Hace falta: la primera versión de este chequeo dio positivo sobre el
 * COMENTARIO que explica el bug —cita la palabra vieja— y no sobre la
 * instrucción. Un chequeo que se dispara con su propia documentación enseña a
 * ignorarlo.
 */
function sinComentarios(ruta: string): string {
  const crudo = readFileSync(join(RAIZ, ruta), 'utf8');
  return crudo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Los textos entre comillas de `COMO_FILMA`, que es lo que viaja al modelo. */
function instruccionesDeEncuadre(): string[] {
  const src = sinComentarios('lib/escenas.ts');
  const i = src.indexOf('const COMO_FILMA');
  assert.ok(i > 0, 'COMO_FILMA ya no está en lib/escenas.ts: el test quedó viejo');
  const fin = src.indexOf('\n};', i);
  assert.ok(fin > i, 'no se pudo delimitar COMO_FILMA');
  return [...src.slice(i, fin).matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map((m) => m[1])
    .filter((t) => t.length > 15);
}

test('NINGUNA instrucción de encuadre usa una palabra que el guard prohíbe', () => {
  const textos = instruccionesDeEncuadre();
  assert.ok(textos.length >= 4, `se leyeron ${textos.length} instrucciones: la extracción falló`);

  const rotas = textos
    .map((t) => ({ t, marcas: mencionaCara(t) }))
    .filter((x) => x.marcas.length > 0);

  assert.deepEqual(
    rotas.map((x) => `${x.marcas.join(', ')} → «${x.t.slice(0, 60)}…»`),
    [],
    'Una instrucción que el modelo tiene que copiar no puede contener una palabra '
    + 'que `mencionaCara` rechaza: el lote entero se descarta y el mensaje culpa a MaKo.',
  );
});

// ⚠️ ACÁ HABÍA UN TEST sobre los EJEMPLOS del prompt de sistema, y se sacó
// porque no podía aislar su sujeto: su expresión agarraba el template literal
// entero en vez de los ejemplos, y fallaba sobre un fragmento sin sentido.
//
// El riesgo que quería cubrir es real —un ejemplo en inglés que use una palabra
// prohibida se copia, porque los modelos copian ejemplos— pero hoy el SYSTEM no
// tiene ninguno: su único ejemplo es el esqueleto JSON, con los valores como
// marcadores. Un test que se dispara con lo que no es enseña a ignorarlo, que es
// peor que no tenerlo. Si algún día se agrega un ejemplo de prompt de verdad,
// este es el lugar.

test('las cuatro cámaras del catálogo tienen su traducción a encuadre', () => {
  // Una cámara sin traducción cae a la de trípode, y un formato filmado con la
  // cámara equivocada no se parece en nada al que se eligió.
  const src = sinComentarios('lib/escenas.ts');
  const i = src.indexOf('const COMO_FILMA');
  const bloque = src.slice(i, src.indexOf('\n};', i));
  for (const camara of ['selfie', 'seguimiento', 'mano', 'estatica']) {
    assert.match(bloque, new RegExp(`\\b${camara}\\s*:`), `falta el encuadre de «${camara}»`);
  }
});
