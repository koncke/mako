// =============================================================================
// Mover (y eliminar) en lote de a tandas: nunca un corte callado (24/10/2026)
// =============================================================================
// Martín tildó los 221 de «Círculo TIBIO» con la casilla de la columna y los movió a «Lead entrante»: se movieron 121. Medido en
// su historial: 121 en 67 s y se cortó (la acción del server tiene 60 s); los 100 que quedaban, en 50 s. La casilla tildaba los
// 221: lo que cortaba era el TIEMPO de una sola llamada que mueve de a uno, y además un `slice(0, 200)` callado.
// Roturas (base 6/0): la cola sin reencolar los pendientes → cae el 1; sin parar cuando no avanza → cae el 2 (colgado: con
// tope); el server sin devolver lo que pasa de 200 → cae el 4; la barra de un solo llamado → cae el 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TANDA_LOTE, PRESUPUESTO_LOTE_MS, colaDelAviso, correrEnTandas } from '../app/crm/lote-tandas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '');
const rango = (n: number, desde = 1) => Array.from({ length: n }, (_, i) => desde + i);

/** Un server falso que mueve de a uno y corta por «tiempo»: procesa a lo sumo `porLlamada` y devuelve el resto pendiente. */
function serverQueCorta(porLlamada: number) {
  const movidos: number[] = [];
  let llamadas = 0;
  const mover = async (ids: number[]) => {
    llamadas++;
    const hechos = ids.slice(0, porLlamada);
    movidos.push(...hechos);
    return { movidos: hechos.length, pendientes: ids.slice(porLlamada) };
  };
  return { mover, movidos, llamadas: () => llamadas };
}

test('1. un lote más grande que una pantalla (221) termina entero aunque el server corte cada llamada a mitad', async () => {
  const s = serverQueCorta(7);
  const avances: number[] = [];
  const r = await correrEnTandas(rango(221), TANDA_LOTE, s.mover, (k) => avances.push(k));
  assert.equal(r.error, null);
  assert.deepEqual([r.quedan, r.inciertos], [[], []]);
  assert.equal(r.resultados.reduce((n, x) => n + x.movidos, 0), 221, 'se movieron todos');
  assert.deepEqual(s.movidos, rango(221), 'en orden, cada uno una vez');
  assert.ok(avances.length > 1 && avances.at(-1) === 221, 'el avance llega a 221');
  // Ninguna llamada pide más que una tanda: cada una cabe holgada en los 60 s (~0,5 s por lead, medido).
  assert.ok(TANDA_LOTE * 500 < 30_000 && PRESUPUESTO_LOTE_MS < 60_000);
});

test('2. si una tanda no avanza, para (no se cuelga) y dice cuántos quedan', { timeout: 5_000 }, async () => {
  const r = await correrEnTandas(rango(60), 25, async (ids) => ({ pendientes: ids }));
  assert.match(r.error ?? '', /no llegó a procesar ninguno/);
  assert.equal(r.quedan.length, 60, 'los 60 siguen como estaban');
  assert.equal(r.resultados.length, 1);
});

test('3. si una tanda se corta sin contestar, los de esa tanda quedan «sin confirmar» y los demás «quedan»', async () => {
  let n = 0;
  const r = await correrEnTandas(rango(100), 25, async (ids) => { if (++n === 3) throw new Error('fetch failed'); return { movidos: ids.length, pendientes: [] }; });
  assert.equal(r.error, 'fetch failed');
  assert.deepEqual(r.inciertos, rango(25, 51));
  assert.deepEqual(r.quedan, rango(25, 76));
  assert.equal(r.resultados.reduce((s, x) => s + (x as { movidos: number }).movidos, 0), 50);
  // Y el aviso lo dice con números, nunca «listo» a secas.
  assert.equal(colaDelAviso(r, ['movió', 'movieron']), ' · se cortó: 25 no se movieron (siguen como estaban) · 25 quedaron sin confirmar: revísalos');
  assert.equal(colaDelAviso({ quedan: [1], inciertos: [], error: 'x' }, ['movió', 'movieron']), ' · se cortó: 1 no se movió (siguen como estaban)');
  assert.equal(colaDelAviso({ quedan: [], inciertos: [], error: null }, ['movió', 'movieron']), '');
});

test('4. el server corta por tiempo y devuelve lo que falta (también lo que pasa de 200); la barra manda de a tandas', () => {
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  const bloque = (f: string) => { const i = acc.indexOf(`export async function ${f}(`); return acc.slice(i, acc.indexOf('\n}\n', i)); };
  {
    const f = 'moverLeadsDeEtapaAction', b = bloque(f);
    assert.match(b, /const ids = todos\.slice\(0, TOPE_LOTE\);/, `${f}: sin tope`);
    assert.match(b, /const hasta = Date\.now\(\) \+ PRESUPUESTO_LOTE_MS;/, `${f}: sin corte por tiempo`);
    assert.match(b, /if \(Date\.now\(\) > hasta\) \{ pendientes\.push\(id\); continue; \}/, `${f}: no devuelve lo que no llegó`);
    assert.match(b, /pendientes: \[\.\.\.pendientes, \.\.\.todos\.slice\(TOPE_LOTE\)\]/, `${f}: lo que pasa de 200 se pierde callado`);
  }
  // «Eliminar» manda a la PAPELERA desde el 28/10/2026 (mig 0340): el corte por tiempo vive en lib/leads-papelera.ts, de a
  // `TANDA_PAPELERA` por llamada a la base, y lo que no llega vuelve igual en `pendientes` (tests/crm-acciones-bloque.test.ts).
  {
    const f = 'eliminarLeadsAction', b = bloque(f);
    assert.match(b, /const ids = todos\.slice\(0, TOPE_LOTE\);/, `${f}: sin tope`);
    assert.match(b, /hasta: Date\.now\(\) \+ PRESUPUESTO_LOTE_MS/, `${f}: sin corte por tiempo`);
    assert.match(b, /pendientes: \[\.\.\.r\.pendientes, \.\.\.todos\.slice\(TOPE_LOTE\)\]/, `${f}: lo que pasa de 200 se pierde callado`);
    assert.match(sinComentarios(leer('lib/leads-papelera.ts')), /if \(Date\.now\(\) > hasta\) return \{ resultados, pendientes: todos\.slice\(i\) \};/, `${f}: no devuelve lo que no llegó`);
  }
  const barra = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(barra, /correrEnTandas\(ids, TANDA_LOTE, \(tanda\) => moverLeadsDeEtapaAction\(tanda, pide\.stage\.key, funnelActivo, motivo\),/);
  assert.match(barra, /correrEnTandas\(ids, TANDA_LOTE, \(tanda\) => eliminarLeadsAction\(tanda\),/);
  assert.doesNotMatch(barra, /await moverLeadsDeEtapaAction\(ids,|await eliminarLeadsAction\(ids\)/, 'volvió el llamado único con todos');
  assert.match(barra, /colaDelAviso\(t, \['movió', 'movieron'\]\)/, 'el aviso no dice cuántos quedaron');
  assert.match(barra, /\{avance && <span role="status"/, 'sin avance, un lote de dos minutos parece colgado');
  // «Agregar a un funnel»: el server corta en 2.000 callado; la barra va de a tandas y, con un corte, no cuenta «ya estaban».
  assert.match(barra, /for \(const tanda of enTandas\(ids, TANDA_AGREGAR\)\) \{\s*const t = await agregarLoteAProductoAction\(tanda, funnelId\);/);
  assert.match(barra, /const yaEstaban = error != null \? 0 : Math\.max\(0, ids\.length - n - r\.fallaron\);/);
});
