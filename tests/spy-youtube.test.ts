// =============================================================================
// El lector de canal de YouTube: tres llamadas, ninguna a `search.list`
// =============================================================================
// Lo que este archivo cuida es el camino, no el resultado: `search.list` tiene un balde propio de
// **100 LLAMADAS POR DÍA para TODA la app** desde el 1/6/2026 (no por usuario, no por workspace), y
// una sola feature con forma de buscador lo consume entero. El camino que escala es
// `channels.list` → el playlist de subidas LEÍDO de la API → `playlistItems` → `videos.list` en
// lotes de 50, y acá se afirma que es ese, con un `fetch` falso que anota a dónde se llamó.
//
// Las otras cuatro cosas que se afirman, cada una porque una fuente devuelve algo que no es un error:
//   · HTTP 200 con `items: []` es «ese canal no existe», no un fallo de red;
//   · un 403 de CUOTA («volvé mañana») no es un 403 de permiso, y la pantalla dice cosas distintas;
//   · las etiquetas de un video ajeno vienen por `videos.list` y por ningún otro endpoint;
//   · ningún contador sale en 0 cuando la API no lo devolvió.
//
// ⚠️ Nada acá sale a la red: `traerVideosDelCanal` recibe el `fetch` por parámetro.
//
// Verificado ROMPIÉNDOLO (31/10/2026, de a UNA rotura por vez, restaurando de una copia del
// scratchpad —nunca con `git checkout --`— y comprobando por hash que el archivo volvió igual).
// Base 9 pasan / 0 fallan, y cada rotura cayó en el assert que le corresponde:
//   · el playlist de subidas derivado con `'UU' + id.slice(2)` en vez de leído de la API  → 8 / 1
//   · `leerCanal` devolviendo 'error' en vez de 'no-esta' con HTTP 200 y lista vacía      → 8 / 1
//   · `leerCanal` tratando un 403 de cuota como un 403 de permiso                         → 8 / 1
//   · `leerVideos` poniendo `?? 0` en los contadores que la API no devolvió               → 8 / 1
//   · `leerVideos` dejando de leer `snippet.tags`                                         → 8 / 1
//   · `lotesDe` devolviendo la lista entera en un solo lote                               → 8 / 1
//   · el lector siguiendo con media lista cuando un lote de `videos.list` falla           → 8 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOTE, RUTAS_PERMITIDAS, canalDeUrl, leerCanal, leerIdsDeSubidas, leerVideos, lotesDe,
  noPudeLeerCanal, traerVideosDelCanal,
} from '../lib/spy-youtube';

/** Un `fetch` falso que anota las URL a las que se llamó y contesta lo que se le diga. */
function fetchFalso(respuestas: Array<{ status: number; cuerpo: unknown }>) {
  const vistas: string[] = [];
  let i = 0;
  const buscar = async (url: string): Promise<Response> => {
    vistas.push(url);
    const r = respuestas[Math.min(i, respuestas.length - 1)];
    i += 1;
    return { status: r.status, json: async () => r.cuerpo } as Response;
  };
  return { buscar, vistas };
}

const CANAL_OK = {
  items: [{
    id: 'UCabcdefghijklmnopqrstuv',
    snippet: { title: 'Un canal', description: 'de alguien' },
    statistics: { subscriberCount: '12000', viewCount: '900000', videoCount: '240' },
    // El playlist de subidas NO es `UU` + el resto del id: se lee de acá.
    contentDetails: { relatedPlaylists: { uploads: 'PLotraCosaDistinta' } },
  }],
};

test('un canal se reconoce por su enlace, su @ o su id, y lo que no se puede resolver no se adivina', () => {
  assert.deepEqual(canalDeUrl('UCabcdefghijklmnopqrstuv'), { id: 'UCabcdefghijklmnopqrstuv' }, 'un id pegado dejó de reconocerse');
  assert.deepEqual(canalDeUrl('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'), { id: 'UCabcdefghijklmnopqrstuv' }, 'un enlace /channel/ dejó de reconocerse');
  assert.deepEqual(canalDeUrl('@alguien'), { handle: 'alguien' }, 'un @ suelto dejó de reconocerse');
  assert.deepEqual(canalDeUrl('youtube.com/@alguien'), { handle: 'alguien' }, 'un enlace con @ dejó de reconocerse');
  assert.deepEqual(canalDeUrl('https://youtube.com/user/viejo'), { usuario: 'viejo' }, 'un /user/ viejo dejó de reconocerse');
  // ⚠️ `/c/<alias>` queda afuera A PROPÓSITO: no hay endpoint que lo resuelva, y el que lo
  // resolvía era `search.list`. Devolver `null` hace que la pantalla pida el enlace del canal;
  // adivinar el id haría una llamada que no encuentra nada y se leería como «canal vacío».
  assert.equal(canalDeUrl('https://youtube.com/c/UnAlias'), null, 'se adivinó un canal a partir de un /c/<alias>, que ningún endpoint resuelve');
  assert.equal(canalDeUrl('https://vimeo.com/algo'), null, 'un enlace de otra plataforma pasó como canal de YouTube');
  assert.equal(canalDeUrl(''), null, 'un texto vacío pasó como canal');
});

test('los ids se piden en lotes, que es lo que convierte 500 videos en 10 unidades de cuota', () => {
  assert.equal(LOTE, 50, 'cambió el tamaño del lote, que es el máximo que aceptan channels.list, playlistItems y videos.list');
  const ciento = Array.from({ length: 120 }, (_, i) => `v${i}`);
  const lotes = lotesDe(ciento);
  assert.equal(lotes.length, 3, `los ids dejaron de agruparse: ${lotes.length} llamadas donde entran 3, y cada una gasta cuota`);
  assert.equal(lotes[0].length, 50, 'el primer lote dejó de llenarse');
  assert.equal(lotes[2].length, 20, 'el último lote perdió ids');
  assert.deepEqual(lotes.flat(), ciento, 'agrupar en lotes perdió o reordenó ids');
  assert.deepEqual(lotesDe([]), [], 'una lista vacía produjo un lote vacío, que gastaría una llamada por nada');
});

test('HTTP 200 con una lista vacía es «ese canal no existe», no un fallo', () => {
  // Es la misma forma que la Ad Library: la fuente contesta bien y devuelve nada. Tratarlo como un
  // error manda a revisar la clave; tratarlo como «vacío» dice que el canal no publicó nada.
  const r = leerCanal(200, { items: [] });
  assert.equal(r.ok, false, 'un canal que no existe se leyó como leído');
  assert.equal(r.ok === false && r.motivo, 'no-esta', 'un 200 con lista vacía se confundió con un error de la API');
});

test('un 403 de cuota y un 403 de permiso dicen cosas distintas', () => {
  const cuota = leerCanal(403, { error: { errors: [{ reason: 'quotaExceeded' }] } });
  assert.equal(cuota.ok === false && cuota.motivo, 'cuota', 'un 403 por cuota agotada se leyó como falta de permiso: la pantalla mandaría a revisar la clave en vez de a volver mañana');
  const permiso = leerCanal(403, { error: { errors: [{ reason: 'forbidden' }] } });
  assert.equal(permiso.ok === false && permiso.motivo, 'sin-permiso', 'un 403 de permiso se leyó como cuota agotada');
  // Y los dos mensajes que lee la persona son distintos y dicen qué hacer.
  assert.notEqual(noPudeLeerCanal('cuota'), noPudeLeerCanal('sin-permiso'), 'los dos 403 le dicen lo mismo a la persona, así que no sabe qué hacer');
  assert.match(noPudeLeerCanal('cuota'), /mañana/i, 'el mensaje de cuota agotada dejó de decir cuándo volver');
  assert.match(noPudeLeerCanal('sin-clave'), /conect/i, 'el mensaje de falta de clave dejó de decir qué hacer');
});

test('las etiquetas y los contadores de un video salen de videos.list, y lo ausente no es cero', () => {
  const videos = leerVideos({
    items: [
      {
        id: 'v1',
        snippet: {
          title: 'Un video', description: 'algo', publishedAt: '2026-10-01T00:00:00Z',
          // ⚠️ `tags` viene por `videos.list` y por NINGÚN otro endpoint. El síntoma («la API no da
          // las etiquetas de otros canales») se diagnostica como un permiso y es el endpoint.
          tags: ['uno', 'dos'],
          thumbnails: { high: { url: 'https://i.ytimg.com/alta.jpg' }, default: { url: 'https://i.ytimg.com/chica.jpg' } },
        },
        statistics: { viewCount: '5000', likeCount: '120', commentCount: '7' },
        contentDetails: { duration: 'PT4M13S' },
      },
      {
        // Un video al que el dueño le escondió todo: la API OMITE los campos, no devuelve 0.
        id: 'v2',
        snippet: { title: 'Sin números', description: '', publishedAt: '2026-10-02T00:00:00Z' },
        statistics: {},
        contentDetails: {},
      },
    ],
  });
  assert.equal(videos.length, 2, 'se perdió un video al leer la respuesta');
  assert.deepEqual(videos[0].etiquetas, ['uno', 'dos'], 'se perdieron las etiquetas, que son el único endpoint que las da');
  assert.equal(videos[0].vistas, 5_000, 'un contador que vino como texto no se leyó');
  assert.equal(videos[0].miniatura, 'https://i.ytimg.com/alta.jpg', 'se eligió una miniatura más chica que la que había');
  assert.equal(videos[0].duracion, 'PT4M13S', 'se perdió la duración');
  // El video sin números: TODO null, ni un cero.
  assert.equal(videos[1].vistas, null, 'un contador que la API no devolvió salió en 0: la pantalla diría «0 vistas» sobre un video que puede tener miles');
  assert.equal(videos[1].megusta, null, 'un «me gusta» que la API no devolvió salió en 0');
  assert.equal(videos[1].comentarios, null, 'un comentario que la API no devolvió salió en 0');
  assert.deepEqual(videos[1].etiquetas, [], 'un video sin etiquetas produjo algo que no es una lista vacía');
  assert.equal(videos[1].miniatura, null, 'se inventó una miniatura para un video que no la trae');
  // Y `dislikeCount` no se lee NUNCA: YouTube no devuelve el campo desde el 13/12/2021.
  assert.ok(!Object.keys(videos[0]).some((k) => /dislike|no_?megusta/i.test(k)), 'apareció un campo de «no me gusta», que YouTube no devuelve: saldría siempre en 0');
});

test('los ids de las subidas se leen del playlist, sin repetirse', () => {
  const ids = leerIdsDeSubidas({ items: [{ contentDetails: { videoId: 'a' } }, { contentDetails: { videoId: 'b' } }, { contentDetails: { videoId: 'a' } }, {}] });
  assert.deepEqual(ids, ['a', 'b'], 'los ids de las subidas se repitieron o se perdieron: un id repetido gasta cuota dos veces por el mismo video');
});

test('el lector hace tres llamadas, en orden, y el playlist de subidas lo LEE de la API', async () => {
  const { buscar, vistas } = fetchFalso([
    { status: 200, cuerpo: CANAL_OK },
    { status: 200, cuerpo: { items: [{ contentDetails: { videoId: 'v1' } }] } },
    { status: 200, cuerpo: { items: [{ id: 'v1', snippet: { title: 'T', publishedAt: '2026-10-01T00:00:00Z' }, statistics: { viewCount: '10' }, contentDetails: {} }] } },
  ]);
  const r = await traerVideosDelCanal({ id: 'UCabcdefghijklmnopqrstuv' }, 'clave-falsa', buscar);
  assert.equal(r.ok, true, `el lector no pudo leer un canal que contestó bien: ${r.ok === false ? r.detalle : ''}`);
  assert.equal(vistas.length, 3, `el lector hizo ${vistas.length} llamadas donde el camino que escala hace 3`);
  // Las tres rutas, en orden, y ninguna es un buscador.
  for (const [i, ruta] of RUTAS_PERMITIDAS.entries()) {
    assert.ok(vistas[i].includes(`/youtube/v3/${ruta}?`), `la llamada ${i + 1} dejó de ser ${ruta}: el camino que escala es channels → playlistItems → videos`);
  }
  assert.ok(!vistas.some((u) => u.includes('/youtube/v3/search')), 'el lector llamó a search.list, que tiene 100 llamadas por día para TODA la app');
  // ⚠️ El playlist que se pide es el que DIJO la API, no `UU` + el id del canal. El atajo funciona
  // en la mayoría de los canales, y el que falla devuelve una lista vacía que se lee como «no subió
  // nada» — un fallo en silencio.
  assert.ok(vistas[1].includes('playlistId=PLotraCosaDistinta'), 'el playlist de subidas se derivó del id del canal en vez de leerse de la API: el canal donde el atajo falla queda como vacío, sin dar error');
  assert.ok(!vistas[1].includes('UUabcdefghijklmnopqrstuv'), 'se pidió el playlist derivado de UC→UU, que no es el que declaró la API');
});

test('si un lote de videos falla, el lector no devuelve media lista', async () => {
  // Media lista se lee como «subió 25 videos», y a partir de ahí el promedio del canal, el outlier y
  // la línea de tiempo salen todos mal sin que nada avise.
  const { buscar } = fetchFalso([
    { status: 200, cuerpo: CANAL_OK },
    { status: 200, cuerpo: { items: [{ contentDetails: { videoId: 'v1' } }] } },
    { status: 500, cuerpo: { error: { message: 'se cayó' } } },
  ]);
  const r = await traerVideosDelCanal({ id: 'UCabcdefghijklmnopqrstuv' }, 'clave-falsa', buscar);
  assert.equal(r.ok, false, 'un lote de videos que falló devolvió una lista parcial como si estuviera completa');
});

test('sin clave no se sale a la red', async () => {
  const { buscar, vistas } = fetchFalso([{ status: 200, cuerpo: CANAL_OK }]);
  const r = await traerVideosDelCanal({ id: 'UCabcdefghijklmnopqrstuv' }, '', buscar);
  assert.equal(r.ok === false && r.motivo, 'sin-clave', 'sin clave el lector no dijo que falta la clave');
  assert.equal(vistas.length, 0, 'se llamó a la API sin clave: cada llamada así es un 403 que gasta un reintento');
});
