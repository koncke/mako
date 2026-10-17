// =============================================================================
// El diagnóstico del embudo, de UNO o VARIOS funnels, no siempre del principal (#896)
// =============================================================================
// Martín, 17/10/2026 (tras el pedido de un cliente para los OKR): «estoy seguro que no solamente en los OKR, esa
// configuración seguro debe faltar en varios lugares». La Retro se retiró con Experiments; lo que quedaba era el embudo de
// la API de MaKo (`diagnosticar_funnel`), que siempre medía el funnel principal (`getFunnelEtapas`, lib/queries.ts).
// Lo que se puede romper sin que se vea: un lead que cuenta en un funnel donde no estaba ese día (la regla del OKR), dos
// funnels con etapas distintas sumados paso por paso, y que el modelo no sepa que lo de Meta es de toda la cuenta.
// Medido el 17/10 en el ws1: «Negocio que ESCALA» y «Renovación» tienen etapas distintas (dan `FunnelsConEtapasDistintas`).
//
// Correr: node --import tsx --test tests/funnel-etapas-elegidos.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): los leads sin filtrar por funnel → 3 / 1; varios funnels sin comparar sus
// etapas → 3 / 1; la API sin pasar los funnels → 3 / 1; la nota de «pauta de toda la cuenta» fuera → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS as DEFS_METRICAS } from '../lib/api-mako/areas/metricas.def';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));
const entre = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); const j = src.indexOf(hasta, i + 1); assert.ok(i >= 0 && j > i, `no encontré ${desde}`); return src.slice(i, j); };

test('cada lead cuenta en el funnel donde estaba ESE día (la regla del OKR), también las altas', () => {
  const q = leer('lib/queries.ts');
  const f = entre(q, 'export async function getFunnelEtapas(', 'const pctDe =');
  assert.match(f, /const rows = await enLosFunnels\(leadsRes\.data \?\? \[\], funnels, \(r\) => r\.fecha_junta_1\);/);
  assert.match(f, /necesitaEntradas && conFunnels \? altasEnFunnels\(supabase, altaDesde, altaHasta, funnels\) : Promise\.resolve\(null\)/);
  assert.match(f, /agendas: conFunnels \? total_j1 : mkt\.reuniones_en_ventana,/, 'con funnels, las agendas salen de los leads del funnel');
  const en = entre(q, 'async function enLosFunnels<', 'async function altasEnFunnels(');
  assert.match(en, /return funnels\.length \? filtrarPorFunnels\(filas\.map\(\(x\) => \(\{ \.\.\.x, leadId: Number\(x\.id\), fecha: fecha\(x\) \}\)\), funnels\) : \[\.\.\.filas\];/);
  const altas = entre(q, 'async function altasEnFunnels(', 'export const MIN_MUESTRA');
  assert.match(altas, /leerTodo<[^>]+>\(supabase, 'leads', 'id, estado_lead, created_at'/, 'las altas de un funnel se leen paginadas (un COUNT no dice de qué funnel es cada una)');
  assert.match(altas, /enLosFunnels\(filas, funnels, \(x\) => x\.created_at\.slice\(0, 10\)\)/);
});

test('varios funnels se miden juntos SÓLO si comparten sus pasos comerciales', () => {
  const q = leer('lib/queries.ts');
  const e = entre(q, 'async function etapasDeFunnels(', 'return fs[0].stages;');
  assert.match(e, /pasosComercialesDe\(st\)\.map\(\(p\) => \[p\.key, p\.entrada, p\.salida\]\)/);
  // La condición, no sólo el throw: un `if` que nunca da (o que mira uno solo) suma embudos distintos sin avisar.
  assert.match(e, /if \(fs\.some\(\(f\) => firma\(f\.stages\) !== primera\)\) \{\s*throw new FunnelsConEtapasDistintas\(/);
  assert.match(q, /const stages = funnels\.length \? await etapasDeFunnels\(funnels\) : await getPipelineStagesDefault\(\)\.catch\(\(\) => null\);/);
});

test('la API de MaKo recibe «funnels» con la MISMA lectura que el OKR, y se los pasa al embudo', () => {
  const def = DEFS_METRICAS.find((d) => d.id === 'diagnosticar_funnel');
  assert.ok(def?.parametros.some((p) => p.nombre === 'funnels'), 'diagnosticar_funnel no recibe «funnels»');
  const run = leer('lib/api-mako/areas/metricas.run.ts');
  const diag = entre(run, 'diagnosticar_funnel: {', 'ver_serie_funnel_semanal: {');
  assert.match(diag, /const elegidos = await funnelsDelPedido\(input\);/);
  assert.match(diag, /getFunnelEtapas\(desde, hasta, fuentes \? sourcesToMap\(fuentes\) : undefined, ids\)/);
  assert.match(diag, /if \(e instanceof FunnelsConEtapasDistintas\) return errorPedido\(e\.message\);/);
  // Una sola lectura del parámetro para todas las áreas: General la importa, no la copia.
  assert.match(leer('lib/api-mako/areas/general.run.ts'), /import \{ funnelsDelPedido \} from '\.\.\/funnels-del-pedido';/);
  assert.doesNotMatch(leer('lib/api-mako/areas/general.run.ts'), /async function funnelsDelPedido/);
});

test('el modelo sabe que lo de Meta es de toda la cuenta cuando mide un funnel', () => {
  const diag = entre(leer('lib/api-mako/areas/metricas.run.ts'), 'diagnosticar_funnel: {', 'ver_serie_funnel_semanal: {');
  assert.match(diag, /if \(f\.pautaDeTodaLaCuenta\) notas\.unshift\('Embudo de los funnels elegidos:/);
  assert.match(leer('lib/queries.ts'), /\.\.\.\(conFunnels \? \{ funnels: \[\.\.\.funnels\], pautaDeTodaLaCuenta: true \} : \{\}\)/);
});
