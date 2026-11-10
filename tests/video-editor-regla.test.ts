// =============================================================================
// La regla de la línea de tiempo marca cada segundo, a cualquier fps (10/11/2026)
// =============================================================================
// Medido en producción el 10/11/2026 (ws9, el proyecto «1110»): dos clips de 24 fps (el proyecto toma los fps del primero)
// y la regla decía «00:00, 15f, 6f, 21f, 12f, 3f, 18f, 9f» cada 156 px: rótulos cada 15 cuadros, que no dividen 24, así que
// se corrían del segundo y el «00:01» no salía nunca. Fija app/video-editor/_opencut/timeline/ruler-utils.ts:
//   · a 30 fps la serie es la de CapCut (2, 3, 5, 10, 15 cuadros), como antes;
//   · a 24 (y 25, 50…) los rótulos van cada un divisor de los fps: cada segundo tiene el suyo;
//   · el rótulo sale del número de cuadro: a 23,976 fps el cuadro 24 es «00:01», no «0f».
//
// PROBADO ROMPIÉNDOLO (10/11/2026, cada uno dio rojo y se volvió atrás):
//   · `frameIntervals: intervalosDeRotulo(fpsFloat)` → `LABEL_FRAME_INTERVALS`: volvió «15f, 6f, 21f» (rojo el de 24 fps);
//   · el formato por segundos (`timeInSeconds % 1`) en vez de por cuadro: rojo el de 23,976.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRulerLabel, getRulerConfig, intervalosDeRotulo, shouldShowLabel } from '../app/video-editor/_opencut/timeline/ruler-utils';

const fps = (n: number, d = 1) => ({ numerator: n, denominator: d });

/** Los rótulos que dibuja la regla en los primeros `hasta` segundos (como timeline-ruler.tsx). */
function rotulos(zoomLevel: number, rate: { numerator: number; denominator: number }, hasta: number): string[] {
  const { labelIntervalSeconds, tickIntervalSeconds } = getRulerConfig({ zoomLevel, fps: rate });
  const salida: string[] = [];
  for (let i = 0; i * tickIntervalSeconds <= hasta + 1e-9; i++) {
    const t = i * tickIntervalSeconds;
    if (shouldShowLabel({ time: t, labelIntervalSeconds })) salida.push(formatRulerLabel({ timeInSeconds: t, fps: rate }));
  }
  return salida;
}

test('a 24 fps cada segundo tiene su rótulo (el caso medido: zoom 5, 156 px entre rótulos)', () => {
  const r = rotulos(5, fps(24), 3);
  assert.deepEqual(r, ['00:00', '12f', '00:01', '12f', '00:02', '12f', '00:03']);
  for (const z of [1, 2, 3, 5, 8, 12, 20, 40, 80]) {
    const conSegundo = rotulos(z, fps(24), 4).filter((x) => /^\d\d:\d\d$/.test(x));
    assert.ok(conSegundo.includes('00:01') || conSegundo.includes('00:02') || conSegundo.includes('00:03'), `zoom ${z}: ${rotulos(z, fps(24), 4).join(', ')}`);
  }
  assert.deepEqual([...intervalosDeRotulo(24)], [2, 3, 4, 6, 8, 12]);
  assert.deepEqual([...intervalosDeRotulo(25)], [5]);
});

test('a 30 y 60 fps la serie es la de CapCut, como antes', () => {
  assert.deepEqual([...intervalosDeRotulo(30)], [2, 3, 5, 10, 15]);
  assert.deepEqual([...intervalosDeRotulo(60)], [2, 3, 5, 10, 15]);
  assert.deepEqual(rotulos(5, fps(30), 2), ['00:00', '15f', '00:01', '15f', '00:02']);
});

test('el rótulo sale del número de cuadro: a 23,976 fps el cuadro 24 es «00:01»', () => {
  const ntsc = fps(24000, 1001);
  assert.equal(formatRulerLabel({ timeInSeconds: 24 / (24000 / 1001), fps: ntsc }), '00:01');
  assert.equal(formatRulerLabel({ timeInSeconds: 12 / (24000 / 1001), fps: ntsc }), '12f');
  assert.equal(formatRulerLabel({ timeInSeconds: 90, fps: fps(30) }), '01:30');
  assert.equal(formatRulerLabel({ timeInSeconds: 0.5, fps: fps(30) }), '15f');
});
