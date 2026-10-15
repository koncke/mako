// =============================================================================
// Un mensaje que espera (un reintento, un borrador, el anti-ban) vuelve a pasar por la CONDICIÓN de arriba (14/10/2026)
// =============================================================================
// §2.2 de docs/diseno-mako-nada-por-detras.md. La guarda escondida «la reunión ya pasó» existía porque un mensaje que no
// salía quedaba PARADO en el mensaje y la condición de arriba no se volvía a mirar (el caso del 25/09: con la línea
// caída, el reintento empujó la preparación hasta después de la reunión). Para borrarla (Martín, 14/10: «jamás que
// "mako" haga cosas que no están en el flujo»), antes de mandar se vuelve a evaluar la condición que está JUSTO arriba:
// `condicionDeArriba` + `condicionSigueLlevando` (lib/nutricion-grafo-motor.ts), y `procesarEnvios` cierra el camino si
// ya no lleva al mensaje.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `condicionDeArriba` aceptando cualquier padre (también una espera)                → 3 / 1
//   R2 `condicionSigueLlevando` sin mirar las flechas en paralelo del resultado          → 3 / 1
//   R3 `procesarEnvios` sin la re-evaluación (el bloque del §2.2)                         → 3 / 1
//
// Correr: node --import tsx --test tests/motor-reintento-condicion.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizar, indicePorId, type PasoGrafo, type HechosLead } from '../lib/flujo-grafo';
import { condicionDeArriba, condicionSigueLlevando } from '../lib/nutricion-grafo-motor';

const msg = (id: string, siguiente: string | null = null): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo: id, siguiente, delay_horas: 0 });
const H = (o: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.parse('2026-10-14T12:00:00Z'), ...o,
});

// DELAY → CONDICIÓN «ya le escribiste» → (sí) m_si · (si no) m_no, y una flecha en paralelo del «sí» a m_par.
const F = normalizar([
  { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 }, siguiente: 'c' },
  { id: 'c', nodo: 'condicion', ramas: [{ id: 'si', siguiente: 'm_si', paralelos: ['m_par'], filas: [{ campo: 'ya_contactado' }], modo: 'todas' }], si_no: 'm_no' },
  msg('m_si'), msg('m_no'), msg('m_par'),
  msg('m_suelto_tras_espera'),
] as PasoGrafo[]);
const I = (id: string) => indicePorId(F, id);

test('la condición de arriba es la que está JUSTO arriba (una espera no cuenta)', () => {
  assert.equal(condicionDeArriba(F, I('m_si')), I('c'));
  assert.equal(condicionDeArriba(F, I('m_par')), I('c'));
  assert.equal(condicionDeArriba(F, I('c')), null, 'la condición cuelga de una espera');
});

test('re-evaluada con los hechos de ahora: si ya no lleva al mensaje, ese camino termina', () => {
  assert.equal(condicionSigueLlevando(F, I('c'), I('m_si'), H({ yaContactado: true })), true);
  assert.equal(condicionSigueLlevando(F, I('c'), I('m_si'), H({ yaContactado: false })), false, 'cambió: ahora va por el «si no»');
  assert.equal(condicionSigueLlevando(F, I('c'), I('m_no'), H({ yaContactado: false })), true);
});

test('las flechas en paralelo del resultado elegido también cuentan', () => {
  assert.equal(condicionSigueLlevando(F, I('c'), I('m_par'), H({ yaContactado: true })), true);
  assert.equal(condicionSigueLlevando(F, I('c'), I('m_par'), H({ yaContactado: false })), false);
});

const MOTOR = readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('el motor la vuelve a preguntar ANTES de mandar, sólo si despertó parado en un mensaje, y cierra el camino con rastro', () => {
  const ini = MOTOR.indexOf('if (!esNodoDeControl(pasoLeido)) {\n        const idxCond = condicionDeArriba(sec.pasos, insc.paso_actual);');
  assert.ok(ini > 0, 'falta la re-evaluación de la condición de arriba en procesarEnvios');
  const trozo = MOTOR.slice(ini, ini + 1600);
  assert.match(trozo, /condicionSigueLlevando\(sec\.pasos, idxCond, insc\.paso_actual, hechos\)/);
  assert.match(trozo, /alcance: 'hilo'/);
  assert.match(trozo, /anotarCierreSinEnvio\(insc, ahora, lead, 'la condición de arriba ya no lleva a este mensaje'\)/);
  // Antes de las guardas del mensaje (la de la reunión, el anti-ban…): está arriba de `const paso = sec.pasos[insc.paso_actual];`.
  assert.ok(ini < MOTOR.indexOf('const paso = sec.pasos[insc.paso_actual];'));
});
