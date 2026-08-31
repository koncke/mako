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
import { promptFinal } from '../lib/flow-imagen';
import { PROMPT_IMAGEN } from '../lib/prompts-imagen';

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

// ── EL PROMPT QUE SE MANDA DE VERDAD ────────────────────────────────────────
// El prompt del modelo describe el LUGAR y nada más. Todo lo que hace que la
// persona salga parecida —la identidad, la luz, el realismo— lo pone el código,
// y por eso hay que poder mirarlo desde acá.

test('el prompt final lleva el metodo validado, no solo la escena', () => {
  const escena = 'SELFIE at arm length inside a modern car, soft afternoon light.';
  const con = promptFinal(escena, { conCara: true });

  assert.ok(con.startsWith(escena), 'la escena va primero: es lo que decide la composición');
  assert.match(con, /identity reference/i, 'falta el bloqueo de identidad');
  assert.match(con, /clothing exactly/i, 'la ropa la trae la foto, y hay que pedirlo');
  assert.match(con, /soft ambient daylight/i, 'falta el antídoto de luz del C5');
  assert.match(con, /no dramatic flash/i, 'el C5 crudo quema los altos en interior');
  assert.match(con, /visible pores/i, 'falta el bloque de realismo del 6C');
  assert.match(con, /No text, no watermark/i, 'falta el negative prompt');
});

test('sin cara elegida NO se pide preservar identidad', () => {
  // Pedirle que respete «la referencia» cuando la referencia es la que quedó de
  // lo último que la persona hizo a mano en Flow es pedirle que copie a un
  // desconocido. Sin cara propia, mejor que el modelo componga libre.
  const sin = promptFinal('A tidy modern office at midday.', { conCara: false });
  assert.doesNotMatch(sin, /identity reference/i);
  // La luz y el realismo NO dependen de la cara: van siempre.
  assert.match(sin, /soft ambient daylight/i);
  assert.match(sin, /visible pores/i);
});

test('⚠️ el bloque constante NO puede pasar por el guard de caras', () => {
  // Es la razón por la que se concatena DESPUÉS y no se le pide al modelo.
  // `mencionaCara` prohíbe `facial` y `freckles` para que el modelo no invente
  // una persona; el método validado los usa para lo contrario — para pedir que
  // RESPETE la de la foto. Si algún día alguien mueve este texto al prompt del
  // modelo, este test le explica en el acto por qué se rechaza todo el lote.
  const marcas = mencionaCara(promptFinal('x'.repeat(40), { conCara: true }));
  assert.ok(
    marcas.length > 0,
    'si esto deja de marcar, el guard cambió y hay que revisar dónde se concatena el método',
  );
});

test('el prompt del FORMATO gana entero, sin concatenarle el generico', () => {
  // Trae su propia identidad, su propia luz y su propio negativo. Pegarle además
  // el bloque genérico serían dos instrucciones para lo mismo, y el modelo elige
  // — que es el modo de falla que este prompt vino a cerrar.
  const p = promptFinal('lo que escribio el modelo', { conCara: true, puestaId: 'selfie-movimiento' });
  assert.ok(p.startsWith('Mantén a la persona totalmente inalterada'));
  assert.doesNotMatch(p, /lo que escribio el modelo/);
  assert.doesNotMatch(p, /visible pores/, 'no se le concatena el bloque generico');
  assert.match(p, /VENTANILLAS/, 'el prompt del formato viaja completo');
});

test('un formato SIN prompt propio cae al camino de antes', () => {
  const p = promptFinal('A tidy office.', { conCara: true, puestaId: 'plano-secuencia' });
  assert.ok(p.startsWith('A tidy office.'));
  assert.match(p, /visible pores/);
});

test('⚠️ el prompt del formato tampoco puede pasar por el guard de caras', () => {
  // Dice «mismo rostro», «mismo cabello», «misma sonrisa» — y tiene que decirlo:
  // ahí esas palabras FIJAN a la persona de la foto en vez de inventar una. Por
  // eso lo concatena el código y no lo escribe el modelo.
  const marcas = mencionaCara(PROMPT_IMAGEN['selfie-movimiento']);
  assert.ok(marcas.length > 0, 'si esto deja de marcar, revisar donde se concatena');
});
