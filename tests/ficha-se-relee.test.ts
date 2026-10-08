// =============================================================================
// La ficha del tablero se relee después de escribir, y «Completar datos» no mueve al lead
// =============================================================================
// Feedback de Leila (clienta, ws11), 08/10/2026: «3 veces lo moví a conversación abierta y hace
// loop, además lo moví al embudo de empresa y le cargué el nombre de la empresa», y en un audio:
// «Le pongo siguiente, me pasa, revisa y confirma. Setter, Closer, empresa. Guardar. Ya estoy
// guardando. Y me dice sin empresa… si cierro la conversación… ahora sí me dejó». Martín: «Leila
// me mandó feedback del CRM, soluciona eso también».
//
// Lo medido en su historial: la ficha del tablero es una FOTO (getLeadFullAction al abrir) y el
// router.refresh() de cada tarjeta no la toca. Con la foto vieja, «Solucionar» abría «Completar
// datos» con la etapa de ANTES, y su Guardar llamaba a setPipelineStage con esa etapa: el #2608
// volvió tres veces de «Conversación abierta» a «Contacto nuevo» y el #2605 perdió el Ganado.
//
// Correr: npx tsx --test tests/ficha-se-relee.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026), una por vez y restaurando de memoria. Con todo puesto:
// 5 / 0. Cada rotura, 4 / 1: una tarjeta vuelve a router.refresh() suelto · el aviso no relee
// la ficha · «Completar datos» no relee · la ficha no provee el aviso · el wizard no avisa que
// es completar · completar vuelve a mover · lo pendiente se mide en la etapa del navegador · el
// estado no sigue a la casa · el deshacer no devuelve el estado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** El cuerpo de UNA función, hasta la siguiente declaración de nivel superior. */
const cuerpoDe = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.slice(i + firma.length).search(/\n(export )?(async )?function |\nexport (const|type) /);
  return src.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};

test('las tarjetas de la ficha que guardan AVISAN: ninguna llama a router.refresh() suelto', () => {
  // ficha-cambio.tsx es el aviso mismo (el que SÍ llama al router). ProductoDelLead se excluye a propósito: su hook corre en la propia ficha (arriba del proveedor)
  // y ya relee cuando cambia la casa (`onCasaCambiada`), que es lo único de la foto que toca.
  const EXENTOS = new Set(['ProductoDelLead.tsx', 'ficha-cambio.tsx']);
  const dir = 'app/crm/lead-view';
  const culpables: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') && !EXENTOS.has(x))) {
    if (/router\.refresh\(\)/.test(sinComentarios(leer(`${dir}/${f}`)))) culpables.push(f);
  }
  assert.deepEqual(culpables, [], `tarjetas con router.refresh() suelto: ${culpables.join(', ')}`);
  // Y las que guardan usan el aviso (la lista medida el 08/10/2026).
  for (const f of ['AgendarR2', 'AuditHistory', 'CampoEditable', 'GeneratedInsightCard', 'InfoPrincipalCard', 'NotasCard']) {
    assert.match(sinComentarios(leer(`${dir}/${f}.tsx`)), /useRefrescarFicha\(\)/, f);
  }
  const deal = sinComentarios(leer('app/crm/[id]/DealDetailsCard.tsx'));
  assert.doesNotMatch(deal, /router\.refresh\(\)/);
  assert.match(deal, /useRefrescarFicha\(\)/);
});

test('el aviso refresca el tablero Y relee la ficha', () => {
  const src = sinComentarios(leer('app/crm/lead-view/ficha-cambio.tsx'));
  assert.match(src, /router\.refresh\(\);\s*avisar\?\.\(\);/);
});

test('la ficha provee el aviso con su releer, y relee al mover y al completar', () => {
  const src = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  assert.match(src, /const releer = useCallback\(\(\) => \{\s*void getLeadFullAction\(lead\.id\)\.then\(\(x\) => \{ if \(x\) setFresca\(x\); \}\)/);
  assert.match(src, /<FichaCambioProvider value=\{releer\}>/);
  assert.match(src, /onDone=\{\(\) => \{ const quedarse = completandoDatos; setMoveTo\(null\); router\.refresh\(\); if \(quedarse\) releer\(\); else onClose\(\); \}\}/);
  // Mover desde el desplegable: la etapa nueva se pinta ya y se confirma releyendo.
  assert.match(src, /onHecho=\{\(\) => \{ const k = moverDirecto;[\s\S]{0,160}?setFresca\(\{ \.\.\.vigente, lead: \{ \.\.\.vigente\.lead, pipeline_stage: k \} \}\); releer\(\); \}\}/);
  assert.match(src, /onCompletar=\{\(\) => \{ const k = moverDirecto;[\s\S]{0,200}?releer\(\); setMoveTo\(k\); \}\}/);
});

test('«Completar datos» guarda y NO mueve la etapa, venga de la pantalla que venga', () => {
  const dlg = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(dlg, /completeStageMoveAction\(lead\.id, to, \{\s*\.\.\.\(completarDatos \? \{ soloCompletar: true \} : \{\}\),/);
  const accion = sinComentarios(cuerpoDe(leer('app/crm/actions.ts'), 'export async function completeStageMoveAction('));
  // El único setPipelineStage está en la rama que NO es completar.
  assert.equal((accion.match(/setPipelineStage\(/g) ?? []).length, 1);
  assert.match(accion, /if \(d\.soloCompletar && before\) \{[\s\S]*?\} else \{\s*await setPipelineStage\(id, to, /);
  // Completando, lo único que se sincroniza es el monto de un Ganado.
  assert.match(accion, /if \(before\.estado_lead === 'ganado' && d\.monto != null && d\.monto !== before\.monto_cierre_usd\) \{\s*await updateLead\(id, \{ monto_cierre_usd: d\.monto \}\);/);
  // Y lo pendiente se mide en la etapa donde QUEDÓ, no en la que mandó el navegador.
  assert.match(accion, /const etapaFinal = d\.soloCompletar && after \? etapaReal\(after\) : to;/);
});

test('quitar la casa: si la etapa promovida es un desenlace, el estado la sigue; el deshacer lo devuelve', () => {
  const src = leer('lib/lead-funnel.ts');
  const quitar = sinComentarios(cuerpoDe(src, 'export async function quitarDeProducto('));
  assert.match(quitar, /const desenlace = nueva\.etapa \? terminalEstadoFor\(nueva\.etapa\) : 'abierto';\s*if \(desenlace !== 'abierto'\) \{/);
  assert.match(quitar, /await updateLead\(leadId, \{ estado_lead: desenlace \}\);/);
  assert.match(quitar, /\.\.\.\(estadoAntes \? \{ estado_lead: estadoAntes \} : \{\}\)/);
  const deshacer = sinComentarios(cuerpoDe(src, 'export async function deshacerQuitar('));
  assert.match(deshacer, /if \(esEstado\(d\.casaAntes\.estado_lead\)\) await updateLead\(d\.leadId, \{ estado_lead: d\.casaAntes\.estado_lead \}\);/);
});
