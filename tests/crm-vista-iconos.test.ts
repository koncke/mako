// =============================================================================
// «Tablero» y «Lista» sólo con íconos, con tooltip (20/10/2026)
// =============================================================================
// Martín, 20/10 (en la app, con captura de /crm): «Los botones de "Tablero y lista" solo con íconos debería estar».
// El nombre de la vista queda en el tooltip de la casa (app/_ui/Tooltip.tsx) y en el `aria-label`.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 1 / 0: app/crm/CrmToolbar.tsx de antes (ícono + nombre) → 0 / 1.
// Correr: node --import tsx --test tests/crm-vista-iconos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('el selector de vista del CRM: sólo el ícono, con el nombre en el tooltip y en el aria-label', () => {
  const tb = readFileSync(join(__dirname, '..', 'app/crm/CrmToolbar.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const sel = tb.slice(tb.indexOf('export function VistaSelector'), tb.indexOf('\n}\n', tb.indexOf('export function VistaSelector')));
  assert.match(sel, /<Tooltip key=\{v\} text=\{NOMBRE\[v\]\}/, 'el nombre va en el tooltip');
  assert.match(sel, /aria-label=\{NOMBRE\[v\]\}/, 'y en el aria-label');
  assert.match(sel, />\s*\{ICONO_VISTA\[v\]\.icono\}\s*<\/button>/, 'el botón lleva SÓLO el ícono');
  assert.doesNotMatch(sel, /\{ICONO_VISTA\[v\]\.icono\}\{NOMBRE\[v\]\}/, 'volvió el nombre al lado del ícono');
});
