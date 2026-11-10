// =============================================================================
// Cuando el chat cambia la velocidad, los subtítulos siguen a la voz (10/11/2026)
// =============================================================================
// Medido en producción el 10/11/2026 (ws9, «1110»: clip-4 de 0 a 8,04 s y prueba-con-pausa de 8,10 a 21,65 s, 10
// subtítulos): «Poné todo el video un poco más rápido» → 1,3× en los dos, y MaKo dijo «Los textos se ajustan
// automáticamente a los nuevos tiempos». Los subtítulos sólo se corrieron en bloque con su clip (la Vinculación): los
// clips terminaron en 16,6 s y los subtítulos en 18,8 s, «Por eso creé una app» 1,3 s tarde y dos pisándose
// («Este es un mensaje» 6,72→9,64 sobre «para todos» 7,84). Fija app/video-editor/_opencut/chat/velocidad-subtitulos.ts y
// que chat/comandos.ts lo use en la velocidad.
//
// PROBADO ROMPIÉNDOLO (10/11/2026, cada uno dio rojo y se volvió atrás):
//   · `inicio + (t - inicio) * f` → `t` (sólo correr, lo de antes): rojo el 1.º y el de las palabras;
//   · sin `corrimiento` (lo de después del fin, sin correr): rojo el 1.º y el de las palabras (la cola de «Este es un mensaje»);
//   · en comandos.ts, `return cambio;` sin el reajuste: rojo el del cableado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reajustarSubtitulos, type SubtituloEnTramo } from '../app/video-editor/_opencut/chat/velocidad-subtitulos';
import { codificarPalabras, palabrasDe, PARAM_PALABRAS } from '../app/video-editor/_opencut/subtitles/palabras';

const TPS = 120_000;
const t = (s: number) => Math.round(s * TPS);
const s = (ticks: number) => Math.round((ticks / TPS) * 100) / 100;
const sub = (id: string, inicio: number, fin: number, contenido = id, palabras?: string): SubtituloEnTramo => ({
  trackId: 'subs', elementId: id, startTime: t(inicio), duration: t(fin - inicio), trimStart: 0, contenido, palabras,
});

// Los del proyecto medido, en segundos.
const MEDIDOS = [
  sub('vas a poder', 0.03, 1.95),
  sub('videos, como el que', 2.01, 5.11),
  sub('viendo en este', 5.15, 6.04),
  sub('Este es un mensaje', 6.72, 9.64),
  sub('para todos', 9.7, 10.72),
  sub('Por eso creé una app', 13.48, 16.5),
];
const CLIP_4 = { startTime: t(0), duration: t(8.04) };

test('1,3× en el primer clip: lo de adentro se escala, la cola se corre con el siguiente y lo de después no se toca', () => {
  const r = reajustarSubtitulos({ subtitulos: MEDIDOS, clip: CLIP_4, finNuevo: t(6.18), iman: true, tps: TPS });
  const f = 6.18 / 8.04;
  const por = Object.fromEntries(r.map((x) => [x.elementId, [s(x.patch.startTime), s(x.patch.startTime + x.patch.duration)]]));
  assert.deepEqual(Object.keys(por), ['vas a poder', 'videos, como el que', 'viendo en este', 'Este es un mensaje'], 'lo de después lo corre la Vinculación');
  assert.deepEqual(por['vas a poder'], [s(t(0.03 * f)), s(t(1.95 * f))]);
  assert.deepEqual(por['viendo en este'], [s(t(5.15 * f)), s(t(6.04 * f))]);
  // «Este es un mensaje» empieza en el clip y termina en el siguiente: su cola se corre lo mismo que el siguiente.
  assert.deepEqual(por['Este es un mensaje'], [s(t(6.72 * f)), 7.78]);
  // Y ya no pisa a «para todos», que la Vinculación deja en 9,70 − 1,86 = 7,84.
  assert.ok(7.78 <= 9.7 - (8.04 - 6.18) + 1e-9);
});

test('sin imán el siguiente no se mueve, y la cola tampoco', () => {
  const r = reajustarSubtitulos({ subtitulos: MEDIDOS, clip: CLIP_4, finNuevo: t(6.18), iman: false, tps: TPS });
  const m = r.find((x) => x.elementId === 'Este es un mensaje')!;
  assert.equal(s(m.patch.startTime + m.patch.duration), 9.64);
});

test('el segundo clip, ya corrido: se escala desde SU inicio y lo de antes no se toca', () => {
  // prueba-con-pausa después del primer cambio: de 6,22 a 19,77 s (13,55 s) → 1,3× = 10,42 s.
  const corridos = [sub('Este es un mensaje', 5.17, 7.78), sub('Por eso creé una app', 11.62, 14.64)];
  const r = reajustarSubtitulos({ subtitulos: corridos, clip: { startTime: t(6.22), duration: t(13.55) }, finNuevo: t(6.22 + 10.42), iman: true, tps: TPS });
  const f = 10.42 / 13.55;
  const por = Object.fromEntries(r.map((x) => [x.elementId, [s(x.patch.startTime), s(x.patch.startTime + x.patch.duration)]]));
  // «Este es un mensaje» empieza antes del clip: su inicio se queda y su fin entra en la cuenta.
  assert.equal(por['Este es un mensaje'][0], 5.17);
  assert.equal(por['Este es un mensaje'][1], s(t(6.22 + (7.78 - 6.22) * f)));
  assert.deepEqual(por['Por eso creé una app'], [s(t(6.22 + (11.62 - 6.22) * f)), s(t(6.22 + (14.64 - 6.22) * f))]);
});

test('las palabras pasan por la misma cuenta (el resaltado sigue cayendo en la palabra)', () => {
  const palabras = [
    { texto: 'Este', inicio: 6.72, fin: 6.95 }, { texto: 'es', inicio: 6.95, fin: 7.1 },
    { texto: 'un', inicio: 7.1, fin: 7.3 }, { texto: 'mensaje', inicio: 7.9, fin: 9.6 },
  ];
  const param = codificarPalabras({ palabras, origen: 6.72, precision: 'palabra' });
  const [r] = reajustarSubtitulos({ subtitulos: [sub('m', 6.72, 9.64, 'Este es un mensaje', param)], clip: CLIP_4, finNuevo: t(6.18), iman: true, tps: TPS });
  const g = palabrasDe({ contenido: 'Este es un mensaje', param: r.patch.params?.[PARAM_PALABRAS], inicio: r.patch.startTime / TPS, recorteInicio: 0, duracion: r.patch.duration / TPS });
  const f = 6.18 / 8.04;
  assert.ok(g, 'las palabras se perdieron');
  const esperado: Array<[string, number, number]> = [
    ['Este', 6.72 * f, 6.95 * f],
    ['es', 6.95 * f, 7.1 * f],
    ['un', 7.1 * f, 7.3 * f],
    // «mensaje» empieza en el clip (se escala) y termina en el siguiente (se corre).
    ['mensaje', 7.9 * f, 9.6 - 1.86],
  ];
  assert.deepEqual(g.palabras.map((p) => p.texto), esperado.map((e) => e[0]));
  // Se guardan a la centésima (subtitles/palabras.ts): una de diferencia es el redondeo.
  g.palabras.forEach((p, i) => {
    assert.ok(Math.abs(p.inicio - esperado[i][1]) <= 0.011 && Math.abs(p.fin - esperado[i][2]) <= 0.011, `${p.texto}: ${p.inicio}–${p.fin}, esperaba ${esperado[i][1].toFixed(3)}–${esperado[i][2].toFixed(3)}`);
  });
});

test('sin cambio de duración, o un clip vacío, no hay nada que tocar', () => {
  assert.deepEqual(reajustarSubtitulos({ subtitulos: MEDIDOS, clip: CLIP_4, finNuevo: t(8.04), iman: true, tps: TPS }), []);
  assert.deepEqual(reajustarSubtitulos({ subtitulos: MEDIDOS, clip: { startTime: 0, duration: 0 }, finNuevo: t(1), iman: true, tps: TPS }), []);
});

test('el cableado: la velocidad del chat lleva el reajuste, salvo con curva, y sólo en un clip con voz', () => {
  const src = readFileSync('app/video-editor/_opencut/chat/comandos.ts', 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const reajuste = reajusteDeSubtitulos\(o, actual, retime\);\s*return reajuste\.length > 0 \? new BatchCommand\(\[cambio, new UpdateElementsCommand\(\{ updates: reajuste \}\)\]\) : cambio;/);
  assert.match(src, /if \(conCurva\(\(clip as \{ retime\?: RetimeConfig \}\)\.retime\) \|\| conCurva\(retime\)\) return \[\];/);
  assert.match(src, /if \(!principal && !tracks\.audio\.some\(\(t\) => t\.id === o\.trackId\)\) return \[\];/, 'un B-roll de arriba no lleva la voz');
  assert.match(src, /iman: principal && useTimelineStore\.getState\(\)\.rippleEditingEnabled,/);
});
