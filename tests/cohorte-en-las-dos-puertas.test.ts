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
//
// ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026 (la ficha por bloques): las dos puertas ya no montan la tarjeta a
// mano. Las dos montan `FichaPorBloques` con la lectura de `getLeadFullAction`, y el contacto
// (InfoPrincipalCard) se monta UNA vez, en el registro del Resumen (app/crm/lead-view/ficha/registro-resumen.tsx).
// Se prueba ahí que le pasa la cohorte del server, y que la ruta no la arma por su cuenta.
// Re-verificado rompiéndolo (14/10/2026): sacar `cohorte={data.cohorte ?? null}` del registro → 2 / 1; la
// ruta con `cohorteDeLead(lead)` de vuelta → 2 / 1.
//
// ⚠️ REESCRITO EL 16/10/2026 (el Resumen nativo): el contacto dejó de ser InfoPrincipalCard ENTERA (que sigue en
// Customer Success) y es su propio bloque (app/crm/lead-view/ficha/resumen/contacto.tsx), que dibuja la cohorte del
// server mientras Reuniones no tenga su bloque (`incluye: ['cohorte']`). Lo que se fija no cambia: la cohorte llega de
// `getLeadFullAction` a las dos puertas por la MISMA pieza. Re-verificado rompiéndolo (16/10/2026, base 3/0): el bloque
// sin leer `data.cohorte` → 2 / 1; el contacto sin `incluye: ['cohorte']` → 2 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la ficha (las dos puertas) dibuja la cohorte del server en el bloque del contacto', async () => {
  const src = leer('app/crm/lead-view/ficha/resumen/contacto.tsx');
  assert.match(src, /const cohorte = data\.cohorte && seVe\(data\.resumen \?\? \{\}, 'cohorte'\) \? data\.cohorte : null;/, 'la ficha vuelve a esconder la cohorte');
  assert.match(src, /\{cohorte && \(\s*<Prop k="Cohorte">/, 'y la dibuja');
  const { REGLAS_RESUMEN } = await import('../app/crm/lead-view/ficha/reglas-resumen');
  assert.deepEqual([...(REGLAS_RESUMEN.contacto.incluye ?? [])], ['cohorte'], 'el contacto dice que dibuja la cohorte (si no, la plantilla de respaldo la perdería)');
  for (const puerta of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(leer(puerta), /<FichaPorBloques\b/, `${puerta}: no monta la ficha compartida`);
  }
});

test('la action la resuelve en el server, con la función de la ruta', () => {
  assert.match(leer('app/crm/actions.ts'), /cohorte: cohorteDeLead\(lead\)/);
});

test('la ruta y el panel usan la MISMA función: la ruta lee con la action del panel', () => {
  const ruta = leer('app/crm/[id]/page.tsx');
  assert.match(ruta, /await getLeadFullAction\(idNum\)/);
  assert.doesNotMatch(ruta, /cohorteDeLead\(|labelMadurez\(estadoMadurezLead\(lead\)\)/, 'la ruta vuelve a armar la cohorte por su cuenta: dos lugares que se separan');
});
