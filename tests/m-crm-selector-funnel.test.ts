// =============================================================================
// El selector de funnel del teléfono: sin tilde, el actual primero (24/10/2026)
// =============================================================================
// Martín, 29/09 (docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»): «No pongas un check. Solo haz que sea más
// notorio que estamos parados en ese producto», y «el producto que estoy parado debería estar primero». El escritorio lo
// cumplía (app/crm/CrmToolbar.tsx, `enOrden`); el teléfono seguía con el tilde y en el orden de la base.
//
// PROBADO ROMPIÉNDOLO: con `datos.funnels.map` de vuelta en vez de la lista reordenada, falla el primero; con el tilde
// devuelto al `riel`, el segundo; sin la clase del actual en el título, el tercero.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'app/m/crm/TableroCrm.tsx'), 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('<SheetM id="funnel"');
const hoja = src.slice(ini, src.indexOf('</SheetM>', ini));

test('el funnel actual va primero', () => {
  assert.ok(hoja.length > 50, 'no encontré la hoja de funnels');
  assert.match(hoja, /\[\.\.\.datos\.funnels\.filter\(\(f\) => f\.id === datos\.funnelId\), \.\.\.datos\.funnels\.filter\(\(f\) => f\.id !== datos\.funnelId\)\]\.map\(/,
    'la lista sale en el orden de la base');
  assert.doesNotMatch(hoja, /\{datos\.funnels\.map\(/, 'la lista sale en el orden de la base');
});

test('sin tilde', () => {
  assert.doesNotMatch(hoja, /nombre="check"/, 'el actual vuelve a llevar tilde');
  assert.doesNotMatch(hoja, /riel=/);
});

test('el actual se nota en el título', () => {
  assert.match(hoja, /titulo=\{es \? <span className="m-crm-funnel-actual">\{f\.nombre\}<\/span> : f\.nombre\}/);
  const css = readFileSync(join(__dirname, '..', 'app/m/crm/crm.css'), 'utf8');
  assert.match(css, /\.m-crm-funnel-actual \{ color: var\(--primary-strong\); font-weight: 700; \}/);
});
