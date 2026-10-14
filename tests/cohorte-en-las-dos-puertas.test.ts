// =============================================================================
// La cohorte del lead se ve en las DOS puertas de la ficha
// =============================================================================
// Estaba en docs/relevo/crm.md (§3, abierto desde el 05/10/2026): la ruta /crm/[id] dibujaba
// «Cohorte · Madura · 48 días desde R1» y el panel del tablero (LeadSheet) no dibujaba nada.
// Quien entraba por el link de WhatsApp veía un dato que el tablero le escondía. El panel es
// 'use client' y no puede importar lib/leads.ts: la cohorte se resuelve en el server
// (getLeadFullAction) con la MISMA función que usa la ruta (`cohorteDeLead`).
//
// Correr: npx tsx --test tests/cohorte-en-las-dos-puertas.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): sacar `cohorte={cohorte ?? null}` del panel → 2 / 1; que
// la action no la resuelva → 2 / 1; que la ruta vuelva a armarla por su cuenta → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('el panel del tablero le pasa la cohorte a la ficha', () => {
  const src = leer('app/crm/LeadSheet.tsx');
  const i = src.indexOf('<InfoPrincipalCard');
  assert.ok(i > 0);
  assert.match(src.slice(i, i + 400), /cohorte=\{cohorte \?\? null\}/, 'el panel vuelve a esconder la cohorte');
});

test('la action la resuelve en el server, con la función de la ruta', () => {
  assert.match(leer('app/crm/actions.ts'), /cohorte: cohorteDeLead\(lead\)/);
});

test('la ruta y el panel usan la MISMA función', () => {
  const ruta = leer('app/crm/[id]/page.tsx');
  assert.match(ruta, /const cohorte = cohorteDeLead\(lead\);/);
  assert.doesNotMatch(ruta, /labelMadurez\(estadoMadurezLead\(lead\)\)/, 'la ruta vuelve a armar la cohorte por su cuenta: dos lugares que se separan');
});
