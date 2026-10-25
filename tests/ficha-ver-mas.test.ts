// =============================================================================
// Las hojas de la ficha: al borde, sin la flechita, y «Ver más» cuando no entran (24/10/2026)
// =============================================================================
// Martín, textual (punto 14 del 24/10): «En el detail del lead, que las paginas comiencen a la izquierda del todo, no alineado
// al nombre. Y no pongas la flechita con esas opciones, para eso ya tenemos los 3 puntos al lado de "editar", que ese
// desplegable de los 3 puntos tambien esta desordenado... Y llegará un punto donde "nueva hoja" ya no se vea bien, ahí si
// deberías poner la ultima hoja con un desplegable, algo como "Ver más" o algo así y que ahí salte el desplegable con el resto
// de hojas y que el botón de "nueva hoja" se meta allí».
//   1. qué entra en la fila y qué va a «Ver más» (app/crm/lead-view/tabs-que-entran.ts, ejecutado);
//   2. el «⋯» de la ficha, por secciones y con lo de la hoja abierta (app/crm/lead-view/ficha/menu-contextual-ficha.ts);
//   3. el cableado: el «⋯» abre ese menú, y cada opción de la hoja hace lo mismo que el menú de su tab.
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tabsQueEntran } from '../app/crm/lead-view/tabs-que-entran';
import { itemsFicha, opcionesFicha, type HojaDelMenu } from '../app/crm/lead-view/ficha/menu-contextual-ficha';
import type { ItemMenuContextual } from '../app/_ui/MenuContextual';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

// Seis tabs de 100, con 2 de hueco: 610 de largo. «Nueva hoja» mide 110 y «Ver más» 90.
const base = { anchos: [100, 100, 100, 100, 100, 100], gap: 2, anchoNueva: 110, anchoVerMas: 90, activa: 0 };

test('1. si entra todo (con «Nueva hoja»), va todo en la fila y sin «Ver más»', () => {
  const r = tabsQueEntran({ ...base, disponible: 800 });
  assert.deepEqual(r, { visibles: [0, 1, 2, 3, 4, 5], ocultas: [], nuevaEnLinea: true, verMas: false });
  // Sin medir (el primer render), todas en la fila: es lo que había.
  assert.equal(tabsQueEntran({ ...base, disponible: 0 }).verMas, false);
});

test('1. cuando «Nueva hoja» no entra, la última hoja pasa a «Ver más» con «Nueva hoja» adentro', () => {
  // Las seis entran (610), y hasta con «Ver más» al lado (702), pero no con «Nueva hoja» (722): «la ultima hoja con un
  // desplegable». Sin esta regla, «Ver más» tendría sólo «Nueva hoja» y la fila seguiría igual de apretada.
  const r = tabsQueEntran({ ...base, disponible: 710 });
  assert.equal(r.nuevaEnLinea, false);
  assert.equal(r.verMas, true);
  assert.deepEqual(r.ocultas, [5], 'al menos una va adentro');
  // Más angosto: entran las que caben antes de «Ver más», en orden.
  const angosto = tabsQueEntran({ ...base, disponible: 420 });
  assert.deepEqual(angosto.visibles, [0, 1, 2]);
  assert.deepEqual(angosto.ocultas, [3, 4, 5]);
  // En el teléfono no se ofrece «Nueva hoja» (mide 0): si las tabs entran, no hay «Ver más».
  assert.equal(tabsQueEntran({ ...base, anchoNueva: 0, disponible: 650 }).verMas, false);
});

test('1. la abierta se ve siempre: si su lugar quedó adentro, ocupa el último de la fila', () => {
  const r = tabsQueEntran({ ...base, disponible: 420, activa: 5 });
  assert.ok(r.visibles.includes(5), 'la abierta escondida en «Ver más» no se encuentra');
  assert.deepEqual(r.visibles, [0, 1, 5]);
  assert.deepEqual(r.ocultas, [2, 3, 4]);
});

const hojaPropia: HojaDelMenu = { renombrar: true, templates: true, duplicar: true, mover: { izquierda: false, derecha: true }, volver: false, eliminar: true };
const ctx = { conTelefono: true, conEmail: true, conHistorial: true, puedeEditar: true, partners: null };

test('2. el «⋯» de la ficha: AI Analyst primero, por secciones, lo de la hoja abierta, y «Eliminar hoja» última', () => {
  const items = itemsFicha(opcionesFicha({ ...ctx, hoja: hojaPropia }), { hoja: hojaPropia });
  assert.equal(items[0]?.id, 'analyst');
  const titulos = items.filter((x): x is ItemMenuContextual => !!x?.seccion).map((x) => x.seccion);
  assert.deepEqual(titulos, ['Lead', 'Compartir', 'Esta hoja', 'Ficha']);
  const ult = items[items.length - 1];
  assert.equal(ult?.id, 'hoja_eliminar');
  assert.equal(ult?.peligro, true);
  assert.equal(items[items.length - 2], null, '«Eliminar hoja» va separada');
  // Las flechas de la hoja, en UNA línea; la que no tiene a dónde ir, apagada.
  const flechas = items.find((x): x is ItemMenuContextual => x?.id === 'hoja_izquierda+hoja_derecha');
  assert.deepEqual(flechas?.enLinea?.map((b) => [b.id, !!b.deshabilitado]), [['hoja_izquierda', true], ['hoja_derecha', false]]);
});

test('2. lo que no se puede con la hoja, no sale', () => {
  const ids = (h: HojaDelMenu | null) => opcionesFicha({ ...ctx, hoja: h });
  // Una de las cuatro del CRM sin tocar: ni mover, ni volver, ni eliminar.
  const fija = ids({ renombrar: true, templates: true, duplicar: true, mover: null, volver: false, eliminar: false });
  assert.ok(!fija.some((x) => x === 'hoja_izquierda' || x === 'hoja_volver' || x === 'hoja_eliminar'));
  assert.ok(ids({ ...hojaPropia, duplicar: false }).every((x) => x !== 'hoja_duplicar'), 'con el tope lleno, sin Duplicar');
  assert.ok(ids({ ...hojaPropia, mover: { izquierda: false, derecha: false } }).every((x) => x !== 'hoja_izquierda'), 'la única hoja no se mueve');
  // El Historial no es una hoja (o quien mira no edita): sin la sección.
  assert.ok(ids(null).every((x) => !x?.startsWith('hoja_')));
});

test('3. el «⋯» abre el menú de la ficha, la tab no tiene flechita, y las hojas arrancan al borde', () => {
  const f = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  assert.doesNotMatch(f, /<Dropdown value="" placeholder="⋯"/, 'volvió el desplegable propio del «⋯»');
  assert.match(f, /aria-label="Más opciones de la ficha" aria-haspopup="menu"/);
  assert.match(f, /items=\{itemsFicha\(opcionesFicha\(\{/);
  const elegir = f.slice(f.indexOf('const elegirMenuFicha = '), f.indexOf('const alClicDerechoFicha = '));
  for (const id of ['hoja_renombrar', 'hoja_templates', 'hoja_duplicar', 'hoja_izquierda', 'hoja_derecha', 'hoja_volver', 'hoja_eliminar']) {
    assert.match(elegir, new RegExp(`case '${id}':`), `«${id}» no hace nada`);
  }
  // «Cambiar nombre» desde el «⋯»: la tab abierta se pone a editar su nombre (como `irA`, con un número por pedido).
  assert.match(f, /renombrar=\{pedidoNombre\}/);
  const t = leer('app/crm/lead-view/LeadTabs.tsx');
  assert.match(t, /if \(renombrar && renombrar\.key === activeKey\) setARenombrar\(renombrar\.key\);/);
  assert.doesNotMatch(t, /lt-tab-mas/, 'volvió la flechita de la tab');
  assert.doesNotMatch(t, /sangria/, 'volvió la sangría');
  // «Ver más» lleva a las que no entran y «Nueva hoja» adentro.
  assert.match(t, /\{onNueva && !reparto\.nuevaEnLinea && \(/);
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 6 / 0, de a una y restaurando de una copia:
//   · `tabsQueEntran` sin el `entran.pop()` (con «Ver más» y ninguna adentro)          → 5 / 1
//   · la abierta sin su lugar reservado (`usado = 0`)                                 → 4 / 2
//   · «Eliminar hoja» sin `peligro`                                                   → 5 / 1
//   · `opcionesFicha` ofreciendo Duplicar con el tope lleno                           → 5 / 1
