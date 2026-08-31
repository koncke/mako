// =============================================================================
// La consulta de estado de un clip: por qué va por PARCHE y no por cuerpo
// =============================================================================
// El 31/08/2026 la pantalla del dueño se quedó cinco minutos diciendo «Filmando
// la toma 1». En producción, cuatro consultas de estado seguidas habían fallado
// con HTTP 400 «Request contains an invalid argument», cinco intentos cada una.
//
// La causa no estaba en el endpoint ni en el id de la operación: estaba en que el
// pedido viajaba como CUERPO. El espejo funde nuestro cuerpo con el que manda la
// propia página de Flow, y `fundir()` reemplaza los arrays enteros — así que
// `{ operations: [...] }` no agregaba nuestra operación al pedido de Flow, TIRABA
// el de Flow y dejaba el nuestro.
//
// Este archivo fija las tres piezas del arreglo. Las tres son cosas que, cuando se
// rompen, NO dan error: dan una respuesta.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parchesEstadoClip } from '../lib/flow-protocolo';

const FUENTE = readFileSync(join(process.cwd(), 'extension/injected.js'), 'utf8');

/**
 * Saca una función del fuente REAL de la extensión y la vuelve llamable.
 *
 * Igual que `tests/espejo-parchar.test.ts`: lo que hay que auditar es el código
 * que se distribuye, no una copia escrita al lado que se queda vieja.
 */
function traer<T>(nombre: string): T {
  const ini = FUENTE.indexOf(`function ${nombre}(`);
  assert.ok(ini > 0, `${nombre}() ya no está en extension/injected.js: el test quedó viejo`);
  const desde = FUENTE.indexOf('{', ini);
  let d = 0;
  let fin = -1;
  for (let i = desde; i < FUENTE.length; i++) {
    if (FUENTE[i] === '{') d++;
    else if (FUENTE[i] === '}') { d--; if (d === 0) { fin = i + 1; break; } }
  }
  assert.ok(fin > 0, `no se pudo delimitar ${nombre}()`);
  // eslint-disable-next-line no-new-func
  return new Function(`${FUENTE.slice(ini, fin)}; return ${nombre};`)() as T;
}

const fundir = traer<(a: unknown, b: unknown) => Record<string, unknown>>('fundir');
const parchar = traer<(c: unknown, camino: string, v: unknown) => boolean>('parchar');
const puedeUsarCache = traer<
  (sl: boolean, c: unknown, p: unknown, cache: unknown, ahora: number) => boolean
>('puedeUsarCache');

/**
 * Una plantilla realista: el pedido que hace la propia página de Flow.
 *
 * ⚠️ Los campos de adentro de `operations[0]` que NO son `operation` están acá a
 * propósito y con nombres inventados. NO se afirma que Flow mande exactamente
 * éstos —no está medido, porque el espía cortaba el cuerpo de esta clase a 200
 * caracteres—. Lo que el test fija es la PROPIEDAD: sea lo que sea que Flow ponga
 * al lado del `name`, tiene que sobrevivir. Un test que dependiera de los nombres
 * exactos estaría afirmando algo que no se midió.
 */
const PLANTILLA_DE_FLOW = {
  clientContext: { projectId: 'p-real', tool: 'PINHOLE', sessionId: ';123' },
  operations: [
    {
      operation: { name: 'operacion-vieja' },
      sceneId: 'algo-que-no-sabemos-que-existe',
      mediaGenerationId: 'otro-mas',
    },
  ],
};

test('el CUERPO pisa el array de Flow: es la causa medida del HTTP 400', () => {
  // Esto es lo que se hacía antes. Se deja fijado para que la próxima persona vea
  // POR QUÉ no se puede volver, sin tener que reproducir el 400 en producción.
  const roto = fundir(PLANTILLA_DE_FLOW, {
    operations: [{ operation: { name: 'la-nuestra' } }],
  });
  const ops = roto.operations as Array<Record<string, unknown>>;

  assert.equal(ops.length, 1);

  // ⚠️ SE AFIRMA SOBRE LAS CLAVES, no con un `deepEqual` contra el objeto.
  //
  // `assert.deepEqual` de node:assert/strict está tipado como
  // `asserts actual is T`, así que ESTRECHA la variable al literal que se le pasa
  // — y después mirar un campo hermano deja de compilar, sobre el mismo objeto que
  // el test existe para inspeccionar. Guardar la referencia en otra variable no
  // alcanza: el estrechamiento la sigue.
  //
  // Y de paso la aserción queda mejor: lo que se está afirmando es exactamente
  // que NO quedó nada más que `operation`, que es el daño.
  const primera = ops[0];
  assert.deepEqual(Object.keys(primera).sort(), ['operation']);
  assert.equal((primera.operation as { name: string }).name, 'la-nuestra');
});

test('el PARCHE cambia el nombre y no toca a sus hermanos', () => {
  const cuerpo = JSON.parse(JSON.stringify(PLANTILLA_DE_FLOW));
  for (const [camino, valor] of Object.entries(parchesEstadoClip('la-nuestra'))) {
    assert.ok(parchar(cuerpo, camino, valor), `el parche ${camino} no se pudo aplicar`);
  }

  const op = cuerpo.operations[0];
  assert.equal(op.operation.name, 'la-nuestra');
  // Y lo que no sabemos que existe sigue ahí, que es el punto entero de copiar el
  // pedido en vez de reconstruirlo.
  assert.equal(op.sceneId, 'algo-que-no-sabemos-que-existe');
  assert.equal(op.mediaGenerationId, 'otro-mas');
  assert.equal(cuerpo.clientContext.projectId, 'p-real');
});

test('el parche sobrevive a una plantilla sin operations', () => {
  // Si la página de Flow todavía no preguntó por ninguna operación, el array puede
  // no existir. El parche tiene que CREARLO y no reventar: quedarse sin preguntar
  // es peor que preguntar con lo mínimo.
  const cuerpo: Record<string, unknown> = { clientContext: { tool: 'PINHOLE' } };
  for (const [camino, valor] of Object.entries(parchesEstadoClip('la-nuestra'))) {
    assert.ok(parchar(cuerpo, camino, valor));
  }
  assert.deepEqual(cuerpo.operations, [{ operation: { name: 'la-nuestra' } }]);
});

test('la cache NO contesta un pedido que lleva parches', () => {
  const cache = { status: 200, texto: '{}', cuando: 1_000 };
  const ahora = 1_500;

  // Un GET pelado sin parámetros: la respuesta de la página sirve, y ahorra
  // tráfico contra la sesión de Google del cliente.
  assert.equal(puedeUsarCache(true, null, null, cache, ahora), true);

  // ⚠️ Con parches NO. Un parche es un parámetro —el más específico que hay— así
  // que la respuesta guardada contesta OTRA pregunta. Cuando esto se equivoca no
  // falla: devuelve los videos que el dueño generó a mano, la pantalla no
  // encuentra su operación ahí adentro y sigue esperando para siempre. Ya pasó una
  // vez con el cuerpo; el guard sólo miraba el cuerpo.
  assert.equal(puedeUsarCache(true, null, parchesEstadoClip('x'), cache, ahora), false);
  assert.equal(puedeUsarCache(true, { operations: [] }, null, cache, ahora), false);

  // Un objeto de parches VACÍO no es un parámetro: no cambia nada del pedido.
  assert.equal(puedeUsarCache(true, null, {}, cache, ahora), true);

  // Y lo de siempre: sin cache, o vencida, se pregunta de verdad.
  assert.equal(puedeUsarCache(true, null, null, null, ahora), false);
  assert.equal(puedeUsarCache(true, null, null, cache, 1_000 + 120_001), false);
  // Lo que ESCRIBE nunca se contesta con una respuesta vieja.
  assert.equal(puedeUsarCache(false, null, null, cache, ahora), false);
});

test('el espía no corta el cuerpo de la clase que hay que leer', () => {
  // El cuerpo de una plantilla se recorta a 200 caracteres salvo para las clases
  // que generan. El filtro decía `/generate|Generate/`, y la clase de la consulta
  // de estado es `video:batchCheckAsyncVideoGenerationStatus`: dice «Generation»,
  // no «Generate». Resultado: el único contrato que faltaba medir llegaba
  // decapitado, y por eso el 400 se investigó a ciegas.
  const CLASES = [
    'video:batchCheckAsyncVideoGenerationStatus',
    'video:batchAsyncGenerateVideoReferenceImages',
    'flowMedia:batchGenerateImages',
  ];
  const filtros = FUENTE.match(/\/generat[^/]*\/i?\.test\(clase\)/g) ?? [];
  assert.ok(filtros.length > 0, 'ya no hay filtro por clase en injected.js');

  for (const f of filtros) {
    const re = new RegExp(
      f.slice(1, f.lastIndexOf('/')),
      f.includes('/i.') ? 'i' : '',
    );
    for (const clase of CLASES) {
      assert.ok(re.test(clase), `el filtro ${f} deja fuera a ${clase}: su cuerpo se corta a 200`);
    }
  }
});
