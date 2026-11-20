// =============================================================================
// EL «DALE PLAY» DE LA LLEGADA, RECIÉN CON EL VIDEO DIBUJADO (20/11/2026, el Cerebro)
// =============================================================================
// El Cerebro recorrió 7736f219f en producción (ws 3): la página tardó unos 15 s en dibujarse (el arranque en frío del deploy) y,
// mientras tanto, la tarjeta «Tu recorrido por MaKo: dale play» salía desvanecida sobre la pantalla vacía. La marca oscurece todo
// menos el video, y el video era el cuadro vacío (`sbl-video__vacio`): el manifiesto de los videos o el póster todavía venían en
// camino. useDalePlay ya pedía el video A LA VISTA, pero «a la vista» mide el lugar en la pantalla, no si hay algo dibujado.
// Lo acordado: la tarjeta sale recién cuando el póster del video de la llegada cargó; nunca sobre la pantalla vacía.
// Y el mismo criterio para CUALQUIER marca sobre un video (el Cerebro, esa noche): VideoDelMomento (la bienvenida, el WhatsApp y los
// coaches) y, en el reto, el video de cada día y el de muestra. Esos dibujan un `<video poster>`, que no avisa cuándo cargó su póster:
// app/_ui/tutorial/usePosterDibujado.ts pide el mismo archivo con un `Image`.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { videoDibujado } from '../app/_ui/tutorial/entrada';
import { esperarPoster } from '../app/_ui/tutorial/usePosterDibujado';

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

/** Un `Image` de mentira: carga cuando el test dice. */
const imagen = (enCache = false) => {
  const img = { onload: null as (() => void) | null, src: '', complete: enCache, naturalWidth: enCache ? 640 : 0 };
  return { img, crear: () => img as never, cargar: (ancho = 640) => { img.complete = true; img.naturalWidth = ancho; img.onload?.(); } };
};

test('3. esperarPoster: avisa cuando el póster cargó de verdad, enseguida si estaba en la caché, nunca roto ni después de irse', () => {
  let avisos = 0;
  const avisar = () => { avisos++; };
  // En camino: nada hasta que carga; al cargar, una vez, y pidió ESE archivo.
  const a = imagen();
  esperarPoster('/tutoriales/bienvenida.jpg', avisar, a.crear);
  assert.equal(avisos, 0, 'mientras viene en camino, no está dibujado');
  assert.equal(a.img.src, '/tutoriales/bienvenida.jpg');
  a.cargar();
  assert.equal(avisos, 1, 'al cargar, está dibujado');
  // En la caché: `complete` antes de escuchar el `load`, enseguida.
  avisos = 0;
  esperarPoster('/tutoriales/whatsapp.jpg', avisar, imagen(true).crear);
  assert.equal(avisos, 1, 'el póster en la caché cuenta enseguida');
  // Roto: cargó sin nada que dibujar.
  avisos = 0;
  const r = imagen();
  esperarPoster('/tutoriales/roto.jpg', avisar, r.crear);
  r.cargar(0);
  assert.equal(avisos, 0, 'un póster roto no cuenta');
  // El video se fue antes de que cargue: no avisa a nadie.
  avisos = 0;
  const f = imagen();
  const dejar = esperarPoster('/tutoriales/offer-coach.jpg', avisar, f.crear);
  dejar();
  f.cargar();
  assert.equal(avisos, 0, 'después de irse, nada');
});

test('4. el mismo criterio en todos los videos con marca: la bienvenida, el WhatsApp y los coaches (VideoDelMomento) y los del reto', () => {
  const h = sinComentarios(fuente('app/_ui/tutorial/usePosterDibujado.ts'));
  assert.match(h, /return esperarPoster\(poster, \(\) => setPosterCargado\(poster\)\);\n\s*\}, \[poster\]\);\n\s*return videoDibujado\(\{ poster, posterCargado \}\);/);
  const v = sinComentarios(fuente('app/_ui/tutorial/VideoDelMomento.tsx'));
  assert.match(v, /const dibujado = usePosterDibujado\(v\?\.poster\);\n\s*useDalePlay\(raiz, \{ clave, titulo, activo: dalePlay && !!v && estado === 'quieto' && !flotando && dibujado \}\);/);
  // Los que lo usan con `dalePlay`: la bienvenida y el WhatsApp del onboarding, y los dos coaches.
  const a = fuente('app/onboarding/ChatArranqueV2.tsx');
  assert.match(a, /<VideoDelMomento clave=\{VIDEO_BIENVENIDA\} [^>]*dalePlay \/>/);
  assert.match(a, /<VideoDelMomento clave=\{VIDEO_WHATSAPP\} [^>]*dalePlay \/>/);
  assert.equal((fuente('app/second-brain/VideoDelCoach.tsx').match(/<VideoDelMomento [^>]*\bdalePlay=\{dalePlay\}/g) ?? []).length, 2, 'los dos coaches');
  const r = sinComentarios(fuente('app/second-brain/reto/ChatDelReto.tsx'));
  assert.ok(r.includes('activo: dalePlay && conMarcas && !visto && !corre && posterDibujado });'), 'el video de cada día');
  assert.ok(r.includes('titulo: m.nombre, activo: !!v && posterDibujado });'), 'el video de muestra');
  assert.equal((r.match(/const posterDibujado = usePosterDibujado\(v\?\.poster\);/g) ?? []).length, 2);
  // Ningún «dale play» queda sin esperar al póster.
  for (const [f, s] of [['VideoDelMomento', v], ['ChatDelReto', r], ['LlegadaAlReto', sinComentarios(fuente('app/second-brain/LlegadaAlReto.tsx'))]] as const) {
    for (const l of s.match(/useDalePlay\([^;]*\);/g) ?? []) assert.match(l, /dibujado|Dibujado/, `${f}: un «dale play» que no espera al póster: ${l}`);
  }
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 4/0; al restaurar, 4/0). Cada rotura, de a una, cae:
//   - `videoDibujado` que da true sin póster (el cuadro vacío cuenta como dibujado) → 1
//   - `videoDibujado` que no compara CUÁL póster cargó → 1
//   - la llegada sin `videoDibujado` en el `activo` (la marca sobre la pantalla vacía, como en prod) → 2
//   - el póster sin `onLoad` → 2
//   - esperarPoster sin mirar `complete` (el de la caché nunca cuenta) → 3; sin mirar `naturalWidth` (el roto cuenta) → 3
//   - esperarPoster que avisa después de irse (la limpieza sin soltar el `onload`) → 3
//   - VideoDelMomento sin `dibujado` en el `activo` (la bienvenida, el WhatsApp y los coaches, sobre el cuadro negro) → 4
//   - el video de cada día del reto, o el de muestra, sin `posterDibujado` (cada uno por separado) → 4
