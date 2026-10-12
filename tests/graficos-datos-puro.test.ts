// Las cuentas de los lectores del Dashboard v5 que deciden un número (lib/graficos-datos-puro.ts): qué es un
// turno de una conversación, en qué tramo del video quedó un lead, cuánta gente llegó al llamado a la acción,
// de dónde viene una visita (sin la IP), qué envío se contestó. Los lectores son `server-only`; esto no.
// Correr: npx tsx --test tests/graficos-datos-puro.test.ts
//
// Probados rompiéndolos (12/10/2026, arnés que restaura de memoria), con la base en 0 fallos (11 tests):
//   · `diasEntre` sin el corte de negativos (devuelve d < 0)                 → 10 pass / 1 fail  («los tramos…»)
//   · el tramo 1 sin exigir `meta_lead_id`                                   → 10 pass / 1 fail  («los tramos…»)
//   · `tramoVisto` con el avance 0 metido en 0-25%                           → 10 pass / 1 fail  («tramo visto…»)
//   · `llegaronAlCta` sin forzar la monotonía                                → 10 pass / 1 fail  («llamado a la acción…»)
//   · `ubicacionDeHeaders` sin redondear las coordenadas                     → 10 pass / 1 fail  («la ubicación…»)
//   · `turnosDeChats` contando cada entrante (sin la racha)                  → 10 pass / 1 fail  («los turnos…»)
//   · `chatsEsperando` sin el filtro «con lead»                              → 10 pass / 1 fail  («esperando…»)
//   · `enviosRespondidos` marcando el PRIMER envío y no el último            → 10 pass / 1 fail  («envíos respondidos…»)
//   · `esSelloDelConstructor` con un /lovable/i suelto                       → 10 pass / 1 fail  («el sello…»)
//   · `gano` sin excluir los «sin cobro»                                     → 10 pass / 1 fail  («qué es una venta…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORTES_VSL, TRAMOS_CONTACTO, TRAMOS_VISTO, chatsEsperando, diasEntre, enviosRespondidos, esChatIndividual, esSelloDelConstructor,
  fraccionCta, gano, llegaronAlCta, regionIso, rotuloMadurez, rotuloSenal, rotuloUrgencia, tramoDeContacto, tramoVisto, tramosDelCiclo,
  turnosDeChats, ubicacionDeHeaders, type MensajeChat,
} from '../lib/graficos-datos-puro';

test('qué es una venta: cerró o está ganado, menos los «sin cobro»', () => {
  assert.equal(gano({ cerro: true, estado_lead: null, venta_tipo: null }), true);
  assert.equal(gano({ cerro: false, estado_lead: 'ganado', venta_tipo: 'unica' }), true);
  assert.equal(gano({ cerro: true, estado_lead: 'ganado', venta_tipo: 'sin_cobro' }), false);
  assert.equal(gano({ cerro: null, estado_lead: 'abierto', venta_tipo: null }), false);
});

test('los tramos del ciclo: la regla de _getTramosSCL (días ≥ 0, el primero sólo para los instant forms)', () => {
  assert.equal(diasEntre('2026-10-01', '2026-10-05'), 4);
  assert.equal(diasEntre('2026-10-05', '2026-10-01'), null, 'un pago antes de la agenda es un dato roto');
  assert.equal(diasEntre(null, '2026-10-01'), null);
  // created_at es un instante: se corta a su día UTC, como `dias(a.slice(0,10))` de queries.ts.
  assert.equal(diasEntre('2026-10-01T23:59:00.000Z', '2026-10-02'), 1);
  const lead = {
    created_at: '2026-09-01T10:00:00Z', meta_lead_id: null, fecha_agenda: '2026-09-03', fecha_junta_1: '2026-09-05',
    fecha_junta_2: '2026-09-10', fecha_confirmacion: '2026-09-09', fecha_primer_pago: '2026-09-20',
  };
  // Sin meta_lead_id no hay tramo 1; la confirmación ANTES de la R2 da negativo y no cuenta.
  assert.deepEqual(tramosDelCiclo(lead), [null, 2, 5, null, 11]);
  assert.deepEqual(tramosDelCiclo({ ...lead, meta_lead_id: 'ml1' })[0], 2);
});

test('la madurez, la señal y la urgencia se leen como palabras fijas', () => {
  assert.equal(rotuloMadurez('madura'), 'Madura');
  assert.equal(rotuloMadurez('madurando'), 'Madurando');
  assert.equal(rotuloMadurez(null), null);
  assert.deepEqual([rotuloSenal('atencion'), rotuloSenal('bien'), rotuloSenal(null)], ['Atención', 'Bien', 'Sin datos']);
  assert.equal(rotuloUrgencia('vencida', '2026-10-01'), 'Vencida');
  assert.equal(rotuloUrgencia('pronto', '2026-10-14'), 'Vence pronto');
  assert.equal(rotuloUrgencia(null, '2026-11-30'), 'Más adelante');
  assert.equal(rotuloUrgencia(null, null), 'Sin fecha');
});

test('tramo visto: «No lo vio» y «Sin medir» no son 0%', () => {
  assert.equal(tramoVisto(false, null), 'No lo vio');
  assert.equal(tramoVisto(true, null), 'Sin medir', 'le dio play y no dejó avance: no es el primer tramo');
  assert.equal(tramoVisto(true, 0), 'Sin medir');
  assert.equal(tramoVisto(true, 10), '0-25%');
  assert.equal(tramoVisto(true, 25), '25-50%');
  assert.equal(tramoVisto(true, 74.9), '50-75%');
  assert.equal(tramoVisto(true, 100), '75-100%');
  assert.equal(TRAMOS_VISTO.length, 6);
  assert.deepEqual([CORTES_VSL[0], CORTES_VSL[19], CORTES_VSL.length], ['5', '100', 20]);
});

test('el llamado a la acción: la interpolación de la curva de cuartiles, en PERSONAS y monótona', () => {
  // El último bloque arranca en el segundo 30 de un video de 40: el CTA está en el 75%.
  assert.equal(fraccionCta([{ t0: 0 }, { t0: 12 }, { t0: 30 }], 40), 0.75);
  // Sin duración: la de respaldo de getQuadrantData (el último t0 o 30, más 4).
  assert.equal(fraccionCta([{ t0: 0 }, { t0: 10 }], null), 10 / 34);
  const m = { v3s: 1000, thru: 300, p25: 600, p50: 400, p75: 250, p100: 100 };
  assert.equal(llegaronAlCta(m, 0.75), 250);
  assert.equal(llegaronAlCta(m, 0.625), 325, 'entre el 50% y el 75%');
  assert.equal(llegaronAlCta(m, 0), 1000);
  // Es la retención de la tab (pXX ÷ plays de 3 s) multiplicada por los plays: se puede SUMAR entre días.
  assert.equal(llegaronAlCta(m, 0.625) / m.v3s * 100, 32.5);
  // Un cuartil que sube (dato raro) no puede crear gente: la curva se fuerza no creciente, como la tab.
  assert.equal(llegaronAlCta({ ...m, p50: 700 }, 0.5), 600);
  // Sin cuartiles: la curva de dos puntos con los thruplays (el respaldo de retentionCurve).
  assert.equal(llegaronAlCta({ v3s: 100, thru: 20, p25: 0, p50: 0, p75: 0, p100: 0 }, 0.5), 60);
  assert.equal(llegaronAlCta({ v3s: 0, thru: 0, p25: 0, p50: 0, p75: 0, p100: 0 }, 0.5), 0);
});

test('la ubicación de una visita: de los headers de Vercel, redondeada, y NUNCA la IP', () => {
  const h: Record<string, string> = {
    'x-vercel-ip-country': 'mx', 'x-vercel-ip-country-region': 'BCN', 'x-vercel-ip-city': 'Tijuana%20Centro',
    'x-vercel-ip-latitude': '32.5149', 'x-vercel-ip-longitude': '-117.0382', 'x-forwarded-for': '200.1.2.3', 'x-real-ip': '200.1.2.3',
  };
  const u = ubicacionDeHeaders((n) => h[n] ?? null)!;
  assert.deepEqual(u, { pais: 'MX', region: 'BCN', ciudad: 'Tijuana Centro', lat: 32.5, lon: -117 });
  assert.ok(!JSON.stringify(u).includes('200.1.2.3'), 'la IP no viaja');
  assert.equal(regionIso(u.pais, u.region), 'MX-BCN');
  assert.equal(ubicacionDeHeaders(() => null), null, 'sin país no hay ubicación');
  assert.equal(ubicacionDeHeaders((n) => (n === 'x-vercel-ip-country' ? 'Mexico' : null)), null, 'un país que no es ISO-2 no entra');
  // Una coordenada sin la otra no ubica nada; una fuera de rango tampoco.
  assert.deepEqual(ubicacionDeHeaders((n) => ({ 'x-vercel-ip-country': 'AR', 'x-vercel-ip-latitude': '-34.6' } as Record<string, string>)[n] ?? null),
    { pais: 'AR', region: null, ciudad: null, lat: null, lon: null });
  assert.equal(ubicacionDeHeaders((n) => ({ 'x-vercel-ip-country': 'AR', 'x-vercel-ip-latitude': '-134.6', 'x-vercel-ip-longitude': '10' } as Record<string, string>)[n] ?? null)!.lat, null);
  // Una ciudad mal codificada no tira el beacon.
  assert.equal(ubicacionDeHeaders((n) => ({ 'x-vercel-ip-country': 'CO', 'x-vercel-ip-city': '%E0%A4%A' } as Record<string, string>)[n] ?? null)!.ciudad, null);
});

const msj = (chat: string, deMi: boolean, min: number, leadId: number | null = 7, linea = 'l1'): MensajeChat => ({ linea, chat, deMi, t: Date.UTC(2026, 9, 10, 12, 0) + min * 60_000, leadId });

test('los turnos de una conversación: el primer entrante de cada racha, y cuánto tardó la respuesta', () => {
  assert.ok(esChatIndividual('5215512345678@s.whatsapp.net'));
  assert.ok(esChatIndividual('32323940663334@lid'));
  assert.ok(!esChatIndividual('120363000000@g.us'), 'un grupo no es una persona esperando');
  assert.ok(!esChatIndividual('status@broadcast'));
  const t = turnosDeChats([
    msj('a@lid', false, 0), msj('a@lid', false, 2), msj('a@lid', false, 5), // una racha de tres: UN turno
    msj('a@lid', true, 10),                                               // respondido a los 10 min (desde el PRIMERO)
    msj('a@lid', false, 60), msj('a@lid', true, 200),                     // otro turno: 140 min
    msj('a@lid', false, 300),                                             // sin respuesta
    msj('a@lid', false, 0, 7, 'l2'), msj('a@lid', true, 1, 7, 'l2'),      // la misma persona en OTRA línea es otra conversación
  ]);
  const l1 = t.filter((x) => x.linea === 'l1').sort((a, b) => a.t - b.t);
  assert.deepEqual(l1.map((x) => x.minutos), [10, 140, null]);
  assert.deepEqual(t.filter((x) => x.linea === 'l2').map((x) => x.minutos), [1]);
  // Lo que escribimos nosotros primero no abre un turno.
  assert.equal(turnosDeChats([msj('b@lid', true, 0), msj('b@lid', true, 5)]).length, 0);
  // El lead del chat es el de cualquier mensaje que lo traiga.
  assert.equal(turnosDeChats([msj('c@lid', false, 0, null), msj('c@lid', true, 3, 42)])[0].leadId, 42);
});

test('esperando respuesta: el último mensaje es de la persona y tiene más de 24 h, sólo con lead', () => {
  const ahora = Date.UTC(2026, 9, 12, 12, 0);
  const r = chatsEsperando([
    msj('a@lid', true, 0), msj('a@lid', false, 10),           // hace ~2 días, de la persona → espera
    msj('b@lid', false, 0), msj('b@lid', true, 10),           // el último es nuestro → no espera
    msj('c@lid', false, 0, null),                              // sin lead: no entra (ruido de contactos personales)
    { linea: 'l1', chat: 'd@lid', deMi: false, t: ahora - 3_600_000, leadId: 9 }, // hace 1 h → no espera todavía
  ], ahora);
  const porChat = Object.fromEntries(r.map((x) => [x.chat, x.espera]));
  assert.deepEqual(porChat, { 'a@lid': true, 'b@lid': false, 'd@lid': false });
});

test('hace cuánto no hablan: tramos fijos, «Nunca» sólo si se pudo leer', () => {
  assert.equal(tramoDeContacto(3, true), '0-7 días');
  assert.equal(tramoDeContacto(8, true), '8-14 días');
  assert.equal(tramoDeContacto(30, true), '15-30 días');
  assert.equal(tramoDeContacto(31, true), 'Más de 30 días');
  assert.equal(tramoDeContacto(null, true), 'Nunca');
  assert.equal(tramoDeContacto(null, false), null, '«no pude leer» no es «nunca hablaron»');
  assert.equal(TRAMOS_CONTACTO.length, 5);
});

test('envíos respondidos: el ÚLTIMO envío de una inscripción que contestó; `respondio_at` manda si existe', () => {
  const envios = [
    { id: 1, inscripcionId: 10, t: '2026-10-01T10:00:00Z', respondioAt: null },
    { id: 2, inscripcionId: 10, t: '2026-10-02T10:00:00Z', respondioAt: null }, // el último de la 10, que respondió
    { id: 3, inscripcionId: 11, t: '2026-10-02T10:00:00Z', respondioAt: null }, // la 11 sigue activa
    { id: 4, inscripcionId: 12, t: '2026-10-03T10:00:00Z', respondioAt: null }, // la 12 pasó a una persona
    { id: 5, inscripcionId: null, t: '2026-10-03T10:00:00Z', respondioAt: '2026-10-03T11:00:00Z' },
  ];
  const estado: Record<number, string> = { 10: 'respondio', 11: 'activa', 12: 'handoff' };
  assert.deepEqual([...enviosRespondidos(envios, (i) => estado[i])].sort(), [2, 4, 5]);
});

test('el sello del constructor de Lovable se reconoce por su selector, no por cualquier «lovable»', () => {
  assert.ok(esSelloDelConstructor('#lovable-badge-close'));
  assert.ok(esSelloDelConstructor('#lovable-badge-cta'));
  assert.ok(esSelloDelConstructor('#lovable-badge > a'));
  assert.ok(!esSelloDelConstructor('#root > div:nth-of-type(2) > section:nth-of-type(1)'));
  assert.ok(!esSelloDelConstructor('#lovable-badges-de-mi-cliente'), 'otro id que empieza igual no es el sello');
  assert.ok(!esSelloDelConstructor(null));
});
