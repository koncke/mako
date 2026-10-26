// =============================================================================
// MaKo recomienda (26/10/2026): lo que se MIDE para recomendar, con datos armados (ninguno real)
// =============================================================================
// lib/recomendaciones-senales.ts. Lo que se fija acá, señal por señal:
//   · cada una habla sólo con su muestra mínima y su umbral, y el número del `dato` es el que se midió;
//   · las conversaciones son PERSONAS con un lead (ni grupos, ni el WhatsApp personal del dueño), y «gracias» no espera respuesta;
//   · el `dato` no lleva el nombre ni el texto de una persona (sale por la API y lo lee la IA del negocio);
//   · lo que no se pudo medir no afirma nada (sin oferta, no hay «tu oferta no lo contesta»; sin registros, no hay conversión).
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sostiene } from '../lib/recomendaciones-reglas';
import {
  UMBRALES, errorLimpio, noPideRespuesta, senalEsperando, senalMotivoPerdida, senalNoShow, senalRespuestaLenta, senalSecondBrainSinAprender,
  senalesDeAutomatizaciones, senalesDeLandings, senalesDeObjeciones, type LeadSenal, type MensajeSenal,
} from '../lib/recomendaciones-senales';

const AHORA = new Date('2026-10-26T12:00:00Z');
const H = 3_600_000, D = 24 * H;
const iso = (msAtras: number) => new Date(AHORA.getTime() - msAtras).toISOString();
const DESDE = new Date(AHORA.getTime() - 21 * D);

let n = 0;
/** Una conversación nueva de un lead: escribe hace `hace` y se le contesta `respuesta` después (null = nunca). */
function charla(hace: number, respuesta: number | null, lead: number | null = ++n, jid = `54911${1000 + n}@s.whatsapp.net`): MensajeSenal[] {
  const out: MensajeSenal[] = [{ chat_jid: jid, wa_timestamp: iso(hace), from_me: false, lead_id: lead, tipo: 'text', texto: 'hola, quiero info' }];
  if (respuesta != null) out.push({ chat_jid: jid, wa_timestamp: iso(hace - respuesta), from_me: true, lead_id: lead, tipo: 'text', texto: 'hola! te cuento' });
  return out;
}

test('respuesta lenta: cuenta las conversaciones NUEVAS de leads, con el umbral y la muestra', () => {
  const msgs = [
    ...Array.from({ length: 6 }, () => charla(5 * D, 3 * H)).flat(),        // esperaron 3 horas
    ...Array.from({ length: 6 }, () => charla(5 * D, 10 * 60_000)).flat(),  // 10 minutos
  ];
  const s = senalRespuestaLenta(msgs, AHORA, DESDE)!;
  assert.ok(s);
  assert.equal(s.n, 12);
  assert.equal(s.valor, 6 / 12);
  assert.match(s.dato, /^6 de 12 personas/);
  assert.equal(sostiene(s), true);
  // Un grupo y una charla sin lead (el WhatsApp personal del dueño) no cuentan.
  const ruido = [...charla(5 * D, null, 999, '1203630000@g.us'), ...charla(5 * D, null, null, '5491199999@s.whatsapp.net')];
  assert.equal(senalRespuestaLenta([...msgs, ...ruido], AHORA, DESDE)!.n, 12);
  // Una que empezó hace 20 minutos todavía está a tiempo.
  assert.equal(senalRespuestaLenta([...msgs, ...charla(20 * 60_000, null)], AHORA, DESDE)!.n, 12);
  // Con la lectura cortada por el tope (empezó hace 6 días), una conversación de hace 5,5 días puede tener historia antes de lo
  // leído: no se cuenta como nueva.
  assert.equal(senalRespuestaLenta([...msgs, ...charla(5.5 * D, null)], AHORA, new Date(AHORA.getTime() - 6 * D))!.n, 12);
  // Con menos de la muestra mínima, la señal existe pero no sostiene nada (las 4 primeras conversaciones: 8 mensajes).
  assert.equal(sostiene(senalRespuestaLenta(msgs.slice(0, 8), AHORA, DESDE)!), false);
});

test('respuesta lenta: compara a los que esperaron con los que no, sólo con la muestra de los dos lados', () => {
  const tardes = Array.from({ length: 6 }, () => charla(6 * D, 5 * H));
  const rapidas = Array.from({ length: 6 }, () => charla(6 * D, 5 * 60_000));
  const leadDe = (c: MensajeSenal[]) => c[0].lead_id!;
  const avanzo = new Set([leadDe(tardes[0]), ...rapidas.slice(0, 4).map(leadDe)]);
  const s = senalRespuestaLenta([...tardes.flat(), ...rapidas.flat()], AHORA, DESDE, avanzo)!;
  assert.match(s.dato, /De las que esperaron, avanzaron 1 de 6; de las que no, 4 de 6/);
  assert.match(s.cambia, /tu propio negocio/);
  // Sin `avanzo` no se afirma ninguna comparación.
  assert.doesNotMatch(senalRespuestaLenta([...tardes.flat(), ...rapidas.flat()], AHORA, DESDE)!.dato, /avanzaron/);
  // Con un lado chico (3 que esperaron), tampoco: 1 de 3 contra 4 de 6 no es una tendencia.
  assert.doesNotMatch(senalRespuestaLenta([...tardes.slice(0, 3).flat(), ...rapidas.flat()], AHORA, DESDE, avanzo)!.dato, /avanzaron/);
});

test('esperando respuesta: el último mensaje es de la persona, ni muy nuevo ni muerto, y «gracias» no espera nada', () => {
  const espera = (hace: number, texto = '¿y el precio?') => [{ chat_jid: `${hace}@s.whatsapp.net`, wa_timestamp: iso(hace), from_me: false, lead_id: 1, tipo: 'text', texto }];
  const msgs = [...espera(14 * H), ...espera(2 * D), ...espera(3 * D), ...espera(2 * H), ...espera(9 * D), ...espera(20 * H, '¡Gracias!'), ...espera(21 * H, '👍')];
  const s = senalEsperando(msgs, AHORA)!;
  assert.equal(s.n, 3, 'cuentan 14 h, 2 días y 3 días; no 2 h (todavía), 9 días (muerta), «gracias» ni un emoji');
  assert.match(s.dato, /3 personas te escribieron y siguen sin respuesta \(la que más espera, hace 3 días\)/);
  assert.equal(noPideRespuesta('ok gracias'), false, '«ok gracias» corre por la regla de una sola palabra: pide revisar a mano');
  assert.equal(noPideRespuesta('Perfecto!'), true);
  assert.equal(noPideRespuesta('¿Cuánto sale?'), false);
});

const lead = (x: Partial<LeadSenal>): LeadSenal => ({ junta_1_at: null, asistio_j1: null, estado_lead: 'abierto', motivo_perdida: null, created_at: iso(10 * D), ...x });

test('no-show: sobre las llamadas MARCADAS (lo sin marcar no cuenta), de las últimas semanas', () => {
  const leads = [
    ...Array.from({ length: 4 }, () => lead({ junta_1_at: iso(3 * D), asistio_j1: false })),
    ...Array.from({ length: 6 }, () => lead({ junta_1_at: iso(3 * D), asistio_j1: true })),
    ...Array.from({ length: 5 }, () => lead({ junta_1_at: iso(3 * D), asistio_j1: null })),
    lead({ junta_1_at: iso(90 * D), asistio_j1: false }),
    lead({ junta_1_at: iso(-2 * D), asistio_j1: null }),
  ];
  const s = senalNoShow(leads, AHORA)!;
  assert.equal(s.n, 10);
  assert.match(s.dato, /De 10 llamadas de los últimos 45 días, 4 no se presentaron \(40 %\)/);
  assert.equal(sostiene(s), true);
});

test('motivo de pérdida: agrupa sin mayúsculas ni acentos, y necesita repetirse', () => {
  const perdido = (m: string) => lead({ estado_lead: 'perdido', motivo_perdida: m });
  const leads = [perdido('Precio'), perdido('precio'), perdido('PRECIO!'), perdido('No tiene tiempo'), perdido('Lo pensará'), perdido('competencia'), perdido('precío')];
  const s = senalMotivoPerdida(leads, AHORA)!;
  assert.match(s.dato, /De 7 ventas perdidas con motivo en los últimos 120 días, 4 fueron por «Precio» \(57 %\)/);
  assert.equal(s.objeto, 'motivo:precio');
  assert.equal(senalMotivoPerdida([perdido('Precio'), perdido('precio'), perdido('tiempo')], AHORA), null, 'dos veces no es un patrón');
});

test('automatizaciones: falla al mandar (con el motivo sin teléfonos) y nadie contesta (sólo si espera respuesta)', () => {
  const secs = [
    { id: 1, nombre: 'Bienvenida', activa: true, esperaRespuesta: true },
    { id: 2, nombre: 'Recordatorio', activa: true, esperaRespuesta: false },
    { id: 3, nombre: 'Vieja', activa: false, esperaRespuesta: true },
  ];
  const envio = (sec: number, estado: string, error: string | null = null) => ({ secuencia_id: sec, estado, error, created_at: iso(2 * D) });
  const envios = [
    ...Array.from({ length: 6 }, () => envio(1, 'fallo', 'El número +54 9 11 5555-1234 no tiene WhatsApp')),
    ...Array.from({ length: 14 }, () => envio(1, 'enviado')),
    ...Array.from({ length: 30 }, () => envio(3, 'fallo', 'x')),
  ];
  const insc = [
    ...Array.from({ length: 30 }, () => ({ secuencia_id: 2, estado: 'completada', inscripto_at: iso(5 * D) })),
    ...Array.from({ length: 29 }, () => ({ secuencia_id: 1, estado: 'completada', inscripto_at: iso(5 * D) })),
    { secuencia_id: 1, estado: 'respondio', inscripto_at: iso(5 * D) },
  ];
  const ss = senalesDeAutomatizaciones(secs, envios, insc, AHORA);
  const falla = ss.find((s) => s.tipo === 'automatizacion-falla')!;
  assert.match(falla.dato, /«Bienvenida» falló en 6 de 20 envíos/);
  assert.doesNotMatch(falla.dato, /5555|1234/, 'el teléfono del lead no viaja en el dato');
  assert.equal(ss.filter((s) => s.objeto === 'automatizacion:3').length, 0, 'una pausada no habla');
  const muda = ss.find((s) => s.tipo === 'automatizacion-muda')!;
  assert.equal(muda.objeto, 'automatizacion:1');
  assert.match(muda.dato, /De 30 personas que entraron a «Bienvenida» en 30 días, respondieron 1 \(3 %\)/);
  assert.equal(sostiene(muda), true);
  assert.ok(!ss.some((s) => s.tipo === 'automatizacion-muda' && s.objeto === 'automatizacion:2'), 'un recordatorio no espera respuesta');
  assert.equal(errorLimpio('falló 4b1f8e9c2d3a4b5c6d7e8f90 en +54 11 4444-5555'), 'falló … en …');
});

test('landings: sin registros contados no hay conversión, y sin scroll medido no hay profundidad', () => {
  const ss = senalesDeLandings([
    { url: 'https://negocio.com/curso', visitantes: 640, dias: 30, registros: 3, scroll: { base: 300, mitad: 45 } },
    { url: 'https://negocio.com/otra', visitantes: 640, dias: 30, registros: null, scroll: null },
  ]);
  assert.equal(ss.length, 2);
  assert.match(ss[0].dato, /«\/curso» tuvo 640 visitantes en 30 días y 3 dejaron sus datos \(0,5 %\)/);
  assert.equal(sostiene(ss[0]), true);
  assert.match(ss[1].dato, /de 300 personas con scroll medido sólo 45 llegaron a la mitad de la página \(15 %\)/);
  assert.ok(!ss.some((s) => s.objeto === 'landing:https://negocio.com/otra'));
});

test('objeciones: lo que dice la gente y la oferta no contesta; sin oferta no se afirma nada', () => {
  const hechos = [['Preguntó si se puede pagar en cuotas'], ['Dice que es caro para ella'], ['Quiere empezar en enero'], ['Pidió el precio en pesos'], ['Pregunta por el horario']];
  const sinCuotas = senalesDeObjeciones(hechos, ['precio'], 'Curso de 497 USD. Garantía de 7 días.');
  const precio = sinCuotas.find((s) => s.objeto === 'objecion:precio')!;
  assert.ok(precio);
  assert.match(precio.dato, /3 de 5 conversaciones y 1 de 1 ventas perdidas hablan de el precio o la forma de pago, y tu oferta no lo contesta/);
  assert.ok(!sinCuotas.some((s) => s.objeto === 'objecion:confianza'), 'con garantía, la confianza no sale (y además nadie la pidió)');
  assert.equal(senalesDeObjeciones(hechos, ['precio'], 'Curso de 497 USD, en 3 cuotas sin interés').find((s) => s.objeto === 'objecion:precio'), undefined, 'si la oferta lo contesta, calla');
  assert.deepEqual(senalesDeObjeciones(hechos, ['precio'], null), [], 'sin oferta no se dice «no lo contesta»');
});

test('Second Brain: «Aprende solo» apagado con conversaciones de las que aprender, y sólo si el negocio tiene su IA', () => {
  assert.equal(sostiene(senalSecondBrainSinAprender({ prendido: false, conIA: true, conversaciones: 40 })!), true);
  assert.equal(senalSecondBrainSinAprender({ prendido: true, conIA: true, conversaciones: 40 }), null);
  assert.equal(senalSecondBrainSinAprender({ prendido: false, conIA: false, conversaciones: 40 }), null, 'sin su IA prenderlo no sirve: no se recomienda');
  assert.equal(sostiene(senalSecondBrainSinAprender({ prendido: false, conIA: true, conversaciones: UMBRALES.secondBrain.conversacionesMinimo - 1 })!), false);
});

// ── Probado rompiéndolo (26/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio se hizo a mano en lib/recomendaciones-senales.ts, se corrió este archivo y se restauró de memoria (el arnés de
// la sesión, romper.cjs, con la lista de casos al lado):
//   1. `conversaciones` sin el filtro de lead                   → rojo «respuesta lenta: cuenta las conversaciones NUEVAS…».
//   2. `senalRespuestaLenta` sin el borde de la lectura          → rojo «respuesta lenta: cuenta…».
//   3. `comparar` sin el mínimo de los dos grupos                → rojo «respuesta lenta: compara…».
//   4. `senalEsperando` sin `noPideRespuesta`                    → rojo «esperando respuesta…».
//   5. `senalNoShow` contando lo sin marcar como asistió         → rojo «no-show…».
//   6. `senalMotivoPerdida` sin `vecesMinimo`                    → rojo «motivo de pérdida…».
//   7. `errorLimpio` sin tapar el teléfono                       → rojo «automatizaciones…».
//   8. `senalesDeLandings` con `registros ?? 0`                  → rojo «landings…».
//   9. `senalesDeObjeciones` sin el corte de `textoOferta` null  → rojo «objeciones…».
//  10. `senalEsperando` sin el tope de días (lo viejo ya murió)  → rojo «esperando respuesta…».
// La primera pasada dejó VERDES las roturas 1, 2 y 3: el ruido sin lead caía en el número de otra conversación, la del borde
// de la lectura quedaba afuera de la ventana por la fecha y no por el borde, y la comparación nunca se probó con un lado chico.
// Se corrigió el test (no el código) y las diez dieron rojo.
