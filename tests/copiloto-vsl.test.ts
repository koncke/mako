// =============================================================================
// Tu VSL en el Marketing CoPilot (14/11/2026): lib/copiloto/vsl.ts
// =============================================================================
// Lo prometido a Julio (13/11): conectar el VSL y ver cuánto lo miran. Fija:
//   · la curva en cuartos sale de la del Pixel (cortes de 5 %), con la gente que le dio play si la hay;
//   · la caída más grande se nombra en la frase (desde 5 puntos);
//   · el video con más gente medida es el que se resume;
//   · sin eventos o con muy poca gente, null: la tarjeta pide conectar, no dibuja una curva en cero.
// Correr: node --import tsx --test tests/copiloto-vsl.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { MINIMO_PERSONAS_VSL, resumenVsl } from '../lib/copiloto/vsl';
import type { RetencionDeVideo } from '../lib/landing-retencion';

const curva = (pcts: number[], personas: number) => pcts.map((p, i) => ({ corte: i * 5, personas: Math.round((p / 100) * personas), porcentaje: p }));
// 21 cortes (0..100 de a 5): fuerte caída entre el 10 y el 15 %.
const PCTS = [100, 92, 88, 60, 57, 55, 52, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 25];
const video = (id: string, medidos: number, play = true): RetencionDeVideo => ({
  video_id: id, titulo: `VSL ${id}`, duracion_segundos: 600,
  todos: { arrancaron: medidos + 40, medidos: medidos + 40, por_minuto: null, por_porcentaje: curva(PCTS.map((p) => Math.max(0, p - 10)), medidos + 40) },
  dieron_play: play ? { arrancaron: medidos, medidos, por_minuto: null, por_porcentaje: curva(PCTS, medidos) } : { arrancaron: 0, medidos: 0, por_minuto: null, por_porcentaje: null },
  solo_autoplay: 40,
});

test('los cuartos y la caída, con los que le dieron play', () => {
  const r = resumenVsl([video('a', 320)]);
  assert.ok(r);
  assert.deepEqual(r.cuartos.map((c) => c.porcentaje), [100, 55, 44, 34, 25]);
  assert.deepEqual(r.caida, { desde: 10, hasta: 15, pierde: 28 });
  assert.equal(r.personas, 320);
  assert.equal(r.frase, 'De 320 que le dieron play, 44 % llega a la mitad y el 28 % se va entre el 10 % y el 15 % del video.');
});

test('se resume el video con más gente; sin play, la curva de todos', () => {
  const r = resumenVsl([video('chico', 30), video('grande', 500)]);
  assert.equal(r?.titulo, 'VSL grande');
  const sinPlay = resumenVsl([video('auto', 200, false)]);
  assert.equal(sinPlay?.personas, 240, 'sin quien le dio play, todos los medidos');
});

test('sin eventos o con poca gente, null', () => {
  assert.equal(resumenVsl([]), null);
  assert.equal(resumenVsl([video('poco', MINIMO_PERSONAS_VSL - 1 - 40, true)].map((v) => ({ ...v, todos: { ...v.todos, medidos: 5 }, dieron_play: { ...v.dieron_play, medidos: 5 } }))), null);
});
