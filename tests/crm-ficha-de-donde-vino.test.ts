// =============================================================================
// C8 de la llamada con Mauricio (22/10/2026): la ficha dice en qué otros CRMs está el lead («de dónde vino»)
// =============================================================================
// Min 22:29-24:01: el Sprint termina en una R1 que vive en el CRM principal. Martín: «en la R1 de allá, de alguna manera,
// marque que es el lead vino del webinar... tengo que agregar en el detalle del lead que se pueda diferenciar si vino
// del webinar o vino de un anuncio». El anuncio ya lo dice el bloque «Origen»; lo que faltaba es que está (o estuvo) en
// el CRM del Sprint: al lado del funnel que se mira, «También en: Sprint 3 días › Prospección activa», de un toque.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 2 / 0, una rotura por vez y restaurada:
//   · `otrosFunnelsDelLead` sin sacar el que se mira                                → 1 / 1
//   · la ficha sin el «También en»                                                   → 1 / 1
// Correr: node --import tsx --test tests/crm-ficha-de-donde-vino.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { funnelEnVista, funnelsDelArbol, otrosFunnelsDelLead } from '../app/crm/lead-view/arbol-funnels';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const ETAPAS_PRINCIPAL = [{ key: 'agenda', label: 'R1', band: 'pipeline' }, { key: 'reactivacion', label: 'Reactivación', band: 'nutricion' }];
const ETAPAS_SPRINT = [{ key: 'st0', label: 'Lead entrante', band: 'pipeline' }, { key: 'st1', label: 'Prospección activa', band: 'pipeline' }];

test('los otros funnels donde está el lead, con su etapa: no el que se mira, ni donde no está', () => {
  // Un lead del ws1: su casa es el CRM principal (en la R1) y está agregado al Sprint (en Prospección activa).
  const funnels = funnelsDelArbol({
    foto: [{ id: 1, nombre: 'Negocio que ESCALA', esDefault: true }, { id: 44, nombre: 'Sprint 3 días', esDefault: false }, { id: 29, nombre: 'Renovación', esDefault: false }],
    productos: [
      { id: 1, nombre: 'Negocio que ESCALA', esta: true, esCasa: true, etapa: 'agenda', etapas: ETAPAS_PRINCIPAL },
      { id: 44, nombre: 'Sprint 3 días', esta: true, esCasa: false, etapa: 'st1', etapas: ETAPAS_SPRINT },
      { id: 29, nombre: 'Renovación', esta: false, esCasa: false, etapa: null, etapas: [] },
    ],
    casaId: 1, etapasCasa: ETAPAS_PRINCIPAL, etapaCasa: 'agenda',
  });
  const enPrincipal = funnelEnVista(funnels, 1);
  assert.deepEqual(otrosFunnelsDelLead(funnels, enPrincipal), [{ id: 44, nombre: 'Sprint 3 días', etapa: 'Prospección activa' }]);
  // Mirando el Sprint, el otro es el principal (con la etapa de la pantalla).
  assert.deepEqual(otrosFunnelsDelLead(funnels, funnelEnVista(funnels, 44)), [{ id: 1, nombre: 'Negocio que ESCALA', etapa: 'R1' }]);
  // Un lead que está en un solo CRM: nada que decir.
  assert.deepEqual(otrosFunnelsDelLead(funnels.filter((f) => f.id === 1), enPrincipal), []);
  // Una fila que apunta a una etapa que ya no existe: el nombre del CRM igual, sin etapa.
  assert.deepEqual(otrosFunnelsDelLead([...funnels.filter((f) => f.id === 1), { id: 44, nombre: 'Sprint 3 días', esta: true, esCasa: false, etapa: 'borrada', etapas: ETAPAS_SPRINT }], enPrincipal),
    [{ id: 44, nombre: 'Sprint 3 días', etapa: null }]);
});

test('la ficha lo dice al lado del funnel que se mira, y un toque cambia a ése', () => {
  const p = leer('app/crm/lead-view/ProductoDelLead.tsx');
  assert.match(p, /const otros = otrosFunnelsDelLead\(funnels, enVista\);/);
  assert.match(p, /\{!ficha\.esperando && otros\.length > 0 && \(/);
  assert.match(p, /También en/);
  assert.match(p, /onClick=\{\(\) => ficha\.verProducto\(o\.id\)\}/);
  // Es el componente de las DOS fichas (el pop-up y la ruta /crm/[id]).
  assert.match(leer('app/crm/LeadSheet.tsx'), /<FunnelYEtapa /);
  assert.match(leer('app/crm/[id]/LeadDetailBody.tsx'), /<FunnelYEtapa /);
});
