// =============================================================================
// Las páginas en OLAS: Chats tardaba 17 s en abrir (20/10/2026, llamada con Leila, minuto 55:12)
// =============================================================================
// Medido en el ws1 (sólo GET, `next start` local con un cronómetro de fetch): abrir Chats eran 39 consultas y 17,4 s,
// y 12,7 de esos segundos eran las 19 páginas del espejo de WhatsApp (`wa_mensajes`) pedidas UNA DETRÁS DE OTRA;
// después, 6 páginas de la agenda y cuatro lecturas más, también en serie. El arreglo:
//   1. `leerPorPaginas` acepta `paralelo`: las páginas salen en olas, se entregan EN ORDEN y cortan igual (página
//      corta, `false` o el tope);
//   2. el espejo va en olas de 5 y la agenda en olas de 4;
//   3. lo que no depende del espejo (agenda, «Nutrición - Manual», ocultos, bloqueados) arranca CON él.
// Números de antes y después en docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 5 / 0, de a una rotura y restaurada:
//   · `leerPorPaginas` ignorando `paralelo` (de a una, como antes)                → 4 / 1
//   · lib/evolution-mensajes.ts de antes (el espejo de a una y lo demás al final)  → 4 / 1
// Correr: node --import tsx --test tests/paginado-paralelo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerPorPaginas } from '../lib/supabase-paginado';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

/** Una tabla falsa de `total` filas, que responde cada página a los `ms` y cuenta cuántas hay en vuelo a la vez. */
function tablaFalsa(total: number, ms = 5) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: total - i }));
  const medida = { enVuelo: 0, maxEnVuelo: 0, pedidas: [] as number[] };
  const consulta = {
    neq() { return consulta; }, eq() { return consulta; }, not() { return consulta; }, order() { return consulta; },
    range(desde: number, hasta: number) {
      medida.pedidas.push(desde);
      medida.enVuelo++; medida.maxEnVuelo = Math.max(medida.maxEnVuelo, medida.enVuelo);
      return new Promise((res) => setTimeout(() => { medida.enVuelo--; res({ data: filas.slice(desde, hasta + 1), error: null }); }, ms));
    },
  };
  const db = { from: () => ({ select: () => consulta }) } as unknown as SupabaseClient;
  return { db, medida };
}

const juntar = async (total: number, opts: { paralelo?: number; maxPaginas?: number }, cortarEn?: number) => {
  const { db, medida } = tablaFalsa(total);
  const vistas: Array<{ nro: number; ids: number[] }> = [];
  await leerPorPaginas<{ id: number }>(db, 't', 'id', (f, nro) => { vistas.push({ nro, ids: f.map((x) => x.id) }); return cortarEn == null || nro < cortarEn; }, { pagina: 100, ...opts });
  return { vistas, medida };
};

test('en olas: las mismas filas, en el mismo orden, que de a una', async () => {
  const deAUna = await juntar(2345, {});
  const enOlas = await juntar(2345, { paralelo: 5 });
  assert.deepEqual(enOlas.vistas, deAUna.vistas);
  assert.equal(enOlas.vistas.flatMap((v) => v.ids).length, 2345);
});

test('`paralelo: 5` pide 5 páginas a la vez; sin él, de a una', async () => {
  assert.equal((await juntar(2345, {})).medida.maxEnVuelo, 1);
  const enOlas = await juntar(2345, { paralelo: 5 });
  assert.equal(enOlas.medida.maxEnVuelo, 5, 'las páginas tienen que salir en olas, no de a una');
  // 24 páginas (la última corta): 5 olas, a lo sumo 1 página pedida de más.
  assert.ok(enOlas.medida.pedidas.length <= 25, `pidió ${enOlas.medida.pedidas.length} páginas`);
});

test('corta igual: con `false` desde onPagina y con el tope (que sigue lanzando)', async () => {
  const cortada = await juntar(2345, { paralelo: 5 }, 7);
  assert.deepEqual(cortada.vistas.map((v) => v.nro), [1, 2, 3, 4, 5, 6, 7], 'entrega en orden y corta en la que pidió');
  await assert.rejects(juntar(2345, { paralelo: 5, maxPaginas: 3 }), /pasó 3 páginas/);
  const { db, medida } = tablaFalsa(2345);
  await leerPorPaginas(db, 't', 'id', () => {}, { pagina: 100, paralelo: 5, maxPaginas: 3 }).catch(() => {});
  assert.ok(medida.pedidas.length <= 3, `con tope 3 pidió ${medida.pedidas.length} páginas`);
});

test('el espejo de Chats va en olas y lo que no depende de él arranca con él', () => {
  const m = leer('lib/evolution-mensajes.ts');
  const ini = m.indexOf('export async function getConversacionesNoOficial(');
  const f = m.slice(ini, m.indexOf('\nexport ', ini + 1));
  assert.match(f, /orden: ORDEN_ESPEJO, paralelo: 5,/, 'el espejo tiene que leerse en olas');
  const espejo = f.indexOf('await leerPorPaginas<Fila>(');
  for (const p of ['const agendaP = ', 'const manualesP = ', 'const ocultosP = ', 'const bloqueadosP = ']) {
    const i = f.indexOf(p);
    assert.ok(i > 0 && i < espejo, `${p.trim()} tiene que arrancar ANTES del espejo, no esperarlo`);
  }
  assert.doesNotMatch(f.slice(espejo), /await telefonosOcultos\(\)|await telefonosBloqueados\(\)|await getNombresContacto\(\)/, 'volvió una lectura en serie después del espejo');
  assert.match(leer('lib/evolution-contactos.ts'), /paralelo: 4/, 'la agenda también en olas');
});

test('en olas también lanza si una página falla', async () => {
  let n = 0;
  const consulta = {
    order() { return consulta; },
    range() { n++; return Promise.resolve(n === 3 ? { data: null, error: { message: 'se cayó' } } : { data: Array.from({ length: 100 }, () => ({})), error: null }); },
  };
  const db = { from: () => ({ select: () => consulta }) } as unknown as SupabaseClient;
  await assert.rejects(leerPorPaginas(db, 't', 'id', () => {}, { pagina: 100, paralelo: 5 }), /página 3\): se cayó/);
});
