// =============================================================================
// «Asignar fuentes» no se ofrece en un funnel de Prospección (18/11/2026)
// =============================================================================
// Martín, 12/10/2026: «que las opciones estén referidas al FUNNEL, como "Anuncios a Landing", "Anuncios a WhatsApp",
// "Prospección"», y Prospección «no tiene Meta por ningún lado». docs/feedback-diseno-pendiente.md (fila del 12/10,
// re-medida el 18/11): el «⋯» y el clic derecho de la columna de entrada ofrecían «Asignar fuentes» sin mirar el tipo de
// funnel. La regla (`ofreceAsignarFuentes`) y el menú (`opcionesCrm`) son puros y se EJECUTAN; el cableado (la página
// lee las entradas del funnel y el tablero las pasa al contexto de la columna) se mira en el fuente.
//
// Correr: node --import tsx --test tests/crm-fuentes-prospeccion.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026, base 3/0), cada rotura restaurada antes de la siguiente:
//   · `opcionesCrm` sin mirar `fuentes` (vuelve a ofrecerse en Prospección)            → 2 / 1 («el menú»)
//   · `ofreceAsignarFuentes` escondiéndolo también sin tipo declarado (`[]`)           → 2 / 1 («la regla»)
//   · el tablero sin `fuentes` en el contexto de la columna                            → 2 / 1 («el cableado»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ofreceAsignarFuentes, opcionesCrm, type ContextoCrm } from '../app/crm/menu-contextual-crm';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la regla: sólo un funnel DECLARADO de Prospección la apaga', () => {
  assert.equal(ofreceAsignarFuentes(['chat_saliente']), false, 'Prospección: tú les escribes, no hay fuentes que traigan gente');
  assert.equal(ofreceAsignarFuentes(['landing']), true, 'Anuncios a Landing');
  assert.equal(ofreceAsignarFuentes(['chat_entrante']), true, 'Anuncios a WhatsApp');
  assert.equal(ofreceAsignarFuentes(['formulario_anuncio']), true, 'Anuncios a formulario');
  assert.equal(ofreceAsignarFuentes([]), true, 'sin tipo declarado no se afirma nada: se sigue ofreciendo');
  assert.equal(ofreceAsignarFuentes(null), true, 'sin leer el funnel, lo de siempre');
});

test('el menú de la columna de entrada: «Asignar fuentes» sí en uno de anuncios, no en Prospección', () => {
  const col = (o: Partial<Extract<ContextoCrm, { sobre: 'columna' }>> = {}): ContextoCrm =>
    ({ sobre: 'columna', mover: false, entrada: true, curso: null, borrable: false, ...o });
  assert.ok(opcionesCrm(col({ fuentes: ofreceAsignarFuentes(['landing']) })).includes('col_campanas'));
  assert.ok(!opcionesCrm(col({ fuentes: ofreceAsignarFuentes(['chat_saliente']) })).includes('col_campanas'));
  assert.ok(opcionesCrm(col()).includes('col_campanas'), 'sin el campo, lo de siempre');
  assert.ok(!opcionesCrm(col({ entrada: false })).includes('col_campanas'), 'fuera de la entrada, nunca');
  // Lo demás de la columna sigue igual en Prospección: sólo se va ese renglón.
  const pros = opcionesCrm(col({ fuentes: false }));
  assert.ok(pros.includes('col_nuevo_lead') && pros.includes('col_renombrar'));
});

test('el cableado: la página lee las entradas del funnel y el tablero las pasa a la columna', () => {
  const pagina = sinComentarios(leer('app/crm/page.tsx'));
  assert.match(pagina, /const pEntradas = \(funnelId \? getFunnelDe\(funnelId\) : getFunnelDefault\(\)\)\.then\(\(f\) => f\.entradas\)/);
  assert.match(pagina, /entradasFunnel=\{await pEntradas\}/);
  const tablero = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(tablero, /entrada: c\.kind === 'entrada', fuentes: ofreceAsignarFuentes\(entradasFunnel\),/);
});
