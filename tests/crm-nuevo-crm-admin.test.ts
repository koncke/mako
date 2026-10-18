// =============================================================================
// «Nuevo CRM» se le ofrece SÓLO al admin (17/10/2026)
// =============================================================================
// `crearCrmAction` (app/crm/nuevo-crm-actions.ts) corta a quien no es admin, pero el desplegable del tablero le ofrecía
// «Nuevo CRM» a un closer: completaba los dos pasos (nombre y tipo) y recién al final leía «Solo el administrador puede
// crear un CRM» (docs/relevo/crm-tanda-b1.md, b3). La página pregunta lo MISMO que la acción y el selector lo usa.
//
// Verificado rompiéndolo (el archivo da 1 / 0): sin el `if (puedeCrear)` del selector → 0 / 1; con la página
// preguntando `!= null` en vez de `=== 'admin'` → 0 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('«Nuevo CRM» sólo para el admin: la página pregunta lo que pregunta la acción, y el selector lo respeta', () => {
  const accion = leer('app/crm/nuevo-crm-actions.ts');
  assert.match(accion, /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ error: 'Solo el administrador puede crear un CRM\.' \};/);
  const page = leer('app/crm/page.tsx');
  assert.match(page, /const pPuedeCrear = getRolWsEfectivo\(\)\.then\(\(r\) => r === 'admin', \(\) => false\);/);
  assert.match(page, /puedeCrearCrm=\{puedeCrearCrm\}/);
  assert.match(leer('app/crm/CrmBoard.tsx'), /<SelectorFunnel [^>]*puedeCrear=\{!!puedeCrearCrm\}/);
  const tb = leer('app/crm/CrmToolbar.tsx');
  const sel = tb.slice(tb.indexOf('export function SelectorFunnel'));
  assert.match(sel, /if \(puedeCrear\) opciones\.unshift\(\{ value: NUEVA, label: 'Nuevo CRM', crear: true \}\);/);
});
