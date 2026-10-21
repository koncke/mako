// =============================================================================
// El clic derecho dentro de la ficha de un lead (20/10/2026; docs/pedidos-crm.md, D3)
// =============================================================================
// Martín (14/10/2026): «implementa el click derecho en todo el CRM para diferentes acciones dependiendo donde clickee».
// El tablero y la lista lo tienen desde el 14/10; la ficha, desde hoy. Las opciones son las del «⋯» de la ficha más las
// rápidas del lead (app/crm/lead-view/ficha/menu-contextual-ficha.ts), y cada una hace lo mismo que su renglón del «⋯».
//   1. qué sale y en qué orden, según lo que el lead tiene (ejecutado);
//   2. sobre un campo, un link o texto seleccionado queda el menú del navegador (para copiar y pegar) (ejecutado);
//   3. la ficha escucha el clic derecho, y cada opción tiene su `case` (ninguna «no hace nada»).
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 3 / 0, de a una rotura y restaurada:
//   · `menuPropioEn` siempre true (el menú propio tapaba el de copiar y pegar)  → 2 / 1
//   · la ficha sin `onContextMenu`                                              → 2 / 1
//   · `elegirMenuFicha` sin el `case 'copiar_link'`                             → 2 / 1
// Correr: node --import tsx --test tests/crm-ficha-clic-derecho.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPCION_FICHA, menuPropioEn, opcionesFicha, type IdOpcionFicha } from '../app/crm/lead-view/ficha/menu-contextual-ficha';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const todo = { conTelefono: true, conEmail: true, conHistorial: true, puedeEditar: true, partners: 'llevar' as const };

test('qué ofrece el clic derecho de la ficha, según lo que el lead tiene', () => {
  assert.deepEqual(opcionesFicha(todo), [
    'whatsapp', 'copiar_telefono', 'copiar_email', 'copiar_link', null, 'analyst', null, 'exportar_csv', 'exportar_pdf',
    null, 'historial', 'guia', null, 'partners_llevar',
  ]);
  const minimo = opcionesFicha({ conTelefono: false, conEmail: false, conHistorial: false, puedeEditar: false, partners: null });
  assert.deepEqual(minimo, ['copiar_link', null, 'analyst', null, 'exportar_csv', 'exportar_pdf'], 'sin teléfono no hay WhatsApp, y sin separadores colgando');
  assert.ok(opcionesFicha({ ...todo, partners: 'ver' }).includes('partners_ver'));
});

test('sobre un campo, un link o texto seleccionado, el menú es el del navegador', () => {
  const sobre = (hay: boolean) => ({ closest: () => (hay ? {} : null) });
  assert.equal(menuPropioEn(sobre(false), false), true, 'sobre la ficha: el menú propio');
  assert.equal(menuPropioEn(sobre(true), false), false, 'sobre un input o un link: el del navegador');
  assert.equal(menuPropioEn(sobre(false), true), false, 'con texto seleccionado: el del navegador (para copiarlo)');
  assert.equal(menuPropioEn(null, false), true);
});

test('la ficha escucha el clic derecho y cada opción hace algo', () => {
  const f = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  assert.match(f, /<div ref=\{raizRef\}[^>]*\n\s+onContextMenu=\{alClicDerechoFicha\}>/, 'la ficha no escucha el clic derecho');
  const elegir = f.slice(f.indexOf('const elegirMenuFicha = '), f.indexOf('const alClicDerechoFicha = '));
  for (const id of Object.keys(OPCION_FICHA) as IdOpcionFicha[]) assert.match(elegir, new RegExp(`case '${id}':`), `«${OPCION_FICHA[id].texto}» no hace nada`);
  assert.match(f, /if \(!menuPropioEn\(e\.target as Element \| null, seleccion\.length > 0\)\) return;/);
  assert.match(f, /\{ventanaMenuFicha\}/, 'el menú no se monta');
});
