// =============================================================================
// La moneda del negocio tiene pantalla (17/10/2026)
// =============================================================================
// Existía desde la tanda B del CRM (`negocio.moneda`, lib/pagos.ts) y sólo se cambiaba pidiéndoselo a MaKo
// (`cambiar_moneda_negocio`). Ahora vive en Configuración del negocio → Identidades fiscales, con las MISMAS acciones
// que ya cortaban sin sesión y sin rol (app/crm/[id]/pagos-campo-actions.ts). Asserts sobre el fuente.
//
// Probado rompiéndolo (17/10/2026; base 3 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · la página fiscal sin el panel                                    -> 2 / 1
//   · el panel deja elegir a quien no administra (sin `!puedeEditar`)   -> 2 / 1
//   · el panel no vuelve a la moneda anterior si guardar falla          -> 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('la página de Identidades fiscales monta la moneda del negocio', () => {
  assert.match(leer('app/configuraciones/fiscal/page.tsx'), /<MonedaNegocioPanel \/>/);
});

test('sólo quien administra la puede elegir (la acción lo corta igual)', () => {
  const p = leer('app/configuraciones/MonedaNegocioPanel.tsx');
  assert.match(p, /disabled=\{moneda == null \|\| !puedeEditar \|\| pending\}/);
  assert.match(leer('app/crm/[id]/pagos-campo-actions.ts'), /if \(!\(await esAdmin\(\)\)\) return \{ ok: false, error: SOLO_ADMIN \};/);
});

test('si guardar falla, vuelve a la que estaba y lo dice', () => {
  assert.match(leer('app/configuraciones/MonedaNegocioPanel.tsx'), /else \{ setMoneda\(antes\); setAviso\(\{ ok: false, texto: r\.error \}\); \}/);
});
