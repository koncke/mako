// =============================================================================
// Lo que una prueba de Automations cuenta de cada persona, y lo que dice la tarjeta (tanda A3, 25/10/2026)
// =============================================================================
// La crítica (docs/diseno-pruebas-ab.md, Anexo 2, B.5 y B.6) y la pantalla (2.9). Fija:
//   · «respondió»: la inscripción terminó contestando, con la hora de su desenlace (o su último cambio);
//   · «agendó» / «pagó»: sólo si al asignar NO estaba (sin el previo, no se sabe y no cuenta), con la hora de la lectura;
//   · el PRIMER resultado manda y sólo se congela un «sí» (un «no» puede volverse «sí» mañana);
//   · el previo se congela para cada métrica de ESTADO de la prueba: la que decide y sus guardrails;
//   · los medidores de Automations: por superficie en el cron, el ws explícito, y una persona que no encuentran es un «no»;
//   · la tarjeta: sin prueba, «todos van a A»; mientras corre no hay verde ni rojo, nunca un p-valor, y con poca gente sólo
//     los conteos; los finales.
// Correr: node --import tsx --test tests/pruebas-medir-automatizacion.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conElPrimero, pasoA, previoDe, respondio } from '../lib/pruebas/resultados';
import { textoDeChance, textoDeLaPrueba, textoDeRama } from '../lib/pruebas/pantalla';
import type { NumerosRama } from '../lib/pruebas/juez';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('respondió, agendó y pagó: la hora, el previo y el primer resultado', () => {
  assert.deepEqual(respondio({ estado: 'respondio', desenlace_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-04T10:00:00Z' }), { logro: true, at: '2026-11-03T10:00:00Z' });
  assert.deepEqual(respondio({ estado: 'handoff', desenlace_at: null, updated_at: '2026-11-04T10:00:00Z' }), { logro: true, at: '2026-11-04T10:00:00Z' });
  assert.deepEqual(respondio({ estado: 'activa' }), { logro: false });
  assert.deepEqual(respondio(null), { logro: false }, 'sin inscripción es un «no», no un hueco');
  const H = '2026-11-20T00:00:00.000Z';
  assert.deepEqual(pasoA({ agendo: false }, 'agendo', true, H), { logro: true, at: H });
  assert.deepEqual(pasoA({ agendo: true }, 'agendo', true, H), { logro: false }, 'ya había agendado al asignar');
  assert.deepEqual(pasoA(undefined, 'agendo', true, H), { logro: false }, 'sin previo no se sabe: no cuenta');
  assert.deepEqual(pasoA({ pago: false }, 'agendo', true, H), { logro: false }, 'el previo de OTRA métrica no sirve');
  assert.deepEqual(pasoA({ agendo: false }, 'agendo', false, H), { logro: false });
  // El primero manda; sólo se congela un «sí».
  assert.deepEqual(conElPrimero({ resultado: true, resultadoAt: '2026-11-02T00:00:00Z' }, { logro: false }), { resultado: { logro: true, at: '2026-11-02T00:00:00Z' }, congelar: false });
  assert.deepEqual(conElPrimero(undefined, { logro: true, at: H }), { resultado: { logro: true, at: H }, congelar: true });
  assert.deepEqual(conElPrimero(undefined, { logro: false }), { resultado: { logro: false }, congelar: false });
});

test('el previo se congela para cada métrica de estado: la que decide y sus guardrails', () => {
  const lead = { fecha_junta_1: '2026-11-10', fecha_primer_pago: null, cerro: false };
  assert.deepEqual(previoDe({ metrica: 'respondio', guardrails: [{ metrica: 'agendo' }, { metrica: 'pago' }] }, lead), { agendo: true, pago: false });
  assert.equal(previoDe({ metrica: 'respondio', guardrails: [] }, lead), undefined, '«respondió» no es un estado');
  assert.equal(previoDe({ metrica: 'agendo', guardrails: [] }, null), undefined);
});

test('los medidores de Automations: en el cron por superficie, con el ws explícito, y lo que no encuentran es un «no»', () => {
  const m = leer('lib/pruebas/medidores-automatizacion.ts');
  assert.match(m, /^import 'server-only';/m);
  assert.match(m, /getSupabaseServer\(\)\.from\(tabla\)\.select\(columnas\)\.eq\('workspace_id', ws\)\.in\(columna, ids\.slice\(i, i \+ TANDA\)\)/);
  assert.match(m, /\{ columna: 'secuencia_id', valor: sec \}/, '«respondió» de OTRA automatización contaría');
  assert.match(m, /for \(const a of asignaciones\) \{\n\s+const previos = congelados\.get\(a\.unidad\) \?\? \{\};\n\s+const ya: Congelado \| undefined = previos\[metrica\]/, 'devuelve a cada una, con lo congelado de ESTA métrica');
  assert.match(leer('lib/pruebas/store.ts'), /update\(\{ resultados: \{ \.\.\.previos, \[metrica\]: \{ at \} \} \}\)/, 'congelar una métrica pisa las otras');
  assert.match(m, /export const MEDIDORES_AUTOMATIZACION: Readonly<Record<string, Medidor>> = \{\n\s+respondio: medirRespondio,\n\s+agendo: medirAgendo,\n\s+pago: medirPago,\n\};/);
  const cron = leer('app/api/cron/pruebas/route.ts');
  assert.match(cron, /const MEDIDORES: Medidores = \{\n\s+automatizacion: MEDIDORES_AUTOMATIZACION,\n\};/);
  const corrida = leer('lib/pruebas/corrida.ts');
  assert.match(corrida, /const medidor = medidores\[p\.superficie\]\?\.\[metrica\];/, '«agendó» de una landing no se mide como el de una automatización');
  assert.match(corrida, /lugar: p\.lugar, asignaciones, hasta \}\);/, 'al medidor van TODAS las asignaciones (congela el primer resultado el día que pasa)');
});

const rama = (clave: string, n: number, x: number, pMejor: number, pPeor: number | null): NumerosRama =>
  ({ clave, control: clave === 'A', activa: true, n, x, tasa: n ? x / n : 0, pMejor, pPeor, perdida: null, lift: null });

test('la tarjeta: sin prueba todos a A; corriendo sin verde ni rojo ni p-valores; con poca gente sólo conteos; los finales', () => {
  const base = { superficie: 'automatizacion' as const, dia: 9, maxDias: 28, ramas: [rama('A', 41, 4, 0.29, null), rama('B', 40, 7, 0.71, 0.29)] };
  assert.equal(textoDeLaPrueba({ ...base, estado: 'sin_prueba' }), 'Sin prueba: todos van a A.');
  assert.match(textoDeLaPrueba({ ...base, estado: 'propuesta' }), /todos van a A/);
  assert.equal(textoDeLaPrueba({ ...base, estado: 'corriendo', seNotaDesde: 0.35 }), 'Midiendo · día 9 de 28 · A 41 / B 40 · B va adelante (71 %) · con este tráfico sólo se nota una diferencia de ±35 % o más');
  assert.equal(textoDeLaPrueba({ ...base, estado: 'corriendo', ramas: [rama('A', 6, 1, 0.3, null), rama('B', 5, 2, 0.7, 0.3)] }), 'Midiendo · día 9 de 28 · A 6 / B 5', 'con poca gente sólo los conteos');
  assert.match(textoDeLaPrueba({ ...base, estado: 'concluida', veredicto: 'gana_variante', sirviendo: 'B' }), /^Ganó B · /);
  assert.match(textoDeLaPrueba({ ...base, estado: 'concluida', veredicto: 'da_lo_mismo', sirviendo: 'A' }), /^Empate: quedó A · /);
  assert.match(textoDeLaPrueba({ ...base, estado: 'concluida', veredicto: 'no_concluyente', sirviendo: 'B' }), /^B iba adelante \(71 %\): quedó B, sin afirmarlo · /);
  assert.match(textoDeLaPrueba({ ...base, estado: 'concluida', veredicto: 'no_concluyente', sirviendo: 'A' }), /^Todavía no se sabe: quedó A · /);
  for (const e of ['corriendo', 'concluida'] as const) assert.doesNotMatch(textoDeLaPrueba({ ...base, estado: e, veredicto: 'gana_variante' }), /p ?[<=]|p-valor|significativ/i);
  assert.equal(textoDeRama({ clave: 'B', pct: 50 }, rama('B', 9, 3, 0.7, 0.3), 9, 'respondieron'), 'B · 50 % — 9 entraron · 3 respondieron (33 %)');
  assert.equal(textoDeRama({ clave: 'B', pct: 50 }, undefined, undefined, 'respondieron'), 'B · 50 %');
  assert.equal(textoDeChance(rama('B', 40, 7, 0.71, 0.29), 'automatizacion'), 'Hay 71 % de chance de que B sea mejor que A.');
  assert.equal(textoDeChance(rama('B', 5, 2, 0.7, 0.3), 'automatizacion'), null, 'con poca gente no se dice chance');
});
