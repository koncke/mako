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
 * El pedido que hace la propia página de Flow, MEDIDO.
 *
 * ⚠️ Esto ya no es una maqueta plausible: es el cuerpo real, capturado por el
 * espejo y leído del servidor el 31/08/2026. Importa que sea el de verdad, porque
 * durante todo ese día se mandó `{"operations":[{"operation":{"name":…}}]}` —una
 * clave que Flow no tiene— contra un endpoint cuyo campo se llama `media`. Un
 * test escrito sobre la forma inventada habría pasado en verde mientras
 * producción devolvía HTTP 400.
 */
const PLANTILLA_DE_FLOW = {
  media: [
    { name: 'media-vieja', projectId: 'p-real' },
  ],
};

test('el campo se llama `media`, no `operations`', () => {
  // La causa medida del 400: se mandaba una clave que este endpoint no tiene.
  // `fundir` la agregaba AL LADO de la de Flow, así que salía un pedido con
  // `media` (el de Flow, apuntando a otro video) y `operations` (el nuestro,
  // inexistente). Google contestó lo único que podía.
  const roto = fundir(PLANTILLA_DE_FLOW, {
    operations: [{ operation: { name: 'la-nuestra' } }],
  });
  assert.ok('operations' in roto, 'la clave inventada viajaba');
  const media = roto.media as Array<Record<string, unknown>>;
  assert.equal(media[0]?.name, 'media-vieja', 'y encima preguntaba por el video de antes');

  // Lo que se manda ahora nombra el campo correcto y ninguno más.
  assert.deepEqual(Object.keys(parchesEstadoClip('la-nuestra')), ['media.0.name']);
});

test('el CUERPO reemplaza el array entero: por eso va por parche', () => {
  // La razón por la que ni siquiera con el nombre correcto se puede mandar un
  // cuerpo: `fundir` reemplaza los arrays, así que el `projectId` que la
  // plantilla trae al lado del `name` desaparecería.
  const roto = fundir(PLANTILLA_DE_FLOW, { media: [{ name: 'la-nuestra' }] });
  const media = roto.media as Array<Record<string, unknown>>;
  const primera = media[0];
  assert.deepEqual(Object.keys(primera).sort(), ['name']);
  assert.equal(primera.projectId, undefined, 'el projectId se perdió con el reemplazo');
});

test('el PARCHE cambia el nombre y conserva el projectId', () => {
  const cuerpo = JSON.parse(JSON.stringify(PLANTILLA_DE_FLOW));
  for (const [camino, valor] of Object.entries(parchesEstadoClip('la-nuestra'))) {
    assert.ok(parchar(cuerpo, camino, valor), `el parche ${camino} no se pudo aplicar`);
  }
  assert.equal(cuerpo.media[0].name, 'la-nuestra');
  // El `projectId` sobrevive porque nunca lo tocamos. Es el punto entero de copiar
  // el pedido en vez de reconstruirlo: lo que no sabemos que existe viaja igual.
  assert.equal(cuerpo.media[0].projectId, 'p-real');
  assert.deepEqual(Object.keys(cuerpo), ['media']);
});

test('el parche sobrevive a una plantilla sin `media`', () => {
  // Si la página de Flow todavía no preguntó por ningún video, el array puede no
  // existir. El parche tiene que CREARLO y no reventar: preguntar con lo mínimo es
  // mejor que no preguntar — aunque sin el `projectId` de la plantilla esa
  // consulta probablemente falle, y ahí el mensaje ya dice qué hacer.
  const cuerpo: Record<string, unknown> = {};
  for (const [camino, valor] of Object.entries(parchesEstadoClip('la-nuestra'))) {
    assert.ok(parchar(cuerpo, camino, valor));
  }
  assert.deepEqual(cuerpo.media, [{ name: 'la-nuestra' }]);
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
