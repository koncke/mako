// =============================================================================
// «Esperar 1 día» cuenta desde que SALIÓ el mensaje, no desde que el motor procesó la condición (24/10/2026)
// =============================================================================
// Martín: «el goteo debe comenzar a contar desde que se envía el primer mensaje». Medido en `nutricion_inscripciones` de la
// #289 (Mauricio): primer mensaje → «Contestó» → «Esperar 1 día» → segundo mensaje. El goteo le daba a la condición un turno
// como a un mensaje (629500245) y el horario la congelaba de noche; la espera contaba desde que la condición pasaba. A «186»
// le salió el primero el 23/10 23:14 ART, la condición pasó el 24/10 13:57, y el segundo quedó para el 25/10 13:57. Ahora la
// espera cuenta desde que la inscripción quedó LISTA (`relojDeLasEsperas`: su `proximo_envio_at` vencido).
// La regla se ejecuta (lib/nutricion-grafo-motor.ts); del motor (lib/nutricion.ts) sólo se lee el cableado.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { relojDeLasEsperas, resolverControl } from '../lib/nutricion-grafo-motor';
import type { PasoGrafo } from '../lib/flujo-grafo';

const H = 3_600_000;
const MIN = 60_000;
/** La forma de la #289 desde lo que sigue al primer mensaje: la condición «Contestó» y, si no, «Esperar 1 día» y el segundo. */
const FLUJO = [
  { id: 'c1', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'av' }], si_no: 'e1' },
  { id: 'av', canal: 'whatsapp', cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'Respondió' } } },
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' },
  { id: 'm2', canal: 'whatsapp', cuerpo: 'Hola, ¿pudiste ver lo que te mandé?', siguiente: null },
] as unknown as PasoGrafo[];
const NO_CONTESTO = { contestoEnEsta: false } as never;
const M1 = Date.parse('2026-10-24T02:14:00Z');      // 23/10 23:14 ART: le salió el primer mensaje
const ABRE = Date.parse('2026-10-24T16:57:00Z');    // 24/10 13:57 ART: la condición pasa al abrir el horario, en su turno

test('«186»: la condición pasa 14 h 43 min después del mensaje, y el segundo sale 1 día después DEL MENSAJE', () => {
  const r = resolverControl(FLUJO, 0, { hechos: NO_CONTESTO, ahoraMs: ABRE, reunionMs: null, relojMs: relojDeLasEsperas(new Date(M1).toISOString(), ABRE) });
  assert.equal(r.tipo, 'esperar');
  assert.equal(r.tipo === 'esperar' && r.proximoMs, M1 + 24 * H, 'la espera contó desde que se procesó la condición, no desde el mensaje');
});

test('sin el reloj, lo de antes: la espera cuenta desde ahora', () => {
  const r = resolverControl(FLUJO, 0, { hechos: NO_CONTESTO, ahoraMs: ABRE, reunionMs: null });
  assert.equal(r.tipo === 'esperar' && r.proximoMs, ABRE + 24 * H);
});

test('si el día ya pasó (la automatización estuvo en pausa), sigue de largo al segundo mensaje', () => {
  const tarde = M1 + 30 * H;
  const r = resolverControl(FLUJO, 0, { hechos: NO_CONTESTO, ahoraMs: tarde, reunionMs: null, relojMs: M1 });
  assert.deepEqual(r.tipo === 'nodo' && r.idx, 3, 'no siguió al segundo mensaje');
});

test('dos esperas seguidas: la segunda cuenta desde que venció la primera, no desde ahora', () => {
  const dos = [
    { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'e2' },
    { id: 'e2', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'm' },
    { id: 'm', canal: 'whatsapp', cuerpo: 'Hola', siguiente: null },
  ] as unknown as PasoGrafo[];
  const base = Date.parse('2026-10-24T12:00:00Z');
  const r = resolverControl(dos, 0, { hechos: null, ahoraMs: base + 90 * MIN, reunionMs: null, relojMs: base });
  assert.equal(r.tipo === 'esperar' && r.proximoMs, base + 120 * MIN);
});

test('el reloj: el `proximo_envio_at` vencido, y nunca en el futuro', () => {
  const ahora = Date.parse('2026-10-24T18:00:00Z');
  assert.equal(relojDeLasEsperas('2026-10-24T02:14:00Z', ahora), Date.parse('2026-10-24T02:14:00Z'));
  assert.equal(relojDeLasEsperas('2026-10-25T02:14:00Z', ahora), ahora, 'un reloj en el futuro adelantaría la espera');
  assert.equal(relojDeLasEsperas(null, ahora), ahora);
  assert.equal(relojDeLasEsperas('no es fecha', ahora), ahora);
  // Y si alguien pasa un reloj en el futuro igual, la espera no se adelanta.
  const r = resolverControl(FLUJO, 0, { hechos: NO_CONTESTO, ahoraMs: ABRE, reunionMs: null, relojMs: ABRE + 5 * H });
  assert.equal(r.tipo === 'esperar' && r.proximoMs, ABRE + 24 * H);
});

test('el motor le pasa a las esperas el reloj de la inscripción', () => {
  const motor = readFileSync(join(import.meta.dirname, '..', 'lib/nutricion.ts'), 'utf8');
  assert.match(motor, /const r = resolverControl\(sec\.pasos, idxLeido, \{ hechos, ahoraMs: ahoraCtl, reunionMs: reunionFuturaMs\(lead\), reunionConHoraMs, relojMs: relojDeLasEsperas\(insc\.proximo_envio_at, ahoraCtl\) \}\);/);
});

// ── Las roturas (6 tests; sin romper nada: 6 pases, 0 fallos). Fallos / pases con cada una: ───────────────────────
// 1. La espera vuelve a contar desde ahora: 3 / 3.          2. El reloj puede quedar en el futuro: 1 / 5.
// 3. Una espera vencida no corre el reloj: 1 / 5.           4. `relojDeLasEsperas` toma un `proximo_envio_at` futuro: 1 / 5.
// 5. El motor no le pasa el reloj a `resolverControl`: 1 / 5.
