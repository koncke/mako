// =============================================================================
// En qué otros CRMs está el lead: en el DESPLEGABLE del funnel, no en un «También en» debajo del nombre
// =============================================================================
// 22/10/2026 (C8 de la llamada con Mauricio, min 22:29-24:01): el Sprint termina en una R1 que vive en el CRM principal, y
// Martín pidió que la ficha diga que el lead vino del webinar. Se resolvió con «También en: Sprint 3 días › Prospección
// activa» al lado del funnel que se mira.
// 24/10/2026: Martín, con la captura de un lead de Mauricio: «Elimina "También en Negocio que ESCALA"». Lo que decía NO se
// pierde: el desplegable del funnel (arriba a la derecha de la ficha) lista cada funnel donde está el lead con su etapa, y
// los otros como «No está». Esto prueba eso, y que el «También en» no vuelva.
// Correr: node --import tsx --test tests/crm-ficha-de-donde-vino.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { funnelEnVista, funnelsDelArbol, seccionesDelArbol } from '../app/crm/lead-view/arbol-funnels';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const ETAPAS_PRINCIPAL = [{ key: 'agenda', label: 'R1', band: 'pipeline' }, { key: 'reactivacion', label: 'Reactivación', band: 'nutricion' }];
const ETAPAS_SPRINT = [{ key: 'st0', label: 'Lead entrante', band: 'pipeline' }, { key: 'st1', label: 'Prospección activa', band: 'pipeline' }];

test('el desplegable del funnel dice en qué CRMs está el lead y en qué etapa de cada uno', () => {
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
  const secciones = seccionesDelArbol(funnels, true);
  const resumen = secciones.map((s) => [s.title, s.resumen, s.activo]);
  assert.deepEqual(resumen, [
    ['Negocio que ESCALA', 'R1', true],
    ['Sprint 3 días', 'Prospección activa', true], // lo que decía «También en: Sprint 3 días › Prospección activa»
    ['Renovación', 'No está', false],
  ]);
  // Y el botón nombra el que se mira (la casa, si no se eligió otro).
  assert.equal(funnelEnVista(funnels, null)?.nombre, 'Negocio que ESCALA');
  assert.equal(funnelEnVista(funnels, 44)?.nombre, 'Sprint 3 días');
});

test('el «También en» no vuelve debajo del nombre (Martín, 24/10/2026)', () => {
  const p = sinComentarios(leer('app/crm/lead-view/ProductoDelLead.tsx'));
  assert.doesNotMatch(p, /También en/, 'volvió el «También en»');
  assert.doesNotMatch(p, /otrosFunnelsDelLead/);
  assert.doesNotMatch(sinComentarios(leer('app/crm/lead-view/arbol-funnels.ts')), /export function otrosFunnelsDelLead/, 'la función quedó sin uso');
  // El desplegable sigue en las DOS fichas (el pop-up y la ruta /crm/[id]).
  assert.match(leer('app/crm/LeadSheet.tsx'), /<FunnelYEtapa /);
  assert.match(leer('app/crm/[id]/LeadDetailBody.tsx'), /<FunnelYEtapa /);
});
