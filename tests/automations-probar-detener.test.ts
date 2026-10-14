// =============================================================================
// «Probar» tiene ⏹ DETENER: corta en el acto lo que estaba por salir (punto 7 del feedback del 13/10/2026)
// =============================================================================
// Martín, reunión del 13/10 (Fathom 858545195 @85:00): «un botón de parada o pausa accesible en la interfaz para
// detener de forma inmediata la ejecución de un flujo de automatización durante las fases de testeo». «Probar» corre
// en el navegador con temporizadores (`luego`); en «Probar en WhatsApp» cada uno MANDA de verdad. ⏹ hace `cortar()`
// (ningún temporizador vivo vuelve a correr: `run.current` cambia), marca la prueba terminada y lo dice. Componente
// de cliente: el test mira el fuente.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `detener` sin `cortar()`                                                          → 1 / 1
//   R2 el botón sin `onClick={detener}`                                                    → 1 / 1
//
// Correr: node --import tsx --test tests/automations-probar-detener.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const P = readFileSync(new URL('../app/automations/PanelProbar.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('detener corta los temporizadores, termina la prueba y lo dice', () => {
  const ini = P.indexOf('const detener = () => {');
  assert.ok(ini > 0, 'no hay detener');
  const fn = P.slice(ini, P.indexOf('\n  };', ini));
  assert.match(fn, /cortar\(\);/);
  assert.match(fn, /setTerminado\(true\);/);
  assert.match(fn, /sistema\('⏹ Detenido', null, true\);/);
});

test('el botón ⏹ está después de ↻ mientras la prueba corre', () => {
  // DESPUÉS de ↻: «Probar en WhatsApp» va pegado a ↻ (tests/panel-probar-ancho.test.ts).
  assert.match(P, /title="Reiniciar" aria-label="Reiniciar" style=\{iconBtn\}>↻<\/button>\n[^\n]*\n\s*\{!terminado && <button type="button" data-detener onClick=\{detener\} title="Detener" aria-label="Detener la prueba" style=\{iconBtn\}>⏹<\/button>\}/);
});
