// F154 (18/11/2026): una calificación que viajó a Meta ANTES de que existiera la marca `LINEA_CALIFICADO_EN_META`
// (17/10/2026) cuenta como «ya mandada»: volver a marcar a ese lead no suma una segunda conversión. La prueba es su línea
// «Calificado: Sí» del historial, sólo dentro de la ventana en que se mandaba con los nombres de hoy (`CALIFICADO_SIN_MARCA`,
// lib/meta-capi-payload.ts). Se ejecuta la regla con líneas armadas.
//
// Probado rompiéndolo (base 5/0):
//   · sin mirar el «Calificado: Sí» de la ventana (sólo la marca) → 4/1;
//   · la ventana sin su punta de arriba (todo «Calificado» desde el 05/10) → 4/1;
//   · la ventana sin su punta de abajo (todo «Calificado» de antes del 17/10) → 4/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CALIFICADO_SIN_MARCA, CAMPO_CALIFICADO, LINEA_CALIFICADO_EN_META, SI_EN_EL_HISTORIAL, calificacionYaEnMeta,
} from '../lib/meta-capi-payload';

const si = (created_at: string) => ({ campo: CAMPO_CALIFICADO, valor_nuevo: SI_EN_EL_HISTORIAL, created_at });

test('la marca de hoy dice que ya viajó', () => {
  assert.equal(calificacionYaEnMeta([{ campo: 'Meta', valor_nuevo: LINEA_CALIFICADO_EN_META, created_at: '2026-11-01T10:00:00Z' }]), true);
  assert.equal(calificacionYaEnMeta([]), false, 'sin nada en el historial, se manda');
  assert.equal(calificacionYaEnMeta([{ campo: 'Meta', valor_nuevo: 'No entró la conversión QualifiedLead: …', created_at: '2026-11-01T10:00:00Z' }]), false,
    'un rechazo de Meta no es que entró');
});

test('un «Calificado: Sí» entre el 05/10 y el 17/10 viajó sin dejar la marca: cuenta como mandado', () => {
  assert.equal(calificacionYaEnMeta([si('2026-10-10T15:00:00Z')]), true);
  assert.equal(calificacionYaEnMeta([si(CALIFICADO_SIN_MARCA.desde)]), true, 'la punta de abajo entra');
});

test('un «Calificado» de antes del 05/10 viajó como `Lead`: su primera calificación todavía no llegó', () => {
  assert.equal(calificacionYaEnMeta([si('2026-09-20T15:00:00Z')]), false);
});

test('un «Calificado» de después del 17/10 sin la marca es uno que NO entró: se vuelve a intentar', () => {
  assert.equal(calificacionYaEnMeta([si('2026-10-20T15:00:00Z')]), false);
  assert.equal(calificacionYaEnMeta([si(CALIFICADO_SIN_MARCA.hasta)]), false, 'la punta de arriba no entra');
  assert.equal(calificacionYaEnMeta([{ campo: CAMPO_CALIFICADO, valor_nuevo: 'No', created_at: '2026-10-10T15:00:00Z' }]), false, 'un «No» no es una calificación');
  assert.equal(calificacionYaEnMeta([{ campo: CAMPO_CALIFICADO, valor_nuevo: SI_EN_EL_HISTORIAL, created_at: null }]), false, 'sin fecha no se sabe');
});

test('el historial escribe «Calificado» y «Sí» con las mismas palabras que la regla lee', () => {
  // `AUDIT_FIELDS` vive en lib/leads.ts, que no se puede importar en un test (server-only): se mira que el campo nombre la
  // constante y no un texto propio, y que `auditVal` escriba el «Sí» que lee la regla.
  const src = readFileSync(fileURLToPath(new URL('../lib/leads.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /\{ k: 'calificado', label: CAMPO_CALIFICADO \}/);
  assert.match(src, /if \(typeof v === 'boolean'\) return v \? 'Sí' : 'No';/);
  assert.equal(SI_EN_EL_HISTORIAL, 'Sí');
});
