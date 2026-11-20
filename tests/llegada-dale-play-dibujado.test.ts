// =============================================================================
// EL «DALE PLAY» DE LA LLEGADA, RECIÉN CON EL VIDEO DIBUJADO (20/11/2026, el Cerebro)
// =============================================================================
// El Cerebro recorrió 7736f219f en producción (ws 3): la página tardó unos 15 s en dibujarse (el arranque en frío del deploy) y,
// mientras tanto, la tarjeta «Tu recorrido por MaKo: dale play» salía desvanecida sobre la pantalla vacía. La marca oscurece todo
// menos el video, y el video era el cuadro vacío (`sbl-video__vacio`): el manifiesto de los videos o el póster todavía venían en
// camino. useDalePlay ya pedía el video A LA VISTA, pero «a la vista» mide el lugar en la pantalla, no si hay algo dibujado.
// Lo acordado: la tarjeta sale recién cuando el póster del video de la llegada cargó; nunca sobre la pantalla vacía.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { videoDibujado } from '../app/_ui/tutorial/entrada';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el video está dibujado sólo con SU póster cargado: sin manifiesto, sin póster o con el póster en camino, no', () => {
  assert.equal(videoDibujado({ poster: null, posterCargado: null }), false, 'el manifiesto todavía no llegó: el cuadro vacío');
  assert.equal(videoDibujado({ poster: undefined, posterCargado: null }), false, 'un video sin póster: el cuadro vacío');
  assert.equal(videoDibujado({ poster: '/tutoriales/recorrido.jpg', posterCargado: null }), false, 'el póster en camino');
  assert.equal(videoDibujado({ poster: '/tutoriales/recorrido.jpg', posterCargado: '/tutoriales/otro.jpg' }), false, 'cargó otro, no éste');
  assert.equal(videoDibujado({ poster: '/tutoriales/recorrido.jpg', posterCargado: '/tutoriales/recorrido.jpg' }), true);
});

test('2. la llegada marca el «dale play» recién con el video dibujado, y anota el póster cuando carga (también si ya estaba en caché)', () => {
  const l = sinComentarios(fuente('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(l, /useDalePlay\(play, \{ clave: 'recorrido', titulo: 'Tu recorrido por MaKo', activo: toca && fase === 'listo' && videoDibujado\(\{ poster, posterCargado \}\) \}\);/);
  assert.match(l, /const poster = video\?\.poster \?\? null;/);
  assert.match(l, /\{poster \? <img ref=\{imgPoster\} src=\{poster\} alt="" onLoad=\{\(\) => setPosterCargado\(poster\)\} \/> : <span className="sbl-video__vacio" \/>\}/);
  // Un póster que ya estaba en caché puede cargar antes de que React escuche: se mira `complete` al dibujarlo.
  assert.match(l, /if \(poster && el\?\.complete && el\.naturalWidth > 0\) setPosterCargado\(poster\);/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 2/0; al restaurar, 2/0). Cada rotura, de a una, cae:
//   - `videoDibujado` que da true sin póster (el cuadro vacío cuenta como dibujado) → 1
//   - `videoDibujado` que no compara CUÁL póster cargó → 1
//   - la llegada sin `videoDibujado` en el `activo` (la marca sobre la pantalla vacía, como en prod) → 2
//   - el póster sin `onLoad` → 2
