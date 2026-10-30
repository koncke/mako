// =============================================================================
// El paso de una inscripción SIN TARJETA no se nombra por la posición del array (ticket #33 de Leandro, 30/10/2026)
// =============================================================================
// GANCHOS decía por la API «Todavía no te veo…» cuando a la persona le había salido el recurso. Al terminar el flujo el motor deja
// `nodo_actual` null y `paso_actual` en el índice SIGUIENTE (`avanceDesde`), y el #788 la pasa a 'respondio': ese número es lo que
// sigue en el array, no donde está. Medido el 30/10 en producción: de 150 vivas sin tarjeta, 106 nombraban otra tarjeta que la
// última que les salió, 2 estaban fuera del array y 1 acertaba. Las 37 activas sin tarjeta están en la entrada: ésas sí valen.
//
// Correr: node --import tsx --test tests/paso-sin-tarjeta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detalleDe, enAutomatizacionesDe, indiceDeLaFila, sinTarjeta, type FilaInscripcionDetalle } from '../lib/automatizaciones-del-lead-reglas';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

// Como la 684 de producción: el recurso es lo último que salió, y lo que SIGUE en el array es un «Todavía no te veo…» de otra rama.
const PASOS = [
  { id: 'm1', canal: 'instagram', tipo: 'texto', cuerpo: 'Hola, ¿te lo mando?', botones: [{ id: 'b1', texto: 'Obtener recurso', siguiente: 'recurso' }] },
  { id: 'recurso', canal: 'instagram', tipo: 'texto', cuerpo: 'Acá está el recurso' },
  { id: 'noteveo', canal: 'instagram', tipo: 'texto', cuerpo: 'Todavía no te veo entre nuestros seguidores' },
] as unknown as PasoGrafo[];
const SEC = { id: 680, nombre: 'Ganchos', activa: true, archivada_at: null, pasos: PASOS };
const fila = (extra: Partial<FilaInscripcionDetalle>): FilaInscripcionDetalle => ({
  id: 684, lead_id: 5437, secuencia_id: 680, estado: 'respondio', paso_actual: 2, nodo_actual: null, proximo_envio_at: null,
  inscripto_at: '2026-10-30T03:00:00Z', updated_at: '2026-10-30T03:51:14Z', desenlace: null, ...extra,
});
const enLista = (f: FilaInscripcionDetalle, ultimo?: Map<number, string>) => enAutomatizacionesDe([f], [SEC], undefined, ultimo).get(5437)![0];

test('respondió sin tarjeta: no nombra lo que sigue en el array; con el último envío, nombra ése y lo dice', () => {
  assert.equal(sinTarjeta(fila({})), true);
  assert.equal(indiceDeLaFila(PASOS, fila({})), -1);
  assert.equal(enLista(fila({})).paso, null, 'sin saber qué salió, sin nombre: nunca la posición');
  const a = enLista(fila({}), new Map([[684, 'recurso']]));
  assert.deepEqual(a.paso?.numero, 2);
  assert.match(a.paso!.titulo, /recurso/);
  assert.equal(a.paso?.ultimoEnviado, true);
  assert.doesNotMatch(a.paso!.titulo, /no te veo/);
});

test('sin tarjeta tampoco lee los botones de una tarjeta que no es la suya', () => {
  // `paso_actual` 0 + respondió: la posición caía en la entrada, que tiene botones: decía que esperaba un toque.
  assert.equal(enLista(fila({ paso_actual: 0 })).esperaToque, undefined);
  const d = detalleDe({ zona: 'UTC', filas: [fila({ paso_actual: 0 })], secs: [SEC], reentradaDe: () => 'una_vez', envios: [], audit: [], ahoraMs: Date.parse('2026-10-30T04:00:00Z') });
  assert.equal(d.inscripciones[0].esperaToque, null);
});

test('en curso, la posición sigue valiendo; con tarjeta, la tarjeta', () => {
  const entrada = fila({ estado: 'activa', paso_actual: 0 });
  assert.equal(sinTarjeta(entrada), false);
  assert.equal(indiceDeLaFila(PASOS, entrada), 0, 'una activa sin tarjeta está en la entrada');
  assert.equal(enLista(entrada).paso?.numero, 1);
  assert.equal(enLista(entrada).paso?.ultimoEnviado, undefined);
  const parada = fila({ estado: 'respondio', paso_actual: 2, nodo_actual: 'recurso' });
  assert.equal(enLista(parada, new Map([[684, 'm1']])).paso?.numero, 2, 'con tarjeta manda la tarjeta, no el último envío');
});

test('el nodo del último envío ya no está en el lienzo: sin nombre', () => {
  assert.equal(enLista(fila({}), new Map([[684, 'borrado']])).paso, null);
});

test('la ficha nombra lo último que salió: el más nuevo, y sólo lo que salió de verdad', () => {
  const d = detalleDe({
    zona: 'UTC', filas: [fila({})], secs: [SEC], reentradaDe: () => 'una_vez', audit: [], ahoraMs: Date.parse('2026-10-30T04:00:00Z'),
    envios: [
      { inscripcion_id: 684, nodo_id: 'm1', canal: 'instagram', estado: 'enviado', error: null, created_at: '2026-10-30T03:00:00Z' },
      { inscripcion_id: 684, nodo_id: 'recurso', canal: 'instagram', estado: 'enviado', error: null, created_at: '2026-10-30T03:50:00Z' },
      { inscripcion_id: 684, nodo_id: 'noteveo', canal: 'instagram', estado: 'omitido', error: null, created_at: '2026-10-30T03:51:00Z' },
    ],
  });
  assert.equal(d.inscripciones[0].paso?.numero, 2);
  assert.match(d.inscripciones[0].paso!.titulo, /recurso/i);
});

test('el cableado: la API pide el último envío y dice qué nombra `paso`; el tablero del CRM no paga esa lectura', () => {
  const r = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(r, /await enAutomatizaciones\(\[leadId\], \{ ultimoEnvio: true \}\)/);
  assert.match(r, /paso_es: .*'lo_ultimo_que_le_salio' : 'donde_esta'/);
  const a = leer('lib/automatizaciones-del-lead.ts');
  assert.match(a, /if \(o\?\.ultimoEnvio\) return enAutomatizacionesDe\(filas, automatizaciones, await frenosDelNegocio\(filas, automatizaciones\), await ultimoNodoEnviado\(db, filas\)\);/);
  assert.match(a, /if \(error\) \{ console\.error\(`\[automatizaciones-del-lead\] el último envío: \$\{error\.message\}`\); return out; \}/, 'si no se lee, sin nombre: no rompe la lectura');
  assert.match(leer('app/automations/automatizaciones-del-lead-actions.ts'), /await enAutomatizaciones\(leadIds\.filter\(idValido\)\)/);
});

// ROTURAS (30/10/2026, una por vez, restaurando byte a byte; base 6 / 0): sin tarjeta vuelve a la posición del array → 3 / 3 ·
// una activa sin tarjeta pierde su entrada → 5 / 1 · la lista no nombra el último envío → 5 / 1 · la ficha cuenta lo que no salió →
// 5 / 1 · la API no pide el último envío → 5 / 1 · un error del último envío rompe la lectura → 5 / 1.
