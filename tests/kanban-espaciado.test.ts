// =============================================================================
// El espaciado de los kanban: las medidas del tablero de Merrin (31/10/2026)
// =============================================================================
// Martín: las reglas de espaciado del Dashboard también van a CRM y Kanban. Los valores se leyeron de la demo y están en
// docs/diseno/espaciado-kanban.json. Este test mide que los tres tableros digan lo mismo que ese archivo.
//
// Correr: node --import tsx --test tests/kanban-espaciado.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');
const MEDIDO = JSON.parse(leer('docs/diseno/espaciado-kanban.json'));
const px = (v: string) => Number.parseInt(v, 10);

test('el CRM: la columna, su cabecera, su cuerpo y el tablero', () => {
  const b = leer('app/crm/CrmBoard.tsx');
  const radio = px(MEDIDO.columna['border-radius']);
  assert.equal(b.split(`FONDO_COLUMNA, border: 'none', borderRadius: ${radio},`).length - 1, 1, 'la columna');
  assert.match(b, new RegExp(`width: 304, background: FONDO_COLUMNA, borderRadius: ${radio},`), 'la columna de «cargando más»');
  // El relleno de la columna (10) más el de su cabecera (4, 4, 10), sobre la cabecera porque la columna no lleva relleno propio.
  assert.match(b, /justifyContent: 'space-between', gap: 8, padding: '14px 14px 10px',/);
  assert.match(b, /<div data-carril style=\{\{ flex: 1, minHeight: 0, padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8,/);
  assert.match(b, /display: 'flex', gap: 12, alignItems: 'stretch', width: 'max-content'/);
  assert.equal(px(MEDIDO.tablero.gap), 12);
  assert.equal(px(MEDIDO.cuerpo.gap), 8);
});

test('lo que se ve mientras carga mide lo mismo: si no, el tablero salta', () => {
  const l = leer('app/crm/loading.tsx');
  assert.match(l, /display: 'flex', gap: 12, alignItems: 'stretch'/);
  assert.match(l, /width: 304, background: 'var\(--fondo-columna\)', borderRadius: 18, padding: '14px 10px 10px'/);
  assert.match(l, /borderRadius: 14, padding: '12px 12px 10px'/);
});

test('la tarjeta de la familia', () => {
  const t = leer('app/_ui/TarjetaKanban.tsx');
  assert.match(t, new RegExp(`\\.tk \\{[^}]*border-radius: ${MEDIDO.tarjeta['border-radius']}; padding: ${MEDIDO.tarjeta.padding};`));
  assert.match(t, /\.tk \{[^}]*display: grid; gap: 8px;/);
  assert.match(t, /\.tk\.tk--compacta \{ padding: 8px 10px; gap: 6px; border-radius: 14px; \}/);
});

test('el Plan y Clients: la misma columna', () => {
  const p = leer('app/plan/board/BoardShell.tsx');
  assert.match(p, /FONDO_COLUMNA, border: 'none', borderRadius: 18, padding: 10,/);
  const c = leer('app/customer-success/KanbanEntrega.tsx');
  assert.match(c, /\.ke-col \{[^}]*border-radius: 18px; padding: 10px;/);
  assert.match(c, /\.ke-cards \{[^}]*gap: 8px;/);
});

test('el ancho no se copia, y el teléfono no se tocó: no se midió', () => {
  assert.match(MEDIDO._no_se_copia, /304/);
  assert.match(leer('app/crm/CrmBoard.tsx'), /flex: 'none', width: 304,/);
  assert.match(leer('app/m/m.css'), /background: var\(--fondo-columna\); border-radius: 26px;/);
});
