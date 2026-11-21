// =============================================================================
// EL RECUADRO SE ANCLA A LO QUE SE VE (21/11/2026, Martín en producción, por el Cerebro)
// =============================================================================
// «fíjate cómo se está marcando el recuadro del video: se marca por arriba, incluso se va hacia arriba y está mal posicionado… como que
// hay scroll hacia abajo». `getBoundingClientRect` da la caja ENTERA del video, también la parte metida debajo de la cabecera del chat, y
// el motor sólo lo llevaba a la vista si se salía de la VENTANA. Ahora el recuadro es lo que se ve (recortado por cada contenedor) y, si
// el contenedor lo tapa, primero se lleva a la vista. Lo toca el banco (scripts/banco-onboarding, escenario «recuadro»).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cajaVisible, seVeEntero } from '../lib/recorridos';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('1. lo que se ve: la caja recortada por cada contenedor (un video debajo de la cabecera no se marca sobre ella)', () => {
  const video = { x: 24, y: -36, ancho: 360, alto: 200 };
  const hilo = { x: 0, y: 64, ancho: 1440, alto: 836 };
  assert.deepEqual(cajaVisible(video, [hilo]), { x: 24, y: 64, ancho: 360, alto: 100 });
  assert.equal(seVeEntero(video, cajaVisible(video, [hilo])), false, 'tapado a medias: se lleva a la vista');
  const entero = { x: 24, y: 200, ancho: 360, alto: 200 };
  assert.equal(seVeEntero(entero, cajaVisible(entero, [hilo])), true);
  assert.equal(cajaVisible({ x: 0, y: 0, ancho: 10, alto: 10 }, [{ x: 100, y: 100, ancho: 10, alto: 10 }]).alto, 0, 'fuera de su contenedor: nada');
});

test('2. el motor marca lo que se ve y, si el contenedor lo tapa, lo lleva a la vista antes', () => {
  const m = fuente('app/_ui/tutorial/MotorTutorial.tsx');
  assert.match(m, /const visible = cajaVisible\(entera, contenedoresDe\(el\)\);/);
  assert.match(m, /if \(!seVeEntero\(entera, visible\) && llevado\.current !== el\) \{ llevado\.current = el; el\.scrollIntoView\(/);
  assert.match(m, /const hueco = recorteDe\(visible\.alto > 0 \? visible : entera, v\);/);
  assert.match(fuente('app/second-brain/LlegadaAlReto.tsx'), /document\.addEventListener\('scroll', medir, \{ capture: true, passive: true \}\);/, 'el velo de la llegada, con cualquier scroll');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026): el motor con la caja entera y sin llevarlo a la vista → 2 (y el banco, «recuadro»: 3 fallas).
// ─────────────────────────────────────────────────────────────────────────────
