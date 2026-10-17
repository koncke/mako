// =============================================================================
// #893: una campaña o un conjunto de Meta apunta a UNO O VARIOS funnels (17/10/2026)
// =============================================================================
// Martín, 17/10: «estoy seguro que no solamente en los OKR, esa configuración seguro debe faltar en varios lugares».
// Hasta hoy `meta.campanas` llevaba UN funnel por campaña. Ahora cada asignación tiene su casa (`funnelId`) y los
// otros (`tambien`), con el molde de las landings: el lead nuevo NACE en la casa y se AGREGA a los demás
// (`lead_funnel`). Lo que se fija, EJECUTANDO las reglas puras y mirando el cableado:
//   1. el saneo: `tambien` sin repetir, sin la casa, con `null` = el del negocio, con tope;
//   2. la casilla (`alternarFunnelDeCampana`): suma, saca, y sacar la casa promueve al primero de los otros;
//   3. el ruteo devuelve los otros (los archivados no) y el conjunto sigue ganándole a la campaña;
//   4. el funnel que la tiene como «otro» la ve en su sección y en el bloque Tracking;
//   5. las DOS puertas de un lead de Meta (el formulario y el opt-in de la landing) agregan los otros.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 6 / 0, una rotura por vez y restaurada:
//   · el saneo sin sacar la casa de `tambien`                                   → 5 / 1
//   · sacar la casa SIN promover al primero de los otros                        → 5 / 1
//   · el ruteo sin filtrar los otros por `esViva`                               → 5 / 1
//   · `asignadasDe` mirando sólo la casa                                        → 5 / 1
//   · el formulario de Meta sin agregar los otros                               → 5 / 1
//   · el opt-in de la landing con la campaña de UN funnel                       → 5 / 1
// Correr: node --import tsx --test tests/campana-varios-funnels.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  alternarFunnelDeCampana, asignadasDe, funnelIdDeCampana, funnelsDeAsignada, parsearCampanas, MAX_TAMBIEN,
  type CampanaAsignada,
} from '../lib/campana-config';
import { funnelTieneCampana } from '../lib/tracking-ficha';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const C = '1200000000001';
const S = '1200000000002';
const camp = (funnelId: number | null, tambien?: Array<number | null>): CampanaAsignada => ({ tipo: 'campana', id: C, nombre: 'VSL', funnelId, ...(tambien ? { tambien } : {}) });

test('el saneo: los otros sin repetir, sin la casa, con el del negocio como null y con tope', () => {
  const [c] = parsearCampanas(JSON.stringify([{ tipo: 'campana', id: C, nombre: 'VSL', funnelId: '7', tambien: [7, '8', null, 8, 'x', -3, null] }]));
  assert.equal(c.funnelId, 7);
  assert.deepEqual(c.tambien, [8, null], 'la casa no se repite en los otros, ni los otros entre sí');
  const [sin] = parsearCampanas(JSON.stringify([{ tipo: 'campana', id: C, nombre: 'VSL', funnelId: 7 }]));
  assert.equal('tambien' in sin, false, 'sin otros, la fila es la de siempre');
  const [mucho] = parsearCampanas(JSON.stringify([{ tipo: 'campana', id: C, nombre: 'VSL', funnelId: 1, tambien: Array.from({ length: 30 }, (_, i) => i + 2) }]));
  assert.equal(mucho.tambien?.length, MAX_TAMBIEN);
  assert.deepEqual(funnelsDeAsignada(c), [7, 8, null], 'la casa primero');
});

test('la casilla suma y saca un funnel; sacar la casa promueve al primero de los otros', () => {
  const sumo = alternarFunnelDeCampana([camp(7)], C, 9);
  assert.deepEqual(sumo?.[0], camp(7, [9]));
  const saco = alternarFunnelDeCampana([camp(7, [9, null])], C, 9);
  assert.deepEqual(saco?.[0], camp(7, [null]));
  const casa = alternarFunnelDeCampana([camp(7, [9, null])], C, 7);
  assert.deepEqual(casa?.[0], camp(9, [null]), 'sin la casa, el primero de los otros pasa a ser la casa');
  assert.deepEqual(alternarFunnelDeCampana([camp(7)], C, 7), [], 'sin otros, sacar la casa la deja sin asignar');
  assert.equal(alternarFunnelDeCampana([], C, 7), null, 'sin asignar, la casilla es asignarla (con su pregunta)');
});

test('el ruteo devuelve los otros vivos, y el conjunto sigue ganándole a la campaña', () => {
  const conj: CampanaAsignada = { tipo: 'conjunto', id: S, nombre: 'Frío', campanaId: C, funnelId: 5, tambien: [6] };
  const vivos = new Set<number | null>([7, 8, null, 5, 6]);
  const r = funnelIdDeCampana([camp(7, [8, 99, null])], { campaignId: C }, (f) => vivos.has(f));
  assert.ok(r.asignada);
  assert.equal(r.funnelId, 7);
  assert.deepEqual(r.tambien, [8, null], 'un funnel archivado no entra, y no le saca nada a los demás');
  const r2 = funnelIdDeCampana([camp(7, [8]), conj], { campaignId: C, adsetId: S });
  assert.ok(r2.asignada && r2.funnelId === 5);
  assert.deepEqual(r2.asignada && r2.tambien, [6], 'el conjunto manda ENTERO: su casa y sus otros');
});

test('el funnel que la tiene como «otro» la ve: su sección de campañas y el bloque Tracking', () => {
  assert.deepEqual(asignadasDe([camp(7, [8])], 8).map((c) => c.id), [C]);
  assert.deepEqual(asignadasDe([camp(7, [8])], 9), []);
  assert.equal(funnelTieneCampana([camp(7, [null])], null, 1), true, 'el del negocio como otro');
  assert.equal(funnelTieneCampana([camp(7, [8])], 9, 1), false);
});

test('las dos puertas de un lead de Meta agregan los otros funnels', () => {
  const ruteo = leer('lib/campana-funnel.ts');
  assert.match(ruteo, /const otros = \[\.\.\.new Set\(r\.tambien\s*\.map\(\(f\) => \(f == null \? def\?\.id \?\? null : f\)\)/, 'los otros salen con su id REAL (lead_funnel)');
  const meta = leer('lib/leads.ts');
  const alta = meta.slice(meta.indexOf('if (error) throw new Error(`Error creando lead desde Meta'), meta.indexOf('return { created: true, lead: data as Lead };'));
  assert.match(alta, /for \(const f of porCampana\.otros\) \{\n\s*try \{\n\s*await agregarAProducto\(\(data as Lead\)\.id, f, \{ autor: 'Meta' \}\);/, 'el formulario de Meta no agrega los otros');
  const optin = leer('app/api/track/optin/route.ts');
  assert.match(optin, /porCampana\.asignada \? \[porCampana\.funnelId, \.\.\.porCampana\.otros\] : funnelesDeLaLanding/, 'el opt-in de la landing no agrega los otros');
});

test('las pantallas: la celda tiene casillas y la ✕ del funnel saca sólo ese funnel', () => {
  const celda = leer('app/ads-manager/ProductoCelda.tsx');
  assert.match(celda, /varios=\{marcados\}/);
  assert.match(celda, /if \(asignada && marcados\.includes\(valor\)\) \{ await alternar\(funnelId, false\); return; \}/, 'desmarcar no pregunta: nadie sale');
  const seccion = leer('app/crm/CampanasDelProducto.tsx');
  assert.match(seccion, /alternarFunnelCampanaAction\(funnelId, \{ tipo: a\.tipo, id: a\.id, nombre: a\.nombre, campanaId: a\.campanaId \}\)/);
  assert.doesNotMatch(seccion, /quitarCampanaAction/, 'la ✕ de un funnel no puede sacar la campaña de los demás');
});

// #893, la otra mitad (17/10/2026): un lead que YA existía y vuelve por una campaña de otro funnel se SUMA a los funnels
// de esa campaña (agregar, nunca mover), como el nuevo. Antes quedaba sólo en el suyo, con una línea en el historial.
// Verificado rompiéndolo: `funnelsDeCampanaParaSumar` sin sacar la casa → 7 / 1 (éste); el `if (porCampana.asignada)`
// del lead existente sin el `agregarAProducto` → 7 / 1 (éste).
test('el lead que vuelve por una campaña de otro funnel se suma a ése (sin salir del suyo)', async () => {
  const { funnelsDeCampanaParaSumar } = await import('../lib/lead-funnel-reglas');
  // Casa 7; la campaña es del 9 y también del 12 y del negocio (null = el 1).
  assert.deepEqual(funnelsDeCampanaParaSumar(7, { funnelId: 9, otros: [12, 7] }, 1), [9, 12], 'sin su casa');
  assert.deepEqual(funnelsDeCampanaParaSumar(null, { funnelId: null, otros: [9] }, 1), [9], 'su casa es el del negocio');
  assert.deepEqual(funnelsDeCampanaParaSumar(7, { funnelId: null, otros: [] }, null), [], 'el del negocio sin su id no se suma');
  assert.deepEqual(funnelsDeCampanaParaSumar(7, { funnelId: 7, otros: [] }, 1), [], 'volvió por una campaña de su propio funnel');
  const src = readFileSync(join(import.meta.dirname, '..', 'lib', 'leads.ts'), 'utf8').replace(/\r\n/g, '\n');
  const rama = src.slice(src.indexOf('  if (existing) {', src.indexOf('export async function upsertLeadFromMeta(')), src.indexOf('  // INSERT nuevo — fechas de agenda/J1 NULL'));
  assert.match(rama, /for \(const f of await funnelsAlVolver\(existing\.funnel_id \?\? null, porCampana\)\) \{\s*try \{\s*await agregarAProducto\(existing\.id, f, \{ autor: 'Meta' \}\);/);
});
