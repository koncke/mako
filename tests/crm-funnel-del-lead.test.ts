// =============================================================================
// El funnel DE UN LEAD es el de su casa, no el del negocio (17/10/2026)
// =============================================================================
// Hasta el 17/10/2026 `getFunnelDeLead` (lib/funnels.ts) devolvía el funnel del NEGOCIO para todos
// los leads. Con N CRM por negocio (mig 0170), un lead que vive en otro CRM se evaluaba contra las
// etapas del principal: MaKo (`ficha_lead`, `buscar_leads`) le daba una etapa derivada que
// contradecía al tablero, y la ficha pedía los requisitos de etapas que no eran las suyas
// (docs/relevo/crm-tanda-b1.md → «Revisión de b4 · captura»). Los 33 llamadores ya pasaban por esa
// función: el arreglo es su cuerpo, y esto fija el cuerpo.
//
// Son guardas sobre el fuente porque la función lee Supabase (`getTenantDb`) y el repo no tiene un
// doble de la base para lib/funnels.ts.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = s.indexOf(hasta, i + desde.length);
  return s.slice(i, j < 0 ? undefined : j);
};

// Verificado rompiéndolo (el archivo da 4 / 0; los números de abajo, con los cuatro tests):
// · el cuerpo de antes (`return getFunnelDefault();` antes del `try`) → 3 / 1 (éste);
// · `lead.funnel_id ?? null` en vez de leer la casa cuando no viene → 3 / 1 (éste);
// · `if (fila) return filaAFunnel(fila);` borrado (una casa que no existe pintaría DEFAULT_PIPELINE) → 3 / 1 (éste).
test('getFunnelDeLead usa la CASA del lead, la lee si no viene, y cae al del negocio sólo si no la encuentra', () => {
  const f = leer('lib/funnels.ts');
  assert.match(f, /export type LeadConFunnel = \{ id: number; funnel_id\?: number \| null \};/);
  const cuerpo = entre(f, 'export async function getFunnelDeLead(', '\nasync function casaLeida(');
  assert.match(cuerpo, /lead\.funnel_id !== undefined \? lead\.funnel_id : await casaLeida\(lead\.id\)/,
    'sin la casa en el objeto hay que LEERLA: suponer «la del negocio» es el bug de antes');
  assert.match(cuerpo, /if \(casa == null\) return getFunnelDefault\(\);/, 'NULL = el CRM del negocio');
  // Dos y sólo dos: la casa NULL y el respaldo del final. Un tercero (un return temprano) es el bug de antes.
  assert.equal((cuerpo.match(/getFunnelDefault\(\)/g) ?? []).length, 2, 'apareció otro camino al CRM del negocio');
  assert.match(cuerpo, /const fila = await filaDe\(Number\(casa\)\);\s*if \(fila\) return filaAFunnel\(fila\);/,
    'una casa que existe se devuelve con SUS etapas');
  // Una casa que no existe (o de otro negocio): `getFunnelDe` devolvería DEFAULT_PIPELINE con
  // origen 'sin-fila', que no es el del negocio. Por eso pasa por `filaDe` y no por `getFunnelDe`.
  assert.doesNotMatch(cuerpo, /getFunnelDe\(/);
});

// Verificado rompiéndolo: con `resumenLead(l, null)` (las etapas se leen y no se usan) → 3 / 1 (éste).
test('MaKo: buscar_leads le da a cada lead las etapas de SU casa, y ficha_lead las del lead', () => {
  const t = leer('lib/mako-tools.ts');
  const buscar = entre(t, "case 'buscar_leads':", "case 'ficha_lead':");
  assert.match(buscar, /await etapasDeLeads\(encontrados\.map\(\(l\) => l\.id\)\)/);
  assert.match(buscar, /resumenLead\(l, etapas\?\.get\(l\.id\) \?\? null\)/, 'las etapas se leen y no se usan');
  assert.doesNotMatch(buscar, /getPipelineStagesDefault|getFunnelDefault/, 'las etapas del negocio para todos, otra vez');
  const ficha = entre(t, "case 'ficha_lead':", "case 'historial_whatsapp':");
  assert.match(ficha, /getPipelineStagesDeLead\(lead\)/);
});

// Verificado rompiéndolo: `etapasDeLeads` leyendo un embudo por LEAD (sin el mapa `porCasa`) → 3 / 1 (éste).
test('etapasDeLeads lee cada CRM una sola vez y pasa por la misma regla que getFunnelDeLead', () => {
  const f = leer('lib/funnels.ts');
  const cuerpo = entre(f, 'export async function etapasDeLeads(', '\n}\n');
  assert.match(cuerpo, /\.from\('leads'\)\.select\('id, funnel_id'\)\.in\('id', \[\.\.\.ids\]\)/);
  assert.match(cuerpo, /if \(!porCasa\.has\(k\)\) porCasa\.set\(k, getFunnelDeLead\(\{ id: 0, funnel_id: casa \}\)/);
});

// Guardar un funnel no pisa lo que otro guardó en el medio (docs/relevo/crm.md §0-Ω7, 17/10/2026).
// Verificado rompiéndolo (el archivo da 4 / 0): sin el `.eq('updated_at', fila.updated_at)` → 3 / 1 (éste);
// con la lectura caída mergeando sobre `{}` (sin el `throw` de `eLee`) → 3 / 1 (éste).
test('saveFunnelDe: compare-and-set sobre updated_at, relee si otro guardó, y una lectura caída no borra el data', () => {
  const f = leer('lib/funnels.ts');
  const cuerpo = entre(f, 'export async function saveFunnelDe(', '\nexport async function saveFunnelDefault(');
  assert.match(cuerpo, /for \(let intento = 0; intento < 4; intento\+\+\) \{/);
  assert.match(cuerpo, /\.select\('data, updated_at'\)\.eq\('id', funnelId\)\.limit\(1\);\s*if \(eLee\) throw new Error/);
  assert.match(cuerpo, /if \(fila\.updated_at\) q = q\.eq\('updated_at', fila\.updated_at\);/);
  assert.match(cuerpo, /mergeFunnelData\(fila\.data \?\? \{\}, pipeline, suppressed, extra\)/);
  assert.match(cuerpo, /if \(\(\(tocadas \?\? \[\]\) as unknown\[\]\)\.length\) return;/);
});
