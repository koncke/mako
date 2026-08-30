// =============================================================================
// El parche por camino del espejo
// =============================================================================
// `parchar()` vive en extension/injected.js, que no se puede importar: corre en
// el mundo de la página de Flow. Se extrae del fuente y se evalúa, igual que
// `tests/landing-snippet-emitido.test.ts` hace con el snippet del Pixel — porque
// lo que hay que auditar es el CÓDIGO QUE SE DISTRIBUYE, no una copia.
//
// Por qué merece test: es lo único del paso de imágenes que puede fallar en
// silencio. Si un parche escribe en la rama equivocada, el pedido sale igual, con
// el prompt viejo, y devuelve una imagen perfecta del escenario que nadie pidió.
// Eso no se lee como un error: se lee como una imagen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(join(process.cwd(), 'extension/injected.js'), 'utf8');

/** Saca `function parchar(...) { ... }` del fuente real y lo vuelve llamable. */
function traerParchar(): (cuerpo: unknown, camino: string, valor: unknown) => boolean {
  const ini = FUENTE.indexOf('function parchar(');
  assert.ok(ini > 0, 'parchar() ya no está en extension/injected.js: el test quedó viejo');
  // Cuenta llaves desde la primera, que es lo único robusto sin un parser.
  const desde = FUENTE.indexOf('{', ini);
  let d = 0;
  let fin = -1;
  for (let i = desde; i < FUENTE.length; i++) {
    if (FUENTE[i] === '{') d++;
    else if (FUENTE[i] === '}') { d--; if (d === 0) { fin = i + 1; break; } }
  }
  assert.ok(fin > 0, 'no se pudo delimitar parchar()');
  const cuerpo = FUENTE.slice(ini, fin);
  // eslint-disable-next-line no-new-func
  return new Function(`${cuerpo}; return parchar;`)() as ReturnType<typeof traerParchar>;
}

const parchar = traerParchar();

test('escribe una hoja anidada sin tocar a sus hermanas', () => {
  // El caso real: adentro de requests[0] conviven lo que decidimos nosotros y lo
  // que sólo sabe la plantilla. Perder una hermana es perder el modelo o la cara.
  const cuerpo = {
    useNewMedia: true,
    requests: [{
      imageModelName: 'IMAGEN_X',
      imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: 'la-cara' }],
      structuredPrompt: { parts: [{ text: 'viejo' }] },
      seed: 1,
    }],
  };
  assert.equal(parchar(cuerpo, 'requests.0.structuredPrompt', { parts: [{ text: 'nuevo' }] }), true);
  assert.deepEqual(cuerpo.requests[0].structuredPrompt, { parts: [{ text: 'nuevo' }] });
  // LO QUE MÁS IMPORTA: el modelo y la cara siguen ahí.
  assert.equal(cuerpo.requests[0].imageModelName, 'IMAGEN_X');
  assert.deepEqual(cuerpo.requests[0].imageInputs, [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: 'la-cara' }]);
  assert.equal(cuerpo.useNewMedia, true);
});

test('crea el camino cuando no existe, con objeto o array según el tramo', () => {
  const cuerpo: Record<string, unknown> = {};
  assert.equal(parchar(cuerpo, 'mediaGenerationContext.batchId', 'abc'), true);
  assert.deepEqual(cuerpo.mediaGenerationContext, { batchId: 'abc' });

  const otro: Record<string, unknown> = {};
  assert.equal(parchar(otro, 'requests.0.seed', 7), true);
  // El tramo siguiente es un número, así que el contenedor tiene que ser un ARRAY.
  // Con un objeto `{"0": …}` el servidor acepta el pedido y contesta otra cosa.
  assert.ok(Array.isArray(otro.requests));
  assert.equal((otro.requests as { seed: number }[])[0].seed, 7);
});

test('NO fuerza un índice sobre algo que no es un array', () => {
  // Escribir `{"0": …}` donde el contrato espera una lista produce un pedido que
  // el servidor acepta y responde cualquier cosa. Falla ruidoso, a propósito.
  const cuerpo = { requests: { noEsArray: true } };
  assert.equal(parchar(cuerpo, 'requests.0.seed', 7), false);
  assert.deepEqual(cuerpo.requests, { noEsArray: true }, 'y no deja el cuerpo a medias');
});

test('un camino vacío se rechaza en vez de escribir en la raíz', () => {
  const cuerpo = { a: 1 };
  assert.equal(parchar(cuerpo, '', 'x'), false);
  assert.equal(parchar(cuerpo, '   ', 'x'), false);
  assert.deepEqual(cuerpo, { a: 1 });
});

test('pisa un valor primitivo que estorba en el medio del camino', () => {
  // La plantilla puede traer un escalar donde nosotros esperamos una rama. Es
  // preferible reemplazarlo a fallar: el que manda es el camino que pedimos.
  const cuerpo: Record<string, unknown> = { requests: [{ structuredPrompt: 'un string suelto' }] };
  assert.equal(parchar(cuerpo, 'requests.0.structuredPrompt.parts', [{ text: 'hola' }]), true);
  assert.deepEqual(
    (cuerpo.requests as { structuredPrompt: { parts: unknown[] } }[])[0].structuredPrompt.parts,
    [{ text: 'hola' }],
  );
});

test('los parches del paso de imágenes apuntan a caminos que existen en el pedido real', () => {
  // El pedido REAL de Flow, medido en su bundle el 30/08/2026 (el call site, no el
  // esquema: elegir por esquema fue lo que produjo el 400 «Unknown name userInput»).
  const pedidoDeFlow = {
    clientContext: { projectId: 'p', tool: 'PINHOLE' },
    mediaGenerationContext: { batchId: 'de-flow' },
    useNewMedia: true,
    requests: [{
      clientContext: { projectId: 'p' },
      imageModelName: 'GEM_PIX_2',
      imageAspectRatio: 'IMAGE_ASPECT_RATIO_SQUARE',
      structuredPrompt: { parts: [{ text: 'lo que escribió la persona' }] },
      seed: 42,
      imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: 'su-cara' }],
      requestContext: {},
    }],
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parchesImagenEscena } = require('../lib/flow-imagen') as typeof import('../lib/flow-imagen');
  const parches = parchesImagenEscena({ prompt: 'a sunlit office', seed: 99, batchId: 'nuestro' });

  for (const [camino, valor] of Object.entries(parches)) {
    assert.equal(parchar(pedidoDeFlow, camino, valor), true, `el camino ${camino} no se pudo escribir`);
  }

  // Cambió lo nuestro…
  assert.deepEqual(pedidoDeFlow.requests[0].structuredPrompt, { parts: [{ text: 'a sunlit office' }] });
  assert.equal(pedidoDeFlow.requests[0].seed, 99);
  assert.equal(pedidoDeFlow.requests[0].imageAspectRatio, 'IMAGE_ASPECT_RATIO_PORTRAIT');
  assert.equal(pedidoDeFlow.mediaGenerationContext.batchId, 'nuestro');
  // …y NO se tocó nada de lo que sólo sabe la plantilla.
  assert.equal(pedidoDeFlow.requests[0].imageModelName, 'GEM_PIX_2');
  assert.deepEqual(pedidoDeFlow.requests[0].imageInputs, [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: 'su-cara' }]);
  assert.deepEqual(pedidoDeFlow.clientContext, { projectId: 'p', tool: 'PINHOLE' });
});

test('NINGÚN parche del paso de imágenes toca imageInputs', () => {
  // La cara sale de la plantilla, y a propósito: un id que copiamos puede quedar
  // viejo respecto del que Flow usa hoy. Si algún día alguien agrega un parche a
  // ese camino, que sea una decisión y no un descuido.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parchesImagenEscena } = require('../lib/flow-imagen') as typeof import('../lib/flow-imagen');
  const caminos = Object.keys(parchesImagenEscena({ prompt: 'x'.repeat(40), seed: 1, batchId: 'b' }));
  assert.ok(!caminos.some((c) => c.includes('imageInputs')), caminos.join(', '));
});

test('regenerar da OTRA semilla, que es lo que hace que el boton sirva', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { semillaDeEscena } = require('../lib/flow-imagen') as typeof import('../lib/flow-imagen');
  // Lo que importa de una semilla acá NO es que sea única entre escenas —dos
  // escenas con la misma semilla y prompts distintos dan imágenes distintas— sino
  // que un intento nuevo de LA MISMA escena de algo nuevo. Sin eso, «generarla
  // otra vez» es un botón que no hace nada.
  //
  // El test original exigía cero colisiones entre 320 semillas en un espacio de
  // 100.000, que por el problema del cumpleaños falla ~40% de las veces: fijaba
  // una propiedad que ni hace falta ni se cumple.
  for (let escena = 1; escena <= 8; escena++) {
    const seguidos = [1, 2, 3, 4, 5].map((i) => semillaDeEscena('plan-1', escena, i));
    assert.equal(new Set(seguidos).size, seguidos.length, `la escena ${escena} repite semilla al reintentar`);
  }
});

test('la misma escena y el mismo intento dan SIEMPRE la misma semilla', () => {
  // Sin esto, «lo generé de nuevo y salió distinto» sería indistinguible de
  // «cambié el prompt y salió distinto».
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { semillaDeEscena } = require('../lib/flow-imagen') as typeof import('../lib/flow-imagen');
  assert.equal(semillaDeEscena('plan-1', 2, 3), semillaDeEscena('plan-1', 2, 3));
  assert.notEqual(semillaDeEscena('plan-1', 2, 3), semillaDeEscena('plan-2', 2, 3));
});
