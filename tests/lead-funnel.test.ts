// =============================================================================
// Un lead en VARIOS productos del CRM: el núcleo (mig 0207)
// =============================================================================
// Pedido de Martín (06/10/2026), textual: «Le acabo de dar a un lead a "Mover a prueba" y se
// desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar... No se debe "Mover"
// se debe agregar al otro producto».
//
// Las reglas puras (lib/lead-funnel-reglas.ts) se EJECUTAN. Lo que no se puede ejecutar sin
// base —que agregar o mover en otro producto no toque la casa, que la tabla esté acotada por
// cliente— se mira sobre el código sin comentarios.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { casaParaEscribir, casaReal, productosDe, puedeQuitar, aQuienPromover, etapaDeEntrada } from '../lib/lead-funnel-reglas';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const DEF = 1;   // el id del producto del negocio

// ── Las reglas ────────────────────────────────────────────────────────────────

test('⚠️ el producto del negocio se escribe NULL en leads.funnel_id (si no, el lead no aparece en ningún tablero)', () => {
  assert.equal(casaParaEscribir(DEF, DEF), null, 'el id del default es NULL');
  assert.equal(casaParaEscribir(14, DEF), 14);
  assert.equal(casaParaEscribir(null, DEF), null);
  assert.equal(casaReal(null, DEF), DEF, 'y al leer, NULL es el del negocio');
  assert.equal(casaReal(14, DEF), 14);
});

test('los productos de un lead: la casa primero y después las filas por antigüedad', () => {
  const ps = productosDe(null, [
    { funnel_id: 20, etapa: 'lead', created_at: '2026-10-06T12:00:00Z', id: 2 },
    { funnel_id: 14, etapa: 'agenda', created_at: '2026-10-05T12:00:00Z', id: 1 },
  ], DEF);
  assert.deepEqual(ps.map((p) => [p.funnelId, p.esCasa, p.etapa]), [[DEF, true, null], [14, false, 'agenda'], [20, false, 'lead']]);
});

test('una fila que nombra a la casa se ignora (nunca hay fila para la casa)', () => {
  const ps = productosDe(14, [{ funnel_id: 14, etapa: 'lead' }, { funnel_id: DEF, etapa: 'lead' }], DEF);
  assert.deepEqual(ps.map((p) => p.funnelId), [14, DEF]);
  assert.equal(ps[0].esCasa, true);
});

test('la X sólo con dos productos o más', () => {
  assert.equal(puedeQuitar(productosDe(null, [], DEF)), false, 'con uno solo no se puede dejar sin tablero');
  assert.equal(puedeQuitar(productosDe(null, [{ funnel_id: 14, etapa: 'lead' }], DEF)), true);
});

test('quitar la casa promueve la fila MÁS VIEJA', () => {
  const ps = productosDe(null, [
    { funnel_id: 20, etapa: 'lead', created_at: '2026-10-06T12:00:00Z' },
    { funnel_id: 14, etapa: 'agenda', created_at: '2026-10-01T12:00:00Z' },
  ], DEF);
  assert.equal(aQuienPromover(ps)?.funnelId, 14);
  assert.equal(aQuienPromover(productosDe(null, [], DEF)), null);
});

test('se entra a un producto por la etapa declarada de entrada, o la primera', () => {
  assert.equal(etapaDeEntrada([{ key: 'a' }, { key: 'b', kind: 'entrada' }]), 'b');
  assert.equal(etapaDeEntrada([{ key: 'a' }, { key: 'b' }]), 'a');
  assert.equal(etapaDeEntrada([]), null);
});

// ── Lo que agregar y mover NO tocan (decisión v1) ─────────────────────────────

const LIB = sinComentarios(leer('lib/lead-funnel.ts'));

/** El cuerpo de UNA función de LIB, hasta la siguiente declaración de nivel superior. */
const cuerpoDe = (firma: string): string => {
  const i = LIB.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = LIB.slice(i + firma.length).search(/\n(export )?(async )?function |\nexport (const|type) |\nconst |\ntype /);
  return LIB.slice(i, fin < 0 ? undefined : i + firma.length + fin);
};

test('⚠️ agregar y mover en otro producto no tocan la casa: ni setPipelineStage, ni updateLead, ni nutrición', () => {
  // ⚠️ POR FUNCIÓN, no sobre el archivo entero (08/10/2026). Desde que QUITAR LA CASA sincroniza el
  // desenlace con la etapa promovida (ver el test siguiente), el archivo llama a updateLead a
  // propósito; lo que esta decisión v1 protege es que AGREGAR y MOVER en otro producto no toquen
  // la casa.
  for (const f of ['export async function agregarAProducto(', 'export async function moverEtapaEnProducto(', 'export async function agregarLoteAProducto(', 'export async function quitarLoteDeProducto(']) {
    assert.doesNotMatch(cuerpoDe(f), /setPipelineStage|updateLead|setBoardStageOverride/, `${f}: tocaría estado_lead, la venta o el CAPI de la casa`);
  }
  assert.doesNotMatch(LIB, /setPipelineStage|setBoardStageOverride/, 'ninguna mueve la columna de la casa por el camino del recorrido');
  assert.doesNotMatch(LIB, /enrolarPorEvento|inscrib/, 'las secuencias aplican a todos los productos: le escribiría dos veces a la misma persona');
});

test('quitar la casa: updateLead SÓLO para que el desenlace siga a la etapa promovida (y su deshacer)', () => {
  // Medido el 08/10/2026 en ws11: sacar la casa promovía una fila en «Ganado» escribiendo sólo la
  // columna, y el #2605 quedó en la tarjeta de Ganado con el lead abierto (fuera del revenue).
  const quitar = cuerpoDe('export async function quitarDeProducto(');
  assert.equal((quitar.match(/updateLead\(/g) ?? []).length, 1);
  assert.match(quitar, /if \(desenlace !== 'abierto'\) \{[\s\S]*?await updateLead\(leadId, \{ estado_lead: desenlace \}\);/);
  const deshacer = cuerpoDe('export async function deshacerQuitar(');
  assert.equal((deshacer.match(/updateLead\(/g) ?? []).length, 1);
});

test('quitar vuelve a contar en el server (esconder la X no protege nada)', () => {
  const quitar = LIB.slice(LIB.indexOf('export async function quitarDeProducto'), LIB.indexOf('export async function deshacerQuitar'));
  assert.match(quitar, /if \(!puedeQuitar\(productos\)\) throw new Error\('Es su único funnel\.'\);/);
  assert.match(quitar, /funnel_id: casaParaEscribir\(nueva\.funnelId, defaultId\)/, 'la casa promovida se escribe con la traducción del default');
});

// ── El tablero y el aislamiento ───────────────────────────────────────────────

test('el tablero de un producto trae también a sus AGREGADOS, con la etapa de la fila', () => {
  const leads = sinComentarios(leer('lib/leads.ts'));
  assert.match(leads, /const agregados = await agregadosDelTablero\(supabase, funnelId, new Set\(filas\.map\(\(l\) => l\.id\)\)\);/);
  // Y se DEVUELVEN: leerlos sin sumarlos es un tablero que no los dibuja, en verde.
  assert.match(leads, /return \[\.\.\.filas, \.\.\.agregados\]\.sort\(/);
  assert.match(leads, /pipeline_stage: etapa\.get\(l\.id\) \?\? l\.pipeline_stage, de_fila: id/);
});

test('lead_funnel está acotada por cliente y en el reset', () => {
  assert.match(leer('lib/workspace.ts'), /'lead_funnel',/, 'sin esto getTenantDb es passthrough');
  assert.match(leer('lib/tablas-de-inquilino.ts'), /'lead_funnel'/);
  const mig = leer('supabase/migrations/0207_lead_funnel.sql').replace(/^--.*$/gm, '');
  assert.match(mig, /create unique index if not exists lead_funnel_uk on lead_funnel \(workspace_id, lead_id, funnel_id\);/);
  assert.match(mig, /alter table lead_funnel enable row level security;/);
  assert.match(mig, /revoke all on lead_funnel from anon, authenticated;/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026), una rotura a la vez, restaurando desde memoria:
//   - casaParaEscribir devolviendo el id crudo: 9 pass / 1 fail.
//   - aQuienPromover eligiendo la fila más NUEVA: 9 / 1.
//   - sacar el «Es su único producto» del server: 9 / 1.
//   - listLeadsDeFunnel leyendo los agregados y sin devolverlos: dio 10 / 0 con la primera versión
//     del guard (miraba que se leyeran, no que se devolvieran); de ahí el assert del `return`.
