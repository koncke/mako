// =============================================================================
// «Asignar fuentes» SIEMPRE en la primera etapa y en el «⋯» de arriba (20/11/2026)
// =============================================================================
// Martín, 20/11/2026: «Quiero que siempre la primera etapa de lead entrante tenga la opción de "Asignar fuentes", la que
// tiene el logo de Meta... Y que en los 3 puntos de arriba a la derecha también esté esa opción». Del 18/11 al 20/11 se
// escondía en los funnels de Prospección (`ofreceAsignarFuentes`); el «siempre» lo deja en todos. Este archivo era el test de
// esa excepción y pasa a ser el de la regla nueva (mismo lugar, para que quien busque «Prospección» encuentre por qué se fue).
//
// El menú (`opcionesCrm`) es puro y se EJECUTA; el cableado (la primera columna aunque ninguna esté marcada como entrada, el
// renglón del «⋯» de arriba, el modal nuevo y la calificación en las tres puertas) se mira en el fuente.
//
// Correr: node --import tsx --test tests/crm-fuentes-prospeccion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemsCrm, opcionesCrm, type ContextoCrm } from '../app/crm/menu-contextual-crm';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la primera etapa ofrece «Asignar fuentes» siempre, y ninguna otra', () => {
  const col = (o: Partial<Extract<ContextoCrm, { sobre: 'columna' }>> = {}): ContextoCrm =>
    ({ sobre: 'columna', mover: false, entrada: true, curso: null, borrable: false, ...o });
  assert.ok(opcionesCrm(col()).includes('col_campanas'), 'en la primera etapa, siempre (también en un funnel de Prospección)');
  assert.ok(!opcionesCrm(col({ entrada: false })).includes('col_campanas'), 'fuera de la primera etapa, nunca');
});

test('el fondo y el «⋯» de arriba: «Asignar fuentes» con lo que trae leads, con el logo de Meta', () => {
  const ids = opcionesCrm({ sobre: 'fondo', seleccionados: 0 });
  assert.equal(ids[ids.indexOf('importar') + 1], 'asignar_fuentes');
  const logo = { type: 'svg', props: {}, key: null } as unknown as import('react').ReactElement;
  const it = itemsCrm(['asignar_fuentes'], { etapas: [], equipo: [], etiquetas: null, funnels: [], logoMeta: logo })[0];
  assert.ok(it && it.label === 'Asignar fuentes' && it.icono === logo, 'el renglón dice «Asignar fuentes» y lleva el logo de Meta');
  const barra = leer('app/crm/CrmToolbar.tsx');
  const acc = barra.slice(barra.indexOf('export function AccionesHeader'), barra.indexOf('export function VistaSelector'));
  assert.match(acc, /<MenuItem icon=\{<LogoMeta size=\{15\} \/>\} label="Asignar fuentes"/);
});

test('el cableado del tablero: la primera columna, los dos «⋯» y el modal nuevo', () => {
  const tablero = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(tablero, /entrada: esPrimeraEtapa\(c\),/, 'la columna usa «es la primera etapa», no sólo el tipo entrada');
  assert.match(tablero, /const esPrimeraEtapa = \(c: Stage\) => c\.kind === 'entrada'\s*\|\| \(!columnasKanban\.some\(\(s\) => s\.kind === 'entrada'\)/);
  assert.match(tablero, /case 'col_campanas':\s*case 'asignar_fuentes': setCampanasAbierto\(true\); return;/);
  assert.match(tablero, /onAsignarFuentes=\{\(\) => setCampanasAbierto\(true\)\}/);
  assert.match(tablero, /\{campanasAbierto && \(\s*<FuentesModal\b/);
  assert.doesNotMatch(tablero, /ofreceAsignarFuentes|entradasFunnel/, 'volvió la excepción de Prospección');
  assert.doesNotMatch(sinComentarios(leer('app/crm/page.tsx')), /pEntradas|entradasFunnel/);
});

test('la calificación se aplica en las tres puertas, ANTES de las automatizaciones', () => {
  const optin = sinComentarios(leer('app/api/track/optin/route.ts'));
  // Los dos caminos (el lead que ya existía y el nuevo), cada uno antes de su `trasElEnvio`.
  assert.equal((optin.match(/await calificarEnvio\(ws, (leadId|lead\.id), envio, paginaOptin, respuestasOptin\);\s*await trasElEnvio\(/g) ?? []).length, 2);
  const meta = sinComentarios(leer('lib/meta-lead-nuevo.ts'));
  const iCal = meta.indexOf('await calificarLeadDeMeta(lead.id, form.formId, form.fieldData);');
  assert.ok(iCal > 0 && iCal < meta.indexOf("enrolarPorEvento(lead.id, 'lead_nuevo')"), 'el lead de Meta se califica antes de entrar a las automatizaciones');
  // El formulario viaja desde el webhook, el poll y Zernio.
  assert.match(sinComentarios(leer('app/api/webhooks/meta-leads/route.ts')), /meta_form_id: formId,/);
  assert.match(sinComentarios(leer('lib/meta-leads.ts')), /meta_form_id: form\.id,/);
  assert.match(sinComentarios(leer('lib/zernio-leads.ts')), /meta_form_id: l\.formularioId,/);
  // Y en el alta de Meta el formulario asignado gana a la campaña.
  assert.match(sinComentarios(leer('lib/leads.ts')), /const porCampana = porFormulario\.asignada\s*\? porFormulario\s*: await funnelDeCampana\(/);
});
