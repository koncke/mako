// =============================================================================
// Editar las etapas de un CRM por la API de MaKo (23/10/2026, P0-6 de la auditoría de la API)
// =============================================================================
// Pedido de Martín (23/10/2026): «Y si hay que hacer una revisión completa de la API, porque creo que faltan muchas
// acciones posibles». La API sólo sabía cambiar el TIPO de una etapa y crear un CRM entero: renombrar, agregar, quitar,
// ordenar, ponerle plazo y quitar o devolver una columna de nutrición eran sólo de la pantalla.
//
// Lo que este test fija:
//   · el cuerpo de editarEtapaAction vive en lib (`editarEtapa`), y la action y los seis runners pasan por ahí: dos
//     copias de cómo se guarda una etapa serían dos reglas sobre qué se puede borrar;
//   · lo que no se borra lo decide UNA función pura (`porQueNoSeElimina`), que la API pregunta antes del «sí»;
//   · antes de quitar una etapa, la API cuenta sus leads con el conteo del pop-up (`conteosDelEmbudo`);
//   · las seis: por chat, sólo el admin, con su ruta REST.
//
// PROBADO ROMPIÉNDOLO: ver el bloque al final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { porQueNoSeElimina, pipelineReordenado } from '../lib/etapas-crm-reglas';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { resolverRest } from '../lib/api-mako/rest';
import type { Stage } from '../lib/pipeline';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de un runner: desde `  <id>: {` hasta el próximo runner de dos espacios. */
const runner = (src: string, id: string) => {
  const i = src.indexOf(`\n  ${id}: {`);
  assert.ok(i >= 0, `no encontré el runner ${id}`);
  const fin = src.slice(i + 1).search(/\n {2}[a-z_]+: \{/);
  return src.slice(i, fin < 0 ? undefined : i + 1 + fin);
};

const OPS = {
  renombrar_etapa: 'renombrar', agregar_etapa: 'agregar', eliminar_etapa: 'eliminar',
  ordenar_etapas: 'reordenar', plazo_etapa: 'plazo',
} as const;
const etapa = (key: string, kind = 'paso'): Stage => ({ key, label: key, kind } as unknown as Stage);

test('porQueNoSeElimina: las terminales, lo que no es del pipeline, la última y la de entrada no se borran', () => {
  const pl = [etapa('lead', 'entrada'), etapa('st1'), etapa('agendado'), etapa('ganado', 'cierre')];
  assert.match(porQueNoSeElimina(pl, 'perdido') ?? '', /todos los funnels/, 'se borró una terminal');
  assert.match(porQueNoSeElimina(pl, 'ganado') ?? '', /todos los funnels/);
  assert.match(porQueNoSeElimina(pl, 'inventada') ?? '', /no es del pipeline/);
  assert.match(porQueNoSeElimina([etapa('st1')], 'st1') ?? '', /sin etapas/);
  assert.match(porQueNoSeElimina(pl, 'lead') ?? '', /entra tu gente/, 'se borró la etapa de entrada');
  assert.equal(porQueNoSeElimina(pl, 'st1'), null);
});

test('pipelineReordenado: el orden pedido, lo no nombrado al final, y la entrada siempre primera', () => {
  const pl = [etapa('lead', 'entrada'), etapa('a'), etapa('b'), etapa('c'), etapa('ganado', 'cierre')];
  const keys = (x: Stage[]) => x.map((st) => st.key);
  assert.deepEqual(keys(pipelineReordenado(pl, ['c', 'a'])), ['lead', 'c', 'a', 'b', 'ganado'], 'lo no nombrado no quedó al final');
  assert.deepEqual(keys(pipelineReordenado(pl, ['b', 'lead', 'a'])), ['lead', 'b', 'a', 'c', 'ganado'], 'la entrada dejó de ir primera');
  assert.deepEqual(keys(pipelineReordenado(pl, ['x', 'c', 'c'])), ['lead', 'c', 'a', 'b', 'ganado'], 'una clave inventada o repetida entró');
  assert.equal(pipelineReordenado(pl, []).length, pl.length, 'un arrastre perdió una etapa');
});

test('el cuerpo vive en lib: la action deja la puerta y los cachés, y la op pasa por las reglas puras', () => {
  const ac = sinComentarios(leer('app/crm/actions.ts'));
  const accion = ac.slice(ac.indexOf('export async function editarEtapaAction('), ac.indexOf('export async function declararEntradasAction('));
  assert.ok(accion.length > 100 && accion.length < 1500, `el recorte mide ${accion.length}: está mirando otra cosa`);
  assert.match(accion, /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false/);
  assert.match(accion, /const r = await editarEtapa\(op, funnelId \?\? null\);/);
  assert.doesNotMatch(accion, /saveFunnelDe\(|saveFunnelDefault\(/, 'la action volvió a guardar por su cuenta');
  const srv = sinComentarios(leer('lib/etapas-crm-server.ts'));
  assert.match(srv, /const no = porQueNoSeElimina\(pipeline, op\.key\);\s*if \(no\) return \{ ok: false, error: no \};/);
  assert.match(srv, /pipeline = pipelineReordenado\(pipeline, op\.keys\);/);
  assert.doesNotMatch(srv, /revalidatePath\(|bust\(/, 'la lib limpia cachés: corre también desde la API y un cron');
  assert.match(sinComentarios(leer('lib/etapas-crm-reglas.ts')), /^(?![\s\S]*server-only)/, 'las reglas puras no pueden llevar server-only');
});

test('los seis runners: cada uno por editarEtapa, y ninguno guarda el funnel por su cuenta', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  for (const [id, op] of Object.entries(OPS)) {
    const r = runner(run, id);
    assert.match(r, new RegExp(`await editarEtapa\\(\\{ op: '${op}'`), `${id} no pasa por editarEtapa`);
    assert.doesNotMatch(r, /saveFunnelDe\(|saveFunnelDefault\(/, `${id} guarda el funnel por su cuenta`);
  }
  const nutri = runner(run, 'columna_nutricion_crm');
  assert.match(nutri, /await editarEtapa\(\{ op: activa \? 'ponerNutricion' : 'quitarNutricion', key \}/);
  assert.doesNotMatch(nutri, /saveFunnelDe\(|saveFunnelDefault\(/);
  // Quitar: lo que no se borra se pregunta ANTES del «sí», y los leads se cuentan con el conteo del pop-up.
  const elim = runner(run, 'eliminar_etapa');
  const prep = elim.slice(0, elim.indexOf('ejecutar:'));
  assert.ok(prep.indexOf('porQueNoSeElimina(c.cfg.pipeline, col.key)') >= 0
    && prep.indexOf('porQueNoSeElimina(') < prep.indexOf('payload:'), 'eliminar_etapa propone sin preguntar qué no se borra');
  assert.match(prep, /await leadsEnEtapa\(c\.funnelId, col\.key\)/, 'eliminar_etapa propone sin contar los leads');
  assert.match(prep, /avisoAlQuitarEtapa\(leads\)/, 'el resumen no dice lo que pasa con sus leads');
  assert.match(run, /async function leadsEnEtapa[\s\S]{0,200}conteosDelEmbudo\(funnelId\)/);
  // Ninguno escribe al proponer.
  for (const id of [...Object.keys(OPS), 'columna_nutricion_crm']) {
    const r = runner(run, id);
    assert.doesNotMatch(r.slice(0, r.indexOf('ejecutar:')), /editarEtapa\(/, `${id} escribe al proponer`);
  }
});

test('las seis: por chat, sólo el admin del CRM, y cada una con su ruta REST', () => {
  for (const id of [...Object.keys(OPS), 'columna_nutricion_crm']) {
    const d = porId(id);
    assert.ok(d && esAccion(d), `falta ${id}`);
    assert.equal(d.confirmacion, 'chat');
    assert.equal(d.gating?.rolMinimo, 'admin', `${id}: un closer editaría el embudo`);
    assert.equal(d.gating?.tab, 'crm');
  }
  assert.equal(porId('eliminar_etapa')?.reversible, false, 'quitar una etapa no tiene vuelta por la API');
  for (const [metodo, ruta, id] of [
    ['POST', '/crm/etapas', 'agregar_etapa'],
    ['PUT', '/crm/etapas/orden', 'ordenar_etapas'],
    ['PATCH', '/crm/etapas/st3', 'renombrar_etapa'],
    ['DELETE', '/crm/etapas/st3', 'eliminar_etapa'],
    ['PUT', '/crm/etapas/st3/plazo', 'plazo_etapa'],
    ['PUT', '/crm/etapas/nutri/nutricion', 'columna_nutricion_crm'],
  ] as const) {
    const r = resolverRest(metodo, ruta.split('/'));
    assert.ok(r && 'operacion' in r && r.operacion === id, `${metodo} ${ruta} no llega a ${id}`);
  }
});

// PROBADO ROMPIÉNDOLO (23/10/2026, este archivo + tests/funnel-estructura.test.ts, base 0 fallos / 33 pases, restaurado
// de memoria). Cada rotura y lo que cayó:
//   · porQueNoSeElimina deja borrar una terminal                → 2 fallos
//   · porQueNoSeElimina deja borrar la entrada                  → 2 fallos
//   · pipelineReordenado no pone la entrada primera             → 2 fallos
//   · pipelineReordenado pierde lo no nombrado (ganado)         → 1 fallo
//   · la op eliminar sin porQueNoSeElimina                      → 2 fallos
//   · la action no delega en editarEtapa                        → 1 fallo
//   · eliminar_etapa propone sin preguntar qué no se borra      → 1 fallo
//   · eliminar_etapa propone sin contar los leads               → 1 fallo
//   · eliminar_etapa marcada reversible                         → 1 fallo
//   · plazo_etapa sin el admin                                  → 1 fallo
