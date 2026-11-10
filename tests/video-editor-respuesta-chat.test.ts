// =============================================================================
// El chat del Video Editor no afirma lo que no hizo (9/11/2026)
// =============================================================================
// Medido en producción el 9/11/2026 (ws9, el proyecto «1109»): «Quita las muletillas del video» contestó «Aquí tienes la
// limpieza de muletillas para dejar el video al hueso.» con «No se aplica: no se identificaron muletillas» debajo y sin
// tarjeta; «Los subtítulos en amarillo y con la fuente Bebas Neue», «Cambiando los subtítulos…» con el mismo motivo tres
// veces. Fija app/video-editor/_opencut/chat/respuesta.ts:
//   · si el modelo propuso cambios y no quedó ninguno, el titular es «No cambié nada.» (la línea del ticket, si el server
//     la puso, se queda);
//   · si no propuso nada (una respuesta, «eso no existe»), su texto es la respuesta;
//   · los motivos, una vez cada uno.
//
// PROBADO ROMPIÉNDOLO (9/11/2026, cada uno dio rojo y se volvió atrás):
//   · `propuso === 0` → `propuso >= 0`: el titular afirmativo volvía (rojo el 1.º);
//   · sin la búsqueda de la línea del ticket: «Quedó el ticket #73…» se perdía (rojo el 1.º);
//   · `new Set(...)` → la lista tal cual: el motivo salía tres veces (rojo el 2.º).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIN_CAMBIOS, sinRepetir, textoSinCambios } from '../app/video-editor/_opencut/chat/respuesta';
import { rotuloProgresoSubtitulos } from '../app/video-editor/_opencut/subtitles/resultado';

test('con operaciones propuestas y ninguna aplicable, el titular no afirma: «No cambié nada.»', () => {
  assert.equal(textoSinCambios({ resumen: 'Aquí tienes la limpieza de muletillas para dejar el video al hueso.', propuso: 1 }), SIN_CAMBIOS);
  assert.equal(textoSinCambios({ resumen: 'Cambiando los subtítulos a fuente Bebas Neue y color amarillo.', propuso: 3 }), SIN_CAMBIOS);
  // La línea del ticket la escribe el server (lib/no-pude.ts): es un hecho y se queda.
  assert.equal(
    textoSinCambios({ resumen: 'Voy a poner la música. Quedó el ticket #73 para el equipo de MaKo.', propuso: 1 }),
    `${SIN_CAMBIOS} Quedó el ticket #73 para el equipo de MaKo.`,
  );
  // Sin operaciones, el texto del modelo ES la respuesta (una pregunta contestada, «eso no existe»).
  assert.equal(textoSinCambios({ resumen: 'Eso todavía no existe en MaKo. Quedó el ticket #73 para el equipo de MaKo.', propuso: 0 }), 'Eso todavía no existe en MaKo. Quedó el ticket #73 para el equipo de MaKo.');
  assert.equal(textoSinCambios({ resumen: '  ', propuso: 0 }), 'Sin cambios.');
  assert.equal(textoSinCambios({ resumen: null, propuso: 0 }), 'Sin cambios.');
});

test('mientras se generan los subtítulos, la tarjeta del chat dice qué hace (la misma frase del panel)', () => {
  // Medido el 9/11/2026: ~60 s de un círculo mudo la primera vez (baja el reconocedor).
  assert.equal(rotuloProgresoSubtitulos('modelo', 40), 'Descargando… 40 %');
  assert.equal(rotuloProgresoSubtitulos('transcribiendo', 75), 'Generando subtítulos… 75 %');
  assert.equal(rotuloProgresoSubtitulos('audio', 10), 'Generando subtítulos…');
});

test('los motivos van una vez cada uno, en el orden en que llegaron', () => {
  const m = 'la fuente de un subtítulo se cambia en el panel Texto';
  assert.deepEqual(sinRepetir([m, m, m]), [m]);
  assert.deepEqual(sinRepetir(['b', 'a', 'b', ' a ', '', 'c']), ['b', 'a', 'c']);
  assert.deepEqual(sinRepetir([]), []);
});
