// =============================================================================
// «Qué hacer ahora» del diagnóstico de fase: lo tachado se guarda y MaKo lo lee (17/10/2026)
// =============================================================================
// docs/relevo/onboarding.md (ventana del 13/10): «El checklist "Qué hacer ahora" del diagnóstico no se guarda.
// app/onboarding/FaseUI.tsx es useState local: se tilda, se dibuja y se pierde al recargar. El usuario marca lo que
// ya hizo y MaKo no se entera.» Ahora va en el diagnóstico guardado (`hechas`), por PATCH /api/onboarding/fase, y el
// contexto de MaKo dice qué hizo y qué le falta. Rehacer el diagnóstico lo vacía (otra fase, otra lista).
//
// PROBADO ROMPIÉNDOLO (17/10/2026): sanearHechas sin el rango → 1 fallo; el contexto sin «Ya hizo» → 1 fallo; la
// pantalla con el `Set([0])` de antes → 1 fallo; la ruta sin PATCH → 1 fallo. Base: 3 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diagnosticar, faseContextoTexto, faseDef, sanearHechas, type Diagnostico } from '../lib/fase-diagnostico';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('sanearHechas: enteros de la lista de ESA fase, sin repetir y en orden', () => {
  const total = faseDef(0).acciones.length;
  assert.ok(total >= 2);
  assert.deepEqual(sanearHechas([1, 0, 1, '0', -1, total, 1.5, 'x', null], 0), [0, 1]);
  assert.deepEqual(sanearHechas('no', 0), []);
  assert.deepEqual(sanearHechas(undefined, 0), []);
});

test('el contexto de MaKo dice qué tachó y qué le falta; sin tachar nada, no dice nada de eso', () => {
  const d = diagnosticar([0, 0, 0, 0, 0, 0]);
  assert.equal(d.hechas, undefined, 'rehacer el diagnóstico no trae lo tachado');
  const sin = faseContextoTexto(d);
  assert.doesNotMatch(sin, /Ya hizo|Le falta/);
  const f = faseDef(d.fase);
  const con: Diagnostico = { ...d, hechas: [0] };
  const t = faseContextoTexto(con);
  assert.match(t, new RegExp(`Ya hizo \\(lo tachó de «Qué hacer ahora»\\): ${f.acciones[0].titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`));
  assert.match(t, /Le falta de «Qué hacer ahora»: /);
  assert.ok(t.includes(f.acciones[1].titulo));
});

test('la pantalla arranca con lo guardado y lo guarda al tachar; la ruta tiene PATCH sobre el diagnóstico vigente', () => {
  const ui = leer('app/onboarding/FaseUI.tsx');
  assert.match(ui, /useState<Set<number>>\(\(\) => new Set\(diag\.hechas \?\? \[0\]\)\)/);
  assert.match(ui, /method: 'PATCH'[^\n]*body: JSON\.stringify\(\{ hechas: \[\.\.\.n\] \}\)/);
  const ruta = leer('app/api/onboarding/fase/route.ts');
  assert.match(ruta, /export async function PATCH\(/);
  assert.match(ruta, /await guardarHechasFase\(body\.hechas\)/);
  const store = leer('lib/fase-store.ts');
  assert.match(store, /cambiarSettingSi\(FASE_KEY, raw, JSON\.stringify\(nuevo\)\)/, 'compare-and-set: rehacer el diagnóstico en el medio no se pisa');
});
