// =============================================================================
// MaKo Mobile — las reglas puras de Video Generator en el teléfono (app/m/video/modelo.ts y
// app/m/video/adelgazar.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · el teléfono NO filma: el primario nunca se enciende ni ofrece «Descargar» sin un montaje
//     listo, aunque todas las tomas estén filmadas;
//   · lo que se dice primero es lo que BLOQUEA (una toma que no salió) y la toma que se abre es
//     ésa;
//   · `adelgazar` le saca al plan lo que el teléfono no usa (prompts, JSON crudo de Google) sin
//     cambiar lo que `estadoDeToma` de escritorio lee: la misma toma, el mismo estado;
//   · la duración: el montaje medido gana a lo planeado, y 59,6 s no es «0:60».
//
// Verificado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde (9/9), restaurando el
// archivo entero después de cada una (scratchpad/video/romper.cjs):
//   · sin montaje y todas filmadas, el primario encendido: 1 fallo, 8 pases.
//   · «Descargar» sin montaje cuando llega `entero`: 1 fallo, 8 pases.
//   · «Filmando…» antes que «Una toma no salió»: 1 fallo, 8 pases.
//   · reloj sin redondear antes de partir (59,6 → «0:60»): 1 fallo, 8 pases.
//   · abrir la toma que se filma antes que la que falló: 1 fallo, 8 pases.
//   · la duración ignorando el montaje medido: 1 fallo, 8 pases.
//   · adelgazar perdiendo `trabajoId` (la toma «Filmando» pasa a «Sin filmar»): 1 fallo, 8 pases.
//   · adelgazar bajando `errorCrudo` al teléfono: 1 fallo, 8 pases.
//   · control sin cambio: 0 fallos, 9 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  duracionDe, hayEnVuelo, pieDelEditor, reloj, resumenDeAnuncio, todasFilmadas, tomaInicial,
  type MontajeM, type TomaM,
} from '../app/m/video/modelo';
import { adelgazar, tituloDe } from '../app/m/video/adelgazar';
import type { EstadoToma } from '../app/video-generator/tomas-estado';
import type { PlanGuardado } from '../app/video-generator/video-datos';

const t = (...estados: EstadoToma[]): TomaM[] => estados.map((estado, i) => ({ n: i + 1, estado, segundos: 8 }));
const LISTO: MontajeM = { fase: 'listo', url: 'https://x/anuncio.mp4', segundos: 41.6 };

test('reloj: redondea antes de partir', () => {
  assert.equal(reloj(46), '0:46');
  assert.equal(reloj(70.04), '1:10');
  assert.equal(reloj(59.6), '1:00', '59,6 s no es «0:60»');
  assert.equal(reloj(Number.NaN), '0:00');
  assert.equal(reloj(-3), '0:00');
});

test('duración: el montaje medido gana a lo planeado; sin medir, la suma de las tomas', () => {
  assert.equal(duracionDe(t('filmada', 'filmada'), LISTO), 41.6);
  assert.equal(duracionDe(t('filmada', 'filmada'), { fase: 'listo', url: 'u', segundos: null }), 16);
  assert.equal(duracionDe(t('filmada', 'pendiente'), { fase: 'montando' }), 16);
  assert.equal(duracionDe(t('filmada', 'pendiente'), null), 16);
});

test('la segunda línea dice primero lo que bloquea', () => {
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'generando', 'fallada'), null), { texto: 'Una toma no salió', tono: 'bad' });
  assert.deepEqual(resumenDeAnuncio(t('fallada', 'fallada', 'filmada'), null), { texto: '2 tomas no salieron', tono: 'bad' });
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'generando', 'pendiente'), null), { texto: 'Filmando…', tono: null });
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'filmada'), LISTO), { texto: 'Listo', tono: null });
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'filmada'), { fase: 'montando' }), { texto: 'Montando…', tono: null });
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'filmada'), { fase: 'error' }), { texto: 'No se pudo montar', tono: 'bad' });
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'filmada', 'filmada'), null), { texto: '3 tomas listas', tono: null });
  assert.deepEqual(resumenDeAnuncio(t('filmada', 'pendiente', 'sin-texto'), null), { texto: '1 de 3 tomas', tono: null });
  assert.deepEqual(resumenDeAnuncio(t('pendiente', 'pendiente'), null), { texto: 'Sin filmar', tono: null });
  assert.deepEqual(resumenDeAnuncio([], null), { texto: 'Sin tomas', tono: null });
});

test('la toma que se abre: la que no salió, después la que se filma, después la que falta', () => {
  assert.equal(tomaInicial(t('filmada', 'generando', 'pendiente', 'fallada')), 4);
  assert.equal(tomaInicial(t('filmada', 'pendiente', 'generando')), 3);
  assert.equal(tomaInicial(t('filmada', 'filmada', 'sin-texto')), 3);
  assert.equal(tomaInicial(t('filmada', 'filmada')), 1);
  assert.equal(tomaInicial([]), null);
});

test('el teléfono no filma: sin montaje listo el primario está apagado y dice qué falta', () => {
  // Todas filmadas y sin montaje: NO se ofrece descargar ni ver entero, aunque `entero` llegue true.
  for (const m of [null, { fase: 'sin_empezar' } as MontajeM, { fase: 'montando' } as MontajeM, { fase: 'error' } as MontajeM]) {
    for (const entero of [false, true]) {
      const pie = pieDelEditor(t('filmada', 'filmada'), m, entero);
      assert.equal(pie.habilitado, false, `montaje ${m?.fase ?? 'null'}, entero ${entero}`);
      assert.equal(pie.accion, 'entero');
    }
  }
  assert.equal(pieDelEditor(t('filmada', 'filmada'), null, false).consecuencia, 'Falta montar el anuncio.');
  assert.equal(pieDelEditor(t('filmada', 'filmada'), { fase: 'montando' }, false).consecuencia, 'Se está montando el anuncio.');
  assert.equal(pieDelEditor(t('filmada', 'filmada'), { fase: 'error' }, false).consecuencia, 'No se pudo montar el anuncio.');
  // Lo que falta es la PRIMERA toma sin filmar, en orden (como el prototipo).
  assert.equal(pieDelEditor(t('filmada', 'pendiente', 'fallada'), null, false).consecuencia, 'Falta filmar la toma 2.');
  assert.equal(pieDelEditor(t('filmada', 'fallada', 'pendiente'), null, false).consecuencia, 'Falta la toma 2.');
  assert.equal(pieDelEditor(t('generando', 'fallada'), null, false).consecuencia, 'Se está filmando la toma 1.');
  assert.equal(pieDelEditor(t('filmada', 'sin-texto'), null, false).consecuencia, 'Falta el texto de la toma 2.');
  assert.equal(pieDelEditor([], null, false).habilitado, false);
});

test('con el montaje listo: ver el anuncio entero, y mirándolo, descargarlo', () => {
  assert.deepEqual(pieDelEditor(t('filmada', 'filmada', 'filmada'), LISTO, false),
    { accion: 'entero', habilitado: true, consecuencia: 'Las 3 tomas están listas.' });
  assert.deepEqual(pieDelEditor(t('filmada', 'filmada', 'filmada'), LISTO, true),
    { accion: 'descargar', habilitado: true, consecuencia: 'Queda en tu teléfono.' });
});

test('se vuelve a leer sólo mientras algo se mueve solo', () => {
  assert.equal(hayEnVuelo(t('filmada', 'generando'), null), true);
  assert.equal(hayEnVuelo(t('filmada', 'filmada'), { fase: 'montando' }), true);
  assert.equal(hayEnVuelo(t('filmada', 'fallada'), null), false);
  assert.equal(hayEnVuelo(t('filmada', 'filmada'), LISTO), false);
  assert.equal(todasFilmadas(t('filmada', 'filmada')), true);
  assert.equal(todasFilmadas([]), false);
});

// ── adelgazar ────────────────────────────────────────────────────────────────

const clip = (n: number, voz: string) => ({
  n, segundos: 8, habla: true, voz, queSeVe: 'camina hacia la cámara', camara: 'plano medio',
  prompt: 'PROMPT LARGO EN INGLÉS', palabras: voz.split(' ').length, tope: 20, voseo: [],
  original: 'lo que decía el guion', ctaInventado: ['ahora'],
});

const PLAN: PlanGuardado = {
  id: 'p1', pedido: 'Clase gratis', at: '2026-10-11T10:00:00Z', guionId: 'g1',
  plan: {
    puestaId: 'office', titulo: '', duracionTotalSeg: 40, ritmo: 'HHHHH', deCorrido: 'todo el guion',
    clips: [clip(1, 'Uno'), clip(2, 'Dos'), clip(3, 'Tres'), clip(4, ''), clip(5, 'Cinco')],
  },
  escenas: [],
  imagenes: { 1: { elegida: 'https://labs.google/imagen-que-vence', confirmada: true } },
  promptsPropios: { 2: 'mi prompt' },
  video: {
    1: { url: 'https://x/storage/v1/object/public/video-clips/t1.mp4', mediaId: 'm1', descartadas: [{ url: 'https://x/viejo.mp4' }] },
    2: { error: 'no', errorCausa: 'contenido', errorCrudo: '{"media":[{"name":"…"}]}', errorAt: '2026-10-11T09:00:00Z' },
    3: { trabajoId: 77, ciego: { desde: '2026-10-11T09:00:00Z', error: 'x' } },
  },
};

test('adelgazar: se va lo que el teléfono no usa', () => {
  const a = adelgazar(PLAN);
  assert.equal(a.plan.clips.every((c) => c.prompt === '' && c.camara === '' && c.queSeVe === ''), true);
  assert.equal(a.plan.deCorrido, '');
  assert.equal(a.imagenes, undefined);
  assert.equal(a.escenas, undefined);
  assert.equal(a.promptsPropios, undefined);
  assert.equal(a.video?.['2']?.errorCrudo, undefined, 'el JSON crudo de Google no baja al teléfono');
  assert.equal(a.video?.['1']?.descartadas, undefined);
  // Lo que se dibuja sigue estando.
  assert.equal(a.video?.['1']?.url, PLAN.video!['1'].url);
  assert.equal(a.video?.['2']?.errorCausa, 'contenido');
  assert.deepEqual(a.plan.clips.map((c) => c.voz), ['Uno', 'Dos', 'Tres', '', 'Cinco']);
  assert.equal(tituloDe(a), 'Clase gratis', 'sin título del plan, lo que se pidió');
});

test('adelgazar no cambia lo que estadoDeToma de escritorio lee', async () => {
  // La regla vive en app/video-generator/tomas-estado.ts (pura; PasoTomas.tsx la re-exporta).
  const { estadoDeToma } = await import('../app/video-generator/tomas-estado');
  const a = adelgazar(PLAN);
  const antes = PLAN.plan.clips.map((c) => estadoDeToma(PLAN, c.n));
  const despues = a.plan.clips.map((c) => estadoDeToma(a, c.n));
  assert.deepEqual(despues, antes);
  assert.deepEqual(antes, ['filmada', 'fallada', 'generando', 'sin-texto', 'pendiente']);
});
