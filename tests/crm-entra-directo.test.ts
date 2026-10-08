// =============================================================================
// El CRM entra directo: sin panel de activación delante del tablero
// =============================================================================
// Pedido de Martín (08/10/2026, en el audio del feedback del curso): «vos actualmente en el CRM
// tenés como el pre onboarding del CRM, yo lo que quiero hacer es quitar eso… tengo que quitar
// toda la fricción que hay en el CRM y que se entre automáticamente». El que probaba: «no
// entiendo nada, siento que es mucho texto también».
//
// Correr: npx tsx --test tests/crm-entra-directo.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026): devolver el `if (…) return <PanelActivacion …/>` a la
// página da 1 pase / 1 fallo; sacar la entrada `crm` de TABS_ACTIVACION, también 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tabActivacion } from '../lib/tab-activacion';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la página del CRM no pone ningún panel delante del tablero', () => {
  const src = sinComentarios(leer('app/crm/page.tsx'));
  assert.doesNotMatch(src, /PanelActivacion|tabActivacion\(/, 'volvió el pre-onboarding del CRM');
  // Y lo que hace es dibujar el tablero.
  assert.match(src, /<CrmBoard\b/);
});

test('lo que el panel decía sigue disponible para MaKo (qué conectar para que entren solos)', () => {
  // `ver_activacion_tab` (lib/api-mako/areas/integraciones.run.ts) lo contesta cuando se lo
  // preguntan: el dato se queda, lo que se fue es la pantalla que frenaba.
  const t = tabActivacion('crm');
  assert.ok(t, 'la entrada crm de TABS_ACTIVACION tiene que seguir');
  assert.ok(t.queFalta.length > 0);
});
