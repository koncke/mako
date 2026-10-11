// =============================================================================
// Video Editor: la «Curva» de velocidad y la geometría de «Recortar»
// =============================================================================
// La curva cambia CUÁNTA fuente recorre cada instante del clip. Si las cuentas no
// cierran, el error no se ve en el panel: se ve como un salto de cuadros en el
// corte de un clip dividido, o como un clip que muestra al final cuadros que son
// del siguiente. Esto fija lo que tiene que cerrar:
//
//   1. con curva, la duración es fuente ÷ velocidad media, en cualquier unidad,
//      y el último instante del clip cae justo al final de la fuente;
//   2. clip → fuente → clip es la identidad (lo usa el audio para ubicarse);
//   3. al dividir, las dos mitades suman EXACTAMENTE la fuente del clip entero
//      (sin el ajuste de media de `partirCurva`, «Montaje» partido al 37 % se
//      pasaba 1,5 %: la mitad izquierda recorría 4,83 s de una fuente de 4,68 s);
//   4. sin `clipDuration`, la curva cae a la velocidad media (exacta en los
//      extremos) y la velocidad constante no cambió;
//   5. Recortar: con una proporción fija el rectángulo tiene esa proporción EN
//      PÍXELES de la fuente, y los parámetros van y vuelven sin perder nada.
//
// Correr: node --import tsx --test tests/video-editor-velocidad-curva.test.ts
//
// ── Roturas (11/10/2026; base en verde: 5 pasan, 0 fallan) ──
//   · `ajustarMedia` de retime/curva.ts devolviendo los puntos sin escalar       -> 4 / 1 (el 3)
//   · getSourceTimeAtClipTime ignorando `clipDuration` (siempre la media)        -> 3 / 2 (el 2 y el 3)
//   · rectConProporcion sin el factor alto/ancho de la fuente                    -> 4 / 1 (el 5)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS_CURVA,
  buildCurveRetime,
  buildConstantRetime,
  getClipTimeAtSourceTime,
  getSourceSpanAtClipTime,
  getSourceTimeAtClipTime,
  getTimelineDurationForSourceSpan,
  splitRetimeAtClipTime,
} from '../app/video-editor/_opencut/retime';
import {
  paramsDeRect,
  rectConProporcion,
  rectDeParams,
} from '../app/video-editor/_opencut/recorte/geometria';

const cerca = (a: number, b: number, tol: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('1: con curva, duración = fuente ÷ media y el clip termina en el final de la fuente', () => {
  for (const preset of PRESETS_CURVA) {
    const retime = buildCurveRetime({ preset: preset.id, puntos: preset.puntos });
    for (const fuente of [10, 10 * 120_000]) {
      const duracion = getTimelineDurationForSourceSpan({ sourceSpan: fuente, retime });
      cerca(duracion * retime.rate, fuente, fuente * 1e-9, `${preset.id}: duración × media`);
      const alFinal = getSourceTimeAtClipTime({ clipTime: duracion, retime, clipDuration: duracion });
      cerca(alFinal, fuente, fuente * 1e-6, `${preset.id}: la fuente al final del clip`);
    }
  }
});

test('2: clip → fuente → clip es la identidad, y la fuente nunca retrocede', () => {
  const montaje = PRESETS_CURVA.find((p) => p.id === 'montaje');
  assert.ok(montaje);
  const retime = buildCurveRetime({ preset: montaje.id, puntos: montaje.puntos });
  const duracion = getTimelineDurationForSourceSpan({ sourceSpan: 10, retime });
  let anterior = -Infinity;
  for (let i = 0; i <= 500; i++) {
    const t = (duracion * i) / 500;
    const s = getSourceTimeAtClipTime({ clipTime: t, retime, clipDuration: duracion });
    assert.ok(s >= anterior - 1e-12, `la fuente retrocede en t=${t}`);
    anterior = s;
    const vuelta = getClipTimeAtSourceTime({ sourceTime: s, retime, clipDuration: duracion });
    cerca(vuelta, t, 1e-6, `ida y vuelta en t=${t}`);
  }
  // Y con curva la fuente NO es lineal: a mitad del clip no va por la mitad.
  const mitad = getSourceTimeAtClipTime({ clipTime: duracion * 0.25, retime, clipDuration: duracion });
  assert.ok(Math.abs(mitad - 2.5) > 0.2, `la curva se comporta como velocidad constante (${mitad})`);
});

test('3: al dividir, las mitades suman exactamente la fuente del clip', () => {
  for (const preset of PRESETS_CURVA) {
    const retime = buildCurveRetime({ preset: preset.id, puntos: preset.puntos });
    const fuente = 10;
    const duracion = getTimelineDurationForSourceSpan({ sourceSpan: fuente, retime });
    for (const u of [0.13, 0.37, 0.5, 0.81]) {
      const corte = duracion * u;
      const { left, right } = splitRetimeAtClipTime({ retime, splitClipTime: corte, clipDuration: duracion });
      assert.ok(left && right);
      const izquierdaExacta = getSourceSpanAtClipTime({ clipTime: corte, retime, clipDuration: duracion });
      const izquierda = corte * left.rate;
      const derecha = (duracion - corte) * right.rate;
      cerca(izquierda, izquierdaExacta, 1e-3, `${preset.id} al ${u}: la mitad izquierda`);
      cerca(izquierda + derecha, fuente, 1e-3, `${preset.id} al ${u}: la suma`);
    }
  }
});

test('4: sin clipDuration la curva usa la media; la velocidad constante no cambió', () => {
  const bala = PRESETS_CURVA.find((p) => p.id === 'bala');
  assert.ok(bala);
  const curva = buildCurveRetime({ preset: bala.id, puntos: bala.puntos });
  cerca(getSourceTimeAtClipTime({ clipTime: 4, retime: curva }), 4 * curva.rate, 1e-12, 'curva sin duración');
  const doble = buildConstantRetime({ rate: 2 });
  assert.equal(getSourceTimeAtClipTime({ clipTime: 3, retime: doble, clipDuration: 9 }), 6);
  assert.equal(getClipTimeAtSourceTime({ sourceTime: 6, retime: doble }), 3);
  assert.equal(getTimelineDurationForSourceSpan({ sourceSpan: 10, retime: doble }), 5);
  // El rango de CapCut: 0,1× a 100×.
  assert.equal(buildConstantRetime({ rate: 500 }).rate, 100);
  assert.equal(buildConstantRetime({ rate: 0.01 }).rate, 0.1);
});

test('5: Recortar mantiene la proporción en píxeles y los parámetros van y vuelven', () => {
  const fuente = { width: 1920, height: 1080 };
  for (const proporcion of [1, 9 / 16, 16 / 9, 4 / 3]) {
    const r = rectConProporcion({ x: 0, y: 0, ancho: 1, alto: 1 }, proporcion, fuente);
    cerca((r.ancho * fuente.width) / (r.alto * fuente.height), proporcion, 1e-9, `proporción ${proporcion}`);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.ancho <= 1 + 1e-9 && r.y + r.alto <= 1 + 1e-9, 'se sale del cuadro');
  }
  const rect = { x: 0.1, y: 0.2, ancho: 0.5, alto: 0.6 };
  const vuelta = rectDeParams(paramsDeRect(rect, '16:9'));
  cerca(vuelta.x, rect.x, 1e-4, 'x');
  cerca(vuelta.y, rect.y, 1e-4, 'y');
  cerca(vuelta.ancho, rect.ancho, 1e-4, 'ancho');
  cerca(vuelta.alto, rect.alto, 1e-4, 'alto');
});
