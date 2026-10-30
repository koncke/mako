// =============================================================================
// El «＋ Nuevo lead» en el CRM del teléfono (24/10/2026)
// =============================================================================
// Martín, 17/10: «rediseña las actuales de CRM, Plan… Siempre copia de otras apps que ya lo hacen bien» (se tomaron Pipedrive y
// HubSpot). El rediseño quedó, pero sin cómo cargar un lead: el encabezado tenía sólo la lupa. Ahora el botón flotante de la
// casa (app/m/_ui/BotonFlotanteM.tsx) abre una hoja con el MISMO alta del escritorio, en el funnel que se mira, y al crear
// abre la ficha del teléfono.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('el tablero del teléfono tiene «Nuevo lead»: el botón flotante abre el alta del escritorio en el funnel que se mira', () => {
  const t = leer('app/m/crm/TableroCrm.tsx');
  assert.match(t, /<BotonFlotanteM etiqueta="Nuevo lead" onClick=\{\(\) => setAlta\(true\)\} \/>/, 'sin el «＋»');
  assert.match(t, /<SheetM id="nuevo-lead" abierto=\{alta\} onCerrar=\{\(\) => setAlta\(false\)\} titulo="Nuevo lead"/);
  assert.match(t, /<NewLeadForm enModal=\{\{\n\s+funnelId: datos\.funnelId,/, 'el alta no va al funnel que se mira');
  // ⚠️ Cambiado A PROPÓSITO el 29/10/2026 (ticket #27): el push espera a que la hoja suelte su URL (tests/m-hoja-navegar-al-cerrar.test.ts).
  assert.match(t, /onCreado: \(id\) => \{ setAlta\(false\); navegarAlCerrar\(\(\) => router\.push\(ficha\(id\)\)\); \},/, 'al crear no abre la ficha del teléfono');
  // El botón flotante no tapa la última tarjeta.
  assert.match(t, /<HuecoFlotanteM \/>\n\s+<\/div>\n\s+<BotonFlotanteM/);
});
