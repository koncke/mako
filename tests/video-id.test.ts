// =============================================================================
// UN video, UN id — el control, no el arreglo
// =============================================================================
// El arreglo de un caso concreto (el VSL de un cliente que se medía dos veces) ya
// está hecho. Esto es lo otro que pidió Martín el 27/09/2026: «es error nuestro
// permitir que un mismo video pueda tener varios ID, eso debemos controlarlo para
// que esto no pase». Un control es lo que falla cuando alguien lo vuelve a hacer.
//
// Los tres puntos que fija, en orden de lo que más cuesta si se rompe:
//   1. El BEACON canoniza. Es lo único que alcanza a los clientes con código
//      viejo: al 27/09 ninguno corría la versión con el snippet arreglado —el ws1
//      estaba en la v14 con 3.304 visitas— y el duplicado seguía naciendo en
//      producción DESPUÉS de arreglar el snippet y DESPUÉS de borrar el histórico.
//   2. El CATÁLOGO canoniza, así que esconder, nombrar y desnombrar comparan
//      identidades y no strings parecidos.
//   3. El SNIPPET no puede estrenar un prefijo sin declararlo acá.
//
// Probado rompiéndolo — con el arreglo puesto, 7 pasan y 0 fallan; rotas de a una:
//   · el beacon vuelve a `texto(payload.video_id, 120)`   -> 6 pasan / 1 falla
//   · el catálogo vuelve a `limpiar(o.id, 120)`           -> 6 / 1
//   · el analizador vuelve a emitir `wistia:`             -> 6 / 1
//   · se saca el alias `wistia-player:` de la tabla       -> 5 / 2
//   · `idDeclaraHost` vuelve a ser /^[a-z]{1,6}:/i        -> 6 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALIAS_VIDEO_ID, PREFIJOS_CANONICOS, canonizarVideoId, esIdPosicional, idDeclaraHost,
} from '../lib/video-id';
import { conOculto, sinOculto, parsearOcultos, parsearVideos, conVideo } from '../lib/landing-videos';
import { videosDeHtml, HOSTS_VIDEO, hostDeVideoId } from '../lib/landing-analisis';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8');
const sinComentarios = (t: string) =>
  t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('ningún alias sobrevive a canonizar', () => {
  for (const al of ALIAS_VIDEO_ID) {
    assert.equal(canonizarVideoId(`${al.de}y4reukhgq8`), `${al.a}y4reukhgq8`, `${al.de} no colapsó`);
    // Y el canónico es un punto fijo: canonizar dos veces da lo mismo. Sin esto, un
    // alias que apunte a otro alias haría que el id dependa de cuántas veces pasó.
    const una = canonizarVideoId(`${al.de}abc`)!;
    assert.equal(canonizarVideoId(una), una, `${al.a} no es un punto fijo`);
    assert.ok(al.porque.trim().length > 60, `el alias ${al.de} tiene que explicar POR QUÉ es el mismo video`);
  }
  // La CLAVE no se toca: es el id del proveedor y distingue mayúsculas.
  assert.equal(canonizarVideoId('yt:dQw4w9WgXcQ'), 'yt:dQw4w9WgXcQ');
  assert.equal(canonizarVideoId('wistia-player:AbC123'), 'w:AbC123', 'la clave conserva el caso');
  // Un evento sin video no se inventa un id.
  assert.equal(canonizarVideoId(''), null);
  assert.equal(canonizarVideoId(null), null);
  assert.equal(canonizarVideoId(undefined), null);
});

test('⚠️ el BEACON canoniza: es lo único que alcanza a quien no repegó el código', () => {
  const r = sinComentarios(leer('app/api/track/vsl/route.ts'));
  assert.ok(
    /video_id:\s*canonizarVideoId\(payload\.video_id\)/.test(r),
    'el único insert de vsl_events.video_id tiene que canonizar. Sin esto el arreglo vive ' +
    'sólo en el snippet, y el snippet va PEGADO en la página del cliente: al 27/09/2026 ' +
    'ningún cliente corría la versión arreglada.',
  );
  assert.ok(
    !/video_id:\s*texto\(/.test(r),
    'quedó el saneo viejo (trim+slice), que no normaliza el prefijo',
  );
});

test('⚠️ el CATÁLOGO compara identidades, no strings parecidos', () => {
  // Esconder por el alias no puede agregar una segunda fila para el mismo video.
  assert.deepEqual(conOculto(['w:abc'], 'wistia-player:abc'), ['w:abc'], 'el alias se duplicó');
  // Y dejar de esconder tiene que encontrarlo aunque se pida por el alias.
  assert.deepEqual(sinOculto(['w:abc'], 'wistia-player:abc'), [], 'no lo encontró por el alias');
  assert.deepEqual(parsearOcultos('["wistia-player:abc","w:abc"]'), ['w:abc'], 'la lista guardada no colapsó');

  // El caso real: el VSL de un cliente estaba nombrado con un alias y su curva
  // salía vacía porque no cruzaba con ningún evento.
  const guardados = parsearVideos('[{"id":"wistia:y4reukhgq8","nombre":"VSL","esVsl":true}]');
  assert.deepEqual(guardados, [{ id: 'w:y4reukhgq8', nombre: 'VSL', esVsl: true }]);

  // Y nombrar por el alias renombra el que ya está, no agrega otro.
  const dos = conVideo([{ id: 'w:abc', nombre: 'VSL', esVsl: true }], { id: 'wistia-player:abc', nombre: 'VSL nuevo' });
  assert.equal(dos?.length, 1, 'nombrar por el alias creó un video nuevo');
  assert.equal(dos?.[0].esVsl, true, 'y perdió la marca de VSL');
});

test('⚠️ el ANALIZADOR del HTML emite el canónico, no su propio prefijo', () => {
  const id = (html: string) => videosDeHtml('https://x.com', html)[0]?.id;
  assert.equal(id('<iframe src="https://fast.wistia.net/embed/iframe/y4reukhgq8"></iframe>'), 'w:y4reukhgq8');
  // Y con las DOS formas en la misma página sale UNA sola fila: la deduplicación
  // compara identidades. Antes salían dos, y nombrar una no nombraba la otra.
  const dos = videosDeHtml(
    'https://x.com',
    '<wistia-player media-id="y4reukhgq8"></wistia-player>' +
    '<iframe src="https://fast.wistia.net/embed/iframe/y4reukhgq8"></iframe>',
  );
  assert.equal(dos.length, 1, `la misma media salió ${dos.length} veces: ${dos.map((v) => v.id).join(', ')}`);
  assert.ok(!sinComentarios(leer('lib/landing-analisis.ts')).includes('`wistia:${'), 'volvió a emitirse el prefijo viejo');
});

test('⚠️ el SNIPPET no puede estrenar un prefijo sin declararlo acá', () => {
  // Éste es el control contra la RECURRENCIA, y es el que importa: el bug no fue
  // que alguien escribiera mal un prefijo, fue que se agregó una rama nueva (el
  // enganche genérico por custom element, v16) que medía un elemento que otra rama
  // ya medía, con otro id. Nada falló hasta que un cliente lo reportó.
  const snippet = leer('lib/landing-token.ts');
  const conocidos = new Set<string>([...PREFIJOS_CANONICOS, ...ALIAS_VIDEO_ID.map((a) => a.de)]);

  const literales = new Set<string>();
  for (const m of snippet.matchAll(/'([a-z][a-z0-9-]{0,14}:)'\s*\+/g)) literales.add(m[1]);
  const nuevos = [...literales].filter((p) => !conocidos.has(p));
  assert.deepEqual(
    nuevos, [],
    `el snippet arma ids con prefijos que lib/video-id.ts no conoce: ${nuevos.join(', ')}. ` +
    'Si nombran un video que otra rama ya mide, va como alias en ALIAS_VIDEO_ID; si es un ' +
    'host nuevo, va en PREFIJOS_CANONICOS y en HOSTS_VIDEO.',
  );

  // Las construcciones DINÁMICAS son las peligrosas: no traen el prefijo escrito,
  // así que el chequeo de arriba no las ve. Hoy hay exactamente dos clases, y las
  // dos están cubiertas — `tag + ':'` es la familia por nombre de etiqueta (de ahí
  // salió `wistia-player:`) y `WN + ':'` es el `wistia:` escrito partido para que
  // el analizador de piezas no lo confunda con una marca de la página.
  const clases = new Set<string>();
  for (const m of snippet.matchAll(/([A-Za-z_$][\w$]*)\s*\+\s*':'\s*\+/g)) clases.add(m[1]);
  assert.deepEqual(
    [...clases].sort(), ['WN', 'tag'],
    `apareció una forma nueva de armar un id sin prefijo literal: ${[...clases].sort().join(', ')}. ` +
    'Cada una puede chocar con una rama existente — comprobá si mide un elemento que otra ' +
    'rama ya mide y, si sí, declarala en ALIAS_VIDEO_ID.',
  );
});

test('un id POR POSICIÓN no es una identidad, y se puede distinguir', () => {
  // Cinco ramas caen a un fallback posicional. Dos videos anónimos en dos páginas
  // distintas son ambos `iframe0`; reordenar la página cambia el número; y el de
  // Vimeo no tiene ni índice, así que TODOS los Vimeo no identificados son el mismo.
  for (const id of ['iframe0', 'iframe12', 'v:pos0', 'wistia-player:pos3', 'vimeo:iframe', 'wistia:iframe0']) {
    assert.ok(esIdPosicional(id), `${id} es un relleno por posición`);
  }
  for (const id of ['w:y4reukhgq8', 'yt:dQw4w9WgXcQ', 'v:vsl.mp4', '1b9db76c-6bbb-4837-8274-96896c3d8b47']) {
    assert.ok(!esIdPosicional(id), `${id} SÍ identifica un video`);
  }
});

test('⚠️ saber si un id declara su host: el regex contestaba mal y se inventaba un avance', () => {
  // `/^[a-z]{1,6}:/i` daba false para toda la familia por etiqueta (el guion no es
  // [a-z] y el prefijo pasa de 6 caracteres). Con false, esos ids caían al respaldo
  // «la única duración conocida» —que es la de Panda— y se les calculaba el
  // porcentaje con la duración de OTRO video.
  for (const id of ['wistia-player:abc', 'mux-player:abc', 'lite-youtube:abc', 'w:abc', 'wistia:abc',
                    'yt:abc', 'vimeo:1', 'v:a.mp4', 'drive:abc']) {
    assert.ok(idDeclaraHost(id), `${id} declara su host`);
  }
  // Un UUID pelado es de Panda, y ESA es la distinción que esto tiene que hacer.
  assert.ok(!idDeclaraHost('1b9db76c-6bbb-4837-8274-96896c3d8b47'), 'un UUID de Panda no lleva prefijo');
  assert.ok(!idDeclaraHost('iframe0'), 'un relleno posicional sin prefijo tampoco');
  assert.ok(!idDeclaraHost(''), '');

  // Y el catálogo de hosts tiene que resolver todo prefijo canónico: si uno queda
  // afuera, `hostDeVideoId` devuelve null, que no se lee como un error.
  for (const p of PREFIJOS_CANONICOS) {
    assert.ok(hostDeVideoId(`${p}abc`), `hostDeVideoId no reconoce el prefijo canónico ${p}`);
  }
  assert.equal(
    HOSTS_VIDEO.filter((h) => h.prefijo).length, PREFIJOS_CANONICOS.length,
    'HOSTS_VIDEO y PREFIJOS_CANONICOS tienen que declarar los MISMOS prefijos: si uno crece ' +
    'sin el otro, hay dos catálogos y el segundo se queda viejo',
  );
});
