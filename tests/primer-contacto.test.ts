// =============================================================================
// El primer contacto de un lead (lib/primer-contacto.ts): lo que le prometió Martín a Código Inmobiliario el 30/10/2026.
// =============================================================================
// Ejecuta la regla pura. Probado rompiéndolo (5/11/2026, base 9/0):
//   · saltear los automáticos (contar el primer saliente sea quien sea)             → 6/3 (el 2, el 3 y el 6);
//   · tratar un `null` como «una persona» en vez de «no se sabe»                    → 7/2 (el 3 y el 6);
//   · quitar «ya hablaban antes»                                                     → 7/2 (el 4 y el 6);
//   · contar en la primera hora a los que todavía están a tiempo                    → 8/1 (el 6).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAMOS_PRIMER_CONTACTO, cuentaParaPrimerContacto, duracionLegible, losQueMasEsperaron, percentilOrdenado, primerContacto, resumirPrimerContacto,
  tramoDePrimerContacto, type SalienteContacto,
} from '../lib/primer-contacto';

const ENTRO = Date.parse('2026-11-03T15:00:00Z');
const min = (n: number) => ENTRO + n * 60_000;
const AHORA = min(5 * 24 * 60);
const wa = (n: number, automatico: boolean | null): SalienteContacto => ({ t: min(n), canal: 'whatsapp', automatico });

test('1 · una persona que escribe a los 42 minutos: contactado en 42, por WhatsApp', () => {
  const p = primerContacto(ENTRO, [wa(42, false), wa(90, false)], AHORA);
  assert.deepEqual([p.estado, p.minutos, p.canal, p.automaticoMinutos], ['contactado', 42, 'whatsapp', null]);
  assert.equal(tramoDePrimerContacto(p), 'En la primera hora');
});

test('2 · la bienvenida automática NO es el contacto de una persona: cuenta la persona, y la automática queda aparte', () => {
  const p = primerContacto(ENTRO, [wa(1, true), wa(2, true), { t: min(3 * 24 * 60), canal: 'llamada', automatico: false }], AHORA);
  assert.equal(p.estado, 'contactado');
  assert.equal(p.minutos, 3 * 24 * 60);
  assert.equal(p.canal, 'llamada');
  assert.equal(p.automaticoMinutos, 1, 'la automática salió al minuto');
  assert.equal(tramoDePrimerContacto(p), 'De 1 a 3 días');
  // Sólo automáticos: nadie lo contactó todavía.
  const s = primerContacto(ENTRO, [wa(1, true)], AHORA);
  assert.equal(s.estado, 'sin_contactar');
  assert.equal(s.automaticoMinutos, 1);
  assert.equal(s.esperandoMinutos, 5 * 24 * 60);
});

test('3 · un WhatsApp sin marca (de antes de la marca) primero: «No se sabe», nunca contactado ni sin contactar', () => {
  const p = primerContacto(ENTRO, [wa(5, null), wa(30, false)], AHORA);
  assert.equal(p.estado, 'no_se_sabe');
  assert.equal(p.minutos, null);
  assert.equal(tramoDePrimerContacto(p), 'No se sabe');
  // Un automático marcado antes del `null` se sigue diciendo.
  assert.equal(primerContacto(ENTRO, [wa(1, true), wa(5, null)], AHORA).automaticoMinutos, 1);
});

test('4 · si ya le habían escrito antes de que entrara: «Ya hablaban antes» (no es velocidad); un reloj corrido de segundos, no', () => {
  assert.equal(primerContacto(ENTRO, [wa(-30, false), wa(10, false)], AHORA).estado, 'antes');
  const casi = primerContacto(ENTRO, [{ t: ENTRO - 20_000, canal: 'whatsapp', automatico: false }], AHORA);
  assert.deepEqual([casi.estado, casi.minutos], ['contactado', 0]);
});

test('5 · los tramos van en su orden y todo estado cae en uno', () => {
  assert.deepEqual(TRAMOS_PRIMER_CONTACTO.slice(0, 4), ['En la primera hora', 'De 1 a 24 horas', 'De 1 a 3 días', 'Más de 3 días']);
  assert.equal(tramoDePrimerContacto(primerContacto(ENTRO, [wa(61, false)], AHORA)), 'De 1 a 24 horas');
  assert.equal(tramoDePrimerContacto(primerContacto(ENTRO, [wa(5 * 24 * 60, false)], AHORA + 1)), 'Más de 3 días');
  assert.equal(tramoDePrimerContacto(primerContacto(ENTRO, [], AHORA)), 'Sin contactar');
});

test('6 · el resumen: mediana y p90 sólo de los contactados; la primera hora no castiga al que entró hace 10 minutos', () => {
  const ahora = min(10);
  const lista = [
    primerContacto(ENTRO, [wa(5, false)], AHORA),
    primerContacto(ENTRO, [wa(120, false)], AHORA),
    primerContacto(ENTRO, [wa(1, true), wa(60 * 24 * 2, false)], AHORA),
    primerContacto(ENTRO, [], AHORA), // sin contactar hace 5 días
    primerContacto(ENTRO, [], ahora), // entró hace 10 min: a tiempo
    primerContacto(ENTRO, [wa(3, null)], AHORA),
    primerContacto(ENTRO, [wa(-100, false)], AHORA),
  ];
  const r = resumirPrimerContacto(lista);
  assert.equal(r.leads, 7);
  assert.equal(r.contactados, 3);
  assert.equal(r.sinContactar, 2);
  assert.equal(r.aTiempo, 1);
  assert.equal(r.noSeSabe, 1);
  assert.equal(r.antes, 1);
  assert.equal(r.medianaMinutos, 120);
  assert.equal(r.p90Minutos, 60 * 24 * 2);
  assert.equal(r.enLaPrimeraHora, 1);
  assert.equal(r.baseLaPrimeraHora, 4, 'los 3 contactados y el que espera hace 5 días; no el de hace 10 min');
  assert.equal(r.conAutomatico, 1);
});

test('7 · el percentil por rango más cercano y la duración dicha como la lee una persona', () => {
  assert.equal(percentilOrdenado([], 50), null);
  assert.equal(percentilOrdenado([1, 2, 3, 4], 50), 2);
  assert.equal(percentilOrdenado([1, 2, 3, 4], 90), 4);
  assert.equal(duracionLegible(12.4), '12 min');
  assert.equal(duracionLegible(200), '3 h 20 min');
  assert.equal(duracionLegible(60 * 24 + 60 * 4), '1 día 4 h');
  assert.equal(duracionLegible(60 * 48), '2 días');
  assert.equal(duracionLegible(null), null);
});

test('8 · qué leads cuentan: los que llegan solos (y los viejos sin origen); nunca los cargados, importados, de prueba o de un grupo', () => {
  for (const o of [null, '', 'instant_form', 'landing', 'calendly', 'instagram', 'chat_whatsapp']) assert.ok(cuentaParaPrimerContacto(o), String(o));
  for (const o of ['carga_manual', 'importacion', 'prueba', 'grupo_whatsapp', 'origen_que_no_existe']) assert.ok(!cuentaParaPrimerContacto(o), o);
});

test('9 · una fecha de entrada que no se puede leer no inventa nada', () => {
  assert.equal(primerContacto(Number.NaN, [wa(5, false)], AHORA).estado, 'no_se_sabe');
});

test('10 · los que más esperaron: los sin contactar pasada la hora y los contactados, por cuánto esperaron', () => {
  const lista = [
    { id: 1, nombre: 'Ana', pc: primerContacto(ENTRO, [wa(30, false)], AHORA) },
    { id: 2, nombre: null, pc: primerContacto(ENTRO, [], AHORA) },
    { id: 3, nombre: 'Beto', pc: primerContacto(ENTRO, [wa(60 * 50, false)], AHORA) },
    { id: 4, nombre: 'Caro', pc: primerContacto(ENTRO, [], min(20)) }, // a tiempo: no
    { id: 5, nombre: 'Dani', pc: primerContacto(ENTRO, [wa(2, null)], AHORA) }, // no se sabe: no
  ];
  assert.deepEqual(losQueMasEsperaron(lista, 3).map((x) => [x.id, x.nombre, x.estado]), [
    [2, 'Lead #2', 'sin_contactar'], [3, 'Beto', 'contactado'], [1, 'Ana', 'contactado'],
  ]);
});
