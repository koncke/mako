// =============================================================================
// MaKo recomienda (26/10/2026): las tres condiciones de una recomendación, y que sin nada que decir no dice nada
// =============================================================================
// Martín (26/10/2026): «estas recomendaciones y MaKo "pensando" deben ser reales, no le presetees que cada ratito debe de
// hacer recomendaciones basura para cumplir con su "cuota"». El motor: lib/recomendaciones-reglas.ts; el diseño:
// docs/diseno-mako-recomienda.md. Lo que se fija acá:
//   (a) sin un dato que la sostenga (umbral y muestra), no hay recomendación;
//   (b) dice qué hacer y qué cambia, y el porqué lo escribe el código (la IA no puede inventar el número);
//   (c) lo descartado no vuelve, lo de «Ahora no» vuelve sólo si sigue siendo cierto, lo aceptado vuelve como seguimiento;
//   y aprende: dos «No aplica» de un tipo lo apagan, y lo que acepta pesa más en el orden.
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_AHORA_NO, DIAS_HECHA, MAX_BYTES_MEMORIA, MAX_DECISIONES, MAX_MOTIVO, anotarDecision, claveDe, decisionVigente, elegirSinIA, esGenerico, estadoDe, funcionaron, huellaDe,
  leerMemoria, leerRedaccion, memoriaVacia, numerosAjenos, numerosDe, pedidoAlAsesor, pesoAprendido, senalesQueHablan, sostiene,
  tipoApagado, type MemoriaRecs, type Senal,
} from '../lib/recomendaciones-reglas';

const AHORA = new Date('2026-10-26T12:00:00Z');
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 86_400_000).toISOString();

const senal = (x: Partial<Senal> = {}): Senal => ({
  tipo: 'respuesta-lenta', objeto: 'negocio', superficies: ['ops-center', 'whatsapp'],
  dato: '14 de 37 personas que te escribieron esperaron más de un día tu primera respuesta',
  valor: 14 / 37, umbral: 0.2, sentido: 'mayor', n: 37, nMinimo: 10, fuente: 'tus conversaciones de WhatsApp de los últimos 14 días',
  impacto: 0.9, hacer: 'Contesta primero a los que esperan', cambia: 'Más conversaciones llegan a una llamada', ...x,
});

const decidir = (m: MemoriaRecs, s: Senal, d: 'hecha' | 'ahora-no' | 'no-aplica' | 'reabierta', dias: number, motivo?: string) =>
  anotarDecision(m, { clave: claveDe(s), tipo: s.tipo, superficie: 'ops-center', d, en: haceDias(dias), valor: s.valor, ...(motivo ? { motivo } : {}) });

test('(a) sin un dato que la sostenga no hay recomendación: umbral, sentido y muestra', () => {
  assert.equal(sostiene(senal()), true);
  assert.equal(sostiene(senal({ valor: 0.1 })), false, 'debajo del umbral, calla');
  assert.equal(sostiene(senal({ n: 9 })), false, 'con una muestra chica, calla');
  assert.equal(sostiene(senal({ nMinimo: 0, n: 0 })), false, 'un mínimo de 0 no es un mínimo');
  assert.equal(sostiene(senal({ sentido: 'menor', valor: 0.01, umbral: 0.02 })), true, 'una tasa que se cae: menor o igual al umbral');
  assert.equal(sostiene(senal({ sentido: 'menor', valor: 0.05, umbral: 0.02 })), false);
  assert.equal(sostiene(senal({ valor: Number.NaN })), false, 'un NaN no sostiene nada');
});

test('sin nada que decir, nada: ninguna cuota ni relleno', () => {
  assert.deepEqual(elegirSinIA([], memoriaVacia(), 'ops-center', AHORA), []);
  assert.deepEqual(elegirSinIA([senal({ valor: 0 })], memoriaVacia(), 'ops-center', AHORA), [], 'una señal que no se sostiene no rellena');
  assert.deepEqual(elegirSinIA([senal()], memoriaVacia(), 'offer', AHORA), [], 'una señal de otra superficie no aparece acá');
});

test('(b) cada recomendación dice qué hacer, qué cambia y el porqué con el número, escrito por el código', () => {
  const [r] = elegirSinIA([senal()], memoriaVacia(), 'ops-center', AHORA);
  assert.equal(r.hacer, 'Contesta primero a los que esperan');
  assert.equal(r.cambia, 'Más conversaciones llegan a una llamada');
  assert.deepEqual(r.porque, ['14 de 37 personas que te escribieron esperaron más de un día tu primera respuesta']);
  assert.equal(r.origen, 'regla');
  assert.equal(r.clave, 'respuesta-lenta|negocio');
});

test('(c) «No aplica» no vuelve nunca; «Ahora no» vuelve pasado el plazo y sólo si sigue siendo cierto', () => {
  const s = senal();
  assert.equal(estadoDe(decidir(memoriaVacia(), s, 'no-aplica', 400), s, AHORA).ve, false, 'no aplica: ni 400 días después');
  assert.equal(estadoDe(decidir(memoriaVacia(), s, 'ahora-no', DIAS_AHORA_NO - 1), s, AHORA).ve, false);
  assert.equal(estadoDe(decidir(memoriaVacia(), s, 'ahora-no', DIAS_AHORA_NO + 1), s, AHORA).ve, true);
  const pasada = decidir(memoriaVacia(), s, 'ahora-no', DIAS_AHORA_NO + 1);
  assert.deepEqual(elegirSinIA([senal({ valor: 0.05 })], pasada, 'ops-center', AHORA), [], 'si dejó de ser cierto, no vuelve');
});

test('(c) «Hecha» calla mientras se nota; después, si sigue igual, vuelve como seguimiento; si mejoró, «funcionó»', () => {
  const s = senal();
  assert.equal(estadoDe(decidir(memoriaVacia(), s, 'hecha', DIAS_HECHA - 1), s, AHORA).ve, false);
  const m = decidir(memoriaVacia(), s, 'hecha', DIAS_HECHA + 2);
  const [r] = elegirSinIA([s], m, 'ops-center', AHORA);
  assert.ok(r.seguimiento, 'vuelve diciendo que ya se aceptó');
  assert.equal(r.seguimiento!.aceptadaEl, haceDias(DIAS_HECHA + 2));
  const medido = new Set(['respuesta-lenta']);
  assert.deepEqual(funcionaron(m, [s], AHORA, medido), [], 'sigue igual: no funcionó todavía');
  const mejoro = funcionaron(m, [senal({ valor: 0.05 })], AHORA, medido);
  assert.equal(mejoro.length, 1);
  assert.equal(mejoro[0].clave, 'respuesta-lenta|negocio');
});

test('12. «Lo que mejoró» sólo con lo que se MIDIÓ: otra pantalla, una fuente caída o una muestra chica no son una mejora', () => {
  const s = senal();
  const m = decidir(memoriaVacia(), s, 'hecha', DIAS_HECHA + 2);
  // La señal no está en esta lectura porque esta pantalla no lee WhatsApp (o su lectura falló): no se afirma nada.
  assert.deepEqual(funcionaron(m, [], AHORA, new Set(['no-show-alto'])), [], 'otra pantalla: lo que no se leyó no «mejoró»');
  assert.deepEqual(funcionaron(m, [], AHORA), [], 'sin decir qué se midió, ninguna mejora');
  // Con la muestra debajo del mínimo, la señal no se sostiene por FALTA de datos, no porque haya bajado.
  assert.deepEqual(funcionaron(m, [senal({ n: 3 })], AHORA, new Set(['respuesta-lenta'])), [], 'poca muestra no es «mejoró»');
});

test('16. una clave REABIERTA se ve aunque su tipo siga apagado por otras «No aplica»', () => {
  const tipo = 'landing-no-convierte';
  const [a, b, c] = ['landing:a', 'landing:b', 'landing:c'].map((objeto) => senal({ tipo, objeto }));
  let m = decidir(decidir(decidir(memoriaVacia(), a, 'no-aplica', 5), b, 'no-aplica', 4), c, 'no-aplica', 3);
  assert.equal(tipoApagado(m, tipo), true);
  m = decidir(m, a, 'reabierta', 1);
  assert.equal(estadoDe(m, a, AHORA).ve, true, 'la reabierta quedaba escondida (y fuera de «Descartadas»)');
  assert.equal(estadoDe(m, b, AHORA).ve, false, 'las otras del tipo siguen calladas');
});

test('15. repetir una decisión que SIGUE vigente no es nuevo; pasado su plazo, sí', () => {
  const s = senal();
  const fila = (d: 'hecha' | 'ahora-no' | 'no-aplica', dias: number) => decidir(memoriaVacia(), s, d, dias).decisiones[0];
  assert.equal(decisionVigente(fila('no-aplica', 400), 'no-aplica', AHORA), true);
  assert.equal(decisionVigente(fila('ahora-no', DIAS_AHORA_NO - 1), 'ahora-no', AHORA), true);
  assert.equal(decisionVigente(fila('ahora-no', DIAS_AHORA_NO + 1), 'ahora-no', AHORA), false, 'volvió: callarla otra vez es nuevo');
  assert.equal(decisionVigente(fila('hecha', DIAS_HECHA + 1), 'hecha', AHORA), false, 'volvió como seguimiento: aceptarla otra vez es nuevo');
  assert.equal(decisionVigente(fila('ahora-no', 1), 'no-aplica', AHORA), false, 'otra decisión, sí se anota');
  assert.equal(decisionVigente(null, 'ahora-no', AHORA), false);
});

test('10. la memoria tiene tope en BYTES además de en filas, y se van las más viejas', () => {
  let m = memoriaVacia();
  const largo = 'x'.repeat(MAX_MOTIVO);
  for (let i = 0; i < 260; i++) m = decidir(m, senal({ objeto: `o${i}` }), 'ahora-no', 1, largo);
  assert.ok(JSON.stringify(m).length <= MAX_BYTES_MEMORIA, `la memoria pesa ${JSON.stringify(m).length} bytes`);
  assert.equal(m.decisiones[m.decisiones.length - 1].clave, 'respuesta-lenta|o259', 'la más nueva queda');
});

test('aprende: dos «No aplica» de un tipo lo apagan; una aceptada lo salva; lo aceptado pesa más en el orden', () => {
  const a = senal({ objeto: 'automatizacion:1', tipo: 'automatizacion-con-errores' });
  const b = senal({ objeto: 'automatizacion:2', tipo: 'automatizacion-con-errores' });
  const c = senal({ objeto: 'automatizacion:3', tipo: 'automatizacion-con-errores' });
  const dos = decidir(decidir(memoriaVacia(), a, 'no-aplica', 3), b, 'no-aplica', 2);
  assert.equal(tipoApagado(dos, 'automatizacion-con-errores'), true);
  assert.deepEqual(elegirSinIA([c], dos, 'ops-center', AHORA), [], 'el tercero del mismo tipo ya no aparece');
  assert.equal(tipoApagado(decidir(memoriaVacia(), a, 'no-aplica', 3), 'automatizacion-con-errores'), false, 'uno solo no apaga');
  assert.equal(tipoApagado(decidir(dos, c, 'hecha', 1), 'automatizacion-con-errores'), false, 'una aceptada lo salva');
  assert.equal(pesoAprendido(memoriaVacia(), 'x'), 0.5);
  const x = senal({ tipo: 'x', objeto: 'negocio', impacto: 0.6 });
  const y = senal({ tipo: 'y', objeto: 'negocio', impacto: 0.6 });
  const aprendio = decidir(decidir(memoriaVacia(), senal({ tipo: 'y', objeto: 'otro' }), 'hecha', 20), senal({ tipo: 'x', objeto: 'otro' }), 'ahora-no', 20);
  assert.deepEqual(senalesQueHablan([x, y], aprendio, 'ops-center', AHORA).map((o) => o.s.tipo), ['y', 'x'], 'el tipo aceptado va primero');
});

test('la memoria: una fila rota no borra las demás, y tiene tope', () => {
  const crudo = JSON.stringify({ v: 1, decisiones: [
    { clave: 'a|negocio', tipo: 'a', superficie: 'ops-center', d: 'hecha', en: haceDias(1), valor: 2 },
    { clave: 'b|negocio', tipo: 'b', superficie: 'marte', d: 'hecha', en: haceDias(1), valor: 2 },
    { clave: 'c|negocio', tipo: 'c', superficie: 'offer', d: 'quizas', en: haceDias(1) },
    null,
  ] });
  assert.equal(leerMemoria(crudo).decisiones.length, 1);
  assert.deepEqual(leerMemoria('{roto'), memoriaVacia());
  let m = memoriaVacia();
  for (let i = 0; i < MAX_DECISIONES + 5; i++) m = decidir(m, senal({ objeto: `o${i}` }), 'ahora-no', 1);
  assert.equal(m.decisiones.length, MAX_DECISIONES);
  assert.equal(m.decisiones[m.decisiones.length - 1].clave, `respuesta-lenta|o${MAX_DECISIONES + 4}`, 'se quedan las más nuevas');
});

test('la IA redacta y el código decide qué se acepta: cita señales que existen, sin números inventados ni genéricos', () => {
  const habla = senalesQueHablan([senal(), senal({ tipo: 'leads-sin-seguimiento', objeto: 'negocio', dato: '23 leads de Agendó llevan 9 días sin ningún mensaje', valor: 23, umbral: 10, n: 23, superficies: ['ops-center'] })], memoriaVacia(), 'ops-center', AHORA);
  const { user } = pedidoAlAsesor({ superficie: 'ops-center', senales: habla, contexto: { negocio: 'Vende un curso de 497 USD', extras: [] }, memoria: memoriaVacia() });
  const dossier = user;
  const leer = (o: unknown) => leerRedaccion(JSON.stringify(o), { superficie: 'ops-center', senales: habla, dossier });
  const bien = leer({ recomendaciones: [{ senales: ['S1', 'S2'], hacer: 'Contesta hoy a los 14 que esperan y escríbeles a los 23 de Agendó', cambia: 'Recuperas conversaciones de un curso de 497 USD' }] });
  assert.ok(bien.ok);
  if (!bien.ok) return;
  assert.equal(bien.recs.length, 1);
  assert.equal(bien.recs[0].origen, 'ia');
  assert.deepEqual(bien.recs[0].claves, ['respuesta-lenta|negocio', 'leads-sin-seguimiento|negocio'], '14: guarda TODAS las claves que la sostienen');
  assert.equal(bien.recs[0].porque.length, 2, 'el porqué junta los datos de las dos señales, escritos por el código');
  const inventa = leer({ recomendaciones: [{ senales: ['S1'], hacer: 'Contesta en menos de 5 minutos', cambia: 'Tu cierre sube un 391 %' }] });
  assert.ok(inventa.ok && inventa.recs.length === 0, 'un número que no está en los datos no pasa');
  const fantasma = leer({ recomendaciones: [{ senales: ['S9'], hacer: 'Contesta a los que esperan', cambia: 'Más ventas' }] });
  assert.ok(fantasma.ok && fantasma.recs.length === 0, 'una señal que no existe no sostiene nada');
  const generico = leer({ recomendaciones: [{ senales: ['S1'], hacer: 'Mejora tu marketing y sé constante', cambia: 'Más ventas' }] });
  assert.ok(generico.ok && generico.recs.length === 0, 'un consejo de manual no pasa');
  const dosVeces = leer({ recomendaciones: [{ senales: ['S1'], hacer: 'Contesta a los que esperan', cambia: 'Más ventas' }, { senales: ['S1'], hacer: 'Contesta antes', cambia: 'Más ventas' }] });
  assert.ok(dosVeces.ok && dosVeces.recs.length === 1, 'la misma señal no sostiene dos');
  const nada = leer({ recomendaciones: [] });
  assert.ok(nada.ok && nada.recs.length === 0, 'la IA puede decidir que no hay nada: se respeta');
  assert.equal(leerRedaccion('no es json', { superficie: 'ops-center', senales: habla, dossier }).ok, false);
});

test('los números: miles, decimales y porcentajes se leen igual de los dos lados', () => {
  assert.deepEqual(numerosDe('1.200 visitas, 35 % y 2,5 días'), [1200, 35, 2.5]);
  assert.deepEqual(numerosAjenos('Llegas a 1200 visitas', 'tuviste 1.200 visitas'), []);
  assert.deepEqual(numerosAjenos('2 mensajes más', 'nada'), [], 'los chicos son palabras, no datos');
  assert.deepEqual(numerosAjenos('sube al 40 %', 'está en 35 %'), [40]);
  assert.equal(esGenerico('Mejora tu estrategia de marketing'), true);
  assert.equal(esGenerico('Agrega un recordatorio 2 horas antes de la llamada en «Agendó»'), false);
});

test('lo que lee la IA no lleva lo que descartó sin su motivo, y la huella cambia con una decisión nueva', () => {
  const s = senal();
  const m = decidir(memoriaVacia(), senal({ tipo: 'landing-sin-conversion', objeto: 'landing:x' }), 'no-aplica', 1, 'esa landing es de prueba');
  const habla = senalesQueHablan([s], m, 'ops-center', AHORA);
  const { user } = pedidoAlAsesor({ superficie: 'ops-center', senales: habla, contexto: { negocio: '', extras: [] }, memoria: m });
  assert.match(user, /esa landing es de prueba/);
  assert.notEqual(huellaDe('ops-center', habla, memoriaVacia()), huellaDe('ops-center', habla, m));
});

// ── Probado rompiéndolo (26/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio se hizo a mano en lib/recomendaciones-reglas.ts, se corrió este archivo y se restauró de memoria:
//   1. `sostiene` sin el chequeo de `n >= nMinimo`               → rojo «(a) … con una muestra chica, calla».
//   2. `sentido === 'mayor' ? valor <= umbral : …` (invertido)  → rojo «(a)» y «sin nada que decir».
//   3. `estadoDe` con «no-aplica» → `{ ve: true }`               → rojo «(c) «No aplica» no vuelve nunca».
//   4. `estadoDe` con «hecha» sin `seguimiento`                  → rojo «(c) «Hecha» … seguimiento».
//   5. `tipoApagado` sin la excepción de una aceptada            → rojo «aprende … una aceptada lo salva».
//   6. `leerRedaccion` sin `numerosAjenos`                       → rojo «la IA redacta … número que no está».
//   7. `leerRedaccion` sin `usadas`                              → rojo «la misma señal no sostiene dos».
//   8. `numerosDe` sin el caso de miles                          → rojo «los números».
//   9. `estadoDe` con «ahora-no» → siempre `{ ve: true }`         → rojo «(c) «No aplica» no vuelve nunca; «Ahora no»…».
//  10. `leerRedaccion` sin `esGenerico`                          → rojo «la IA redacta…».
// También se invirtió la condición entera de `sostiene` (sentido al revés): rojos en 7 de los 10 tests.
// Después de la revisión del tren-l (26/10/2026), ocho más, con el mismo arnés:
//  11. `funcionaron` sin `tiposMedidos`                          → rojo «12.».
//  12. `funcionaron` sin el caso de la muestra chica             → rojo «12.».
//  13. `estadoDe` mirando el tipo apagado ANTES que la reabierta → rojo «16.».
//  14. `decisionVigente` siempre false                           → rojo «15.».
//  15. `decisionVigente` con «Ahora no» vigente para siempre      → rojo «15.».
//  16. `anotarDecision` sin el tope en bytes                     → rojo «10.».
//  17. el tope en bytes tirando las NUEVAS (`slice(0, -1)`)       → rojo «10.».
//  18. `leerRedaccion` guardando sólo la clave principal          → rojo «la IA redacta…» (14).
