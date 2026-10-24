// =============================================================================
// La cohorte no aparece si el lead no se presentó a la R1 (24/10/2026)
// =============================================================================
// Martín, 03/07 (docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»): «Ocultar Cohorte si no hubo R1». `cohorteDeLead`
// sólo miraba si había fecha de R1, y un no-show (asistió = false) tiene la fecha pero la R1 no hubo.
// lib/leads.ts es server-only: se lee el código.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('un no-show no muestra cohorte', () => {
  const src = readFileSync(join(__dirname, '..', 'lib/leads.ts'), 'utf8').replace(/\r\n/g, '\n');
  const fn = src.slice(src.indexOf('export function cohorteDeLead('), src.indexOf('export function textoCohorteJ1('));
  assert.ok(fn.length > 50, 'no encontré cohorteDeLead');
  assert.match(fn, /if \(!lead\.fecha_junta_1\) return null;\n[^\n]*\n\s+if \(lead\.asistio_j1 === false\) return null;/, 'un no-show muestra cohorte');
});
