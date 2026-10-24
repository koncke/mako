// =============================================================================
// Archivar no es cerrar: archivar una automatización descarta también sus borradores sin mandar (24/10/2026, ws13)
// =============================================================================
// La #241 del ws13 se archivó el 20/10 y dejó cuatro borradores del paso 5 esperando aprobación. Aprobar uno días después
// le mandaba al lead un mensaje de un flujo que ya no corre, y mientras tanto frenaban la acción de OTRA automatización
// del mismo lead (`tieneBorradorNutriPendiente`): la #264 los tuvo cuatro días en 'respondio'. `archivarSecuencias`
// (lib/secuencias-huecos.ts) cancelaba las inscripciones vivas y no tocaba los borradores. Ahora los descarta (nunca los
// borra) y deja una línea en el historial de cada lead, porque `wa_borradores` no tiene dónde guardar el motivo.
// Es cableado contra la base (getTenantDb): se fija leyendo el fuente, como los pins del motor.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/archivar-descarta-borradores.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const huecos = readFileSync(new URL('../lib/secuencias-huecos.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const run = readFileSync(new URL('../lib/api-mako/areas/chatbot.run.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de `archivarSecuencias`, hasta la función que sigue. */
const archivar = (() => {
  const i = huecos.indexOf('export async function archivarSecuencias(');
  const f = huecos.indexOf('\nexport async function desarchivarSecuencia', i);
  assert.ok(i >= 0 && f > i, 'no encontré archivarSecuencias');
  return huecos.slice(i, f);
})();

test('archivar descarta los borradores PENDIENTES de esas secuencias, sin borrarlos', () => {
  assert.match(archivar, /from\('wa_borradores'\)\.update\(\{ estado: 'descartado' \}\)\s*\.in\('secuencia_id', objetivo\)\.eq\('estado', 'pendiente'\)/,
    'archivar dejó vivos los borradores de la automatización archivada');
  assert.doesNotMatch(archivar, /from\('wa_borradores'\)\.delete\(/, 'un borrador se descarta, no se borra');
});

test('cada lead con un borrador descartado lo tiene en su historial, con el nombre de la automatización', () => {
  assert.match(archivar, /from\('lead_audit'\)\.insert\(historial\)/, 'no anota el descarte en el historial del lead');
  assert.match(archivar, /Borrador descartado al archivar «\$\{nombreDe\.get\(/);
  assert.match(archivar, /select\('id, nombre'\)/, 'sin el nombre, la línea del historial no dice de qué automatización era');
});

test('lo dice quien archiva: la cuenta vuelve, y la API la nombra al confirmar y al terminar', () => {
  assert.match(archivar, /borradoresDescartados: descartados\.length/);
  assert.match(run, /y descartar sus borradores sin mandar/, 'la confirmación de archivar_secuencia no avisa de los borradores');
  assert.match(run, /\$\{r\.borradoresDescartados\} borradores sin mandar descartados/);
});

// ── ROTURAS (24/10/2026) ──────────────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria). Base 3 pasan / 0 fallan:
//   A1. sin el update de wa_borradores en `archivarSecuencias`                                  → 1 falla
//   A2. el descarte sin `.eq('estado', 'pendiente')` (pisaría los ya enviados)                   → 1 falla
//   A3. sin el insert en lead_audit                                                              → 1 falla
//   A4. la confirmación de la API sin «y descartar sus borradores sin mandar»                    → 1 falla
