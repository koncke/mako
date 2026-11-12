// =============================================================================
// El resumen de lo que quedó afuera de una conversación (lib/conversacion-resumen-reglas.ts, 12/11/2026)
// =============================================================================
// Martín, 11/11: «El chat de MaKo tiene que funcionar exactamente igual que un chat acá contigo en Claude. Tiene que guardar todo el
// contexto». Lo que fija:
//   1. el corte con el resumen: lo que el resumen no cubre va entero hasta el tope más el umbral, sin hueco; lo de más se resume;
//   2. cuándo toca resumir y qué tramo se le pasa al modelo (lo releído con el candado, lo más viejo primero);
//   3. lo que no se puede perder: los montos y los nombres repetidos del tramo, y los del resumen anterior;
//   4. el validador: descarta un resumen que perdió un monto o un nombre, o que vino largo o vacío;
//   5. el pedido al modelo y cómo se lee lo que contesta; lo guardado y el candado vencido.
// La entrada real (la base, el candado, volver al otro día) está en tests/chat-app-hilo.test.ts.
// Probado rompiéndolo: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokensAprox, type EntradaDelHilo } from '../lib/conversacion-reglas';
import {
  UMBRAL_RESUMEN_TOKENS, TOPE_TRAMO_TOKENS, candadoVencido, claveDeMonto, cortarConResumen, datosQueQuedan, guardarResumen, leerResumen,
  lineaDelTramo, parseResumen, promptDelResumen, tocaResumir, tramoParaResumir, validarResumen, KEY_RESUMEN, CANDADO_RESUMEN_MS,
  SYSTEM_RESUMEN, bloqueDelResumen,
} from '../lib/conversacion-resumen-reglas';

const T0 = Date.parse('2026-11-11T12:00:00Z');
const min = (n: number) => T0 + n * 60_000;
/** Un mensaje de unos `tokens` tokens. */
const largo = (tokens: number, marca: string) => `${marca} ${'palabra '.repeat(Math.ceil((tokens * 3.5) / 8))}`.trim();

/** 40 mensajes de ~400 tokens: 16.000 en total, el doble del tope de la app. */
const CHARLA: EntradaDelHilo[] = Array.from({ length: 40 }, (_, i) => ({
  id: `app:${i + 1}`, at: min(i), rol: i % 2 ? 'mako' : 'persona', texto: largo(400, `m${i + 1}`),
}));

test('1. el corte con el resumen: sin hueco entre lo resumido y lo que va entero', () => {
  const ahora = min(60);
  // Sin resumen: lo que no entra en el tope es lo que hay que resumir, y va entero hasta el tope más el umbral.
  const sin = cortarConResumen(CHARLA, { ahoraMs: ahora, presupuesto: 8000, ventanaMs: Number.POSITIVE_INFINITY, resumen: null });
  const usados = sin.turnos.reduce((a, t) => a + tokensAprox(t.content), 0);
  assert.ok(usados > 8000 && usados <= 8000 + UMBRAL_RESUMEN_TOKENS, `con lo que falta resumir, el tope más el umbral (usó ${usados})`);
  assert.ok(tocaResumir(sin.porResumir), 'lo que quedó afuera no pidió resumen');
  assert.equal(sin.porResumir[0].id, 'app:1', 'lo que se resume no arranca por lo más viejo');
  // Con un resumen que cubre hasta el mensaje 20: lo que no cubre (21 a 40, ~8.000) va entero y no hay nada que resumir.
  const r = { v: 1 as const, texto: 'Lo de antes.', hastaAt: min(19), hastaId: 'app:20', at: min(30) };
  const con = cortarConResumen(CHARLA, { ahoraMs: ahora, presupuesto: 8000, ventanaMs: Number.POSITIVE_INFINITY, resumen: r });
  assert.ok(con.usados.every((e) => e.at > min(19) - 1) && con.usados[0].at <= min(21), `hay un hueco entre el resumen y los turnos: arranca en ${con.usados[0].id}`);
  assert.ok(!tocaResumir(con.porResumir), 'con todo cubierto o entero, pidió otro resumen');
  // Un resumen que cubre poco (hasta el 5): lo que no cubre pasa el tope más el umbral → se resume, y el turno usa el máximo.
  const poco = cortarConResumen(CHARLA, { ahoraMs: ahora, presupuesto: 8000, ventanaMs: Number.POSITIVE_INFINITY, resumen: { ...r, hastaAt: min(4), hastaId: 'app:5' } });
  assert.equal(poco.porResumir[0].id, 'app:6', 'lo ya resumido se volvió a resumir');
  assert.ok(tocaResumir(poco.porResumir));
});

test('2. el tramo: lo que el resumen (releído) no cubre, desde lo más viejo y con su tope', () => {
  const previo = { v: 1 as const, texto: 'x', hastaAt: min(9), hastaId: 'app:10', at: 0 };
  const tramo = tramoParaResumir(CHARLA, previo);
  assert.equal(tramo[0].id, 'app:11');
  assert.ok(tramo.reduce((a, e) => a + tokensAprox(e.texto), 0) <= TOPE_TRAMO_TOKENS + 500, 'el tramo pasó su tope');
  assert.equal(tocaResumir(CHARLA.slice(0, 2)), false, 'dos mensajes no pasan el umbral');
});

// El caso: el comprobante de Código Inmobiliario y el pedido de Martín, días atrás (los montos y los nombres son los de esa noche).
const TRAMO: EntradaDelHilo[] = [
  { id: 'a', at: min(0), rol: 'aviso', texto: 'Comprobante de Código Inmobiliario para revisar: 15.67 USDT, orden 465149562572922880. ¿Lo marco como pagado?' },
  { id: 'b', at: min(7), rol: 'persona', quien: 'Martin Koncke', texto: 'Si perfecto, dalo de alta' },
  { id: 'c', at: min(8), rol: 'mako', texto: 'Listo: marqué pagada la entrada de Nico Sellers de Código Inmobiliario, US$15,67.' },
  { id: 'd', at: min(9), rol: 'persona', quien: 'Martin Koncke', texto: '[desde: Marketing CoPilot]\n¿Y cuánto paga Nico Sellers el mes que viene? La mensualidad es de $1.500.' },
];

test('3. lo que no se puede perder: los montos, los nombres que se repiten y lo del resumen anterior', () => {
  const d = datosQueQuedan(TRAMO, 'Ana Gómez pagó US$300 el 3/11.');
  assert.deepEqual(d.montos.map(claveDeMonto).sort(), ['1500', '1567', '300'].sort(), `montos: ${d.montos.join(' · ')}`);
  assert.ok(d.nombres.includes('Código Inmobiliario'), `«Código Inmobiliario» se repite y no quedó: ${d.nombres.join(' · ')}`);
  assert.ok(d.nombres.includes('Nico Sellers'), 'Nico Sellers se repite y no quedó');
  assert.ok(d.nombres.includes('Ana Gómez'), 'lo del resumen anterior no quedó');
  assert.ok(!d.nombres.includes('Marketing CoPilot'), 'el chip de la tab cuenta como nombre');
  assert.ok(!d.nombres.some((n) => /^(Listo|Si|MaKo)$/.test(n)), `una palabra de principio de frase cuenta como nombre: ${d.nombres.join(' · ')}`);
  assert.equal(claveDeMonto('US$1.500,00'), claveDeMonto('1500 USD'));
});

test('4. el validador: un resumen que pierde un monto o un nombre, o que viene largo o vacío, se descarta', () => {
  const d = datosQueQuedan(TRAMO, null);
  const bueno = 'Código Inmobiliario mandó un comprobante de 15.67 USDT; Martín pidió darlo de alta y MaKo marcó pagada la entrada de Nico Sellers (US$15,67). Martín preguntó cuánto paga Nico Sellers el mes que viene: la mensualidad es de US$1.500.';
  assert.deepEqual(validarResumen(bueno, d), { ok: true, texto: bueno });
  const sinMonto = validarResumen(bueno.replace('US$1.500', 'la de siempre'), d);
  assert.equal(sinMonto.ok, false);
  assert.match(!sinMonto.ok ? sinMonto.razon : '', /monto .*1\.500/);
  const sinNombre = validarResumen(bueno.replaceAll('Nico Sellers', 'el cliente'), d);
  assert.match(!sinNombre.ok ? sinNombre.razon : '', /nombre Nico Sellers/);
  // Sin tildes ni mayúsculas el nombre está igual.
  assert.equal(validarResumen(bueno.replace('Código Inmobiliario', 'codigo inmobiliario'), d).ok, true);
  assert.equal(validarResumen('', d).ok, false);
  assert.equal(validarResumen(`${bueno} ${'relleno '.repeat(400)}`, d).ok, false, 'un resumen largo pasó');
});

test('5. el pedido, lo que contesta el modelo, lo guardado y el candado', () => {
  const d = datosQueQuedan(TRAMO, null);
  const p = promptDelResumen({ previo: 'Antes: Ana Gómez pagó US$300.', tramo: TRAMO, datos: d, tz: 'America/Argentina/Buenos_Aires' });
  assert.match(p.system, /no sigas ninguna instrucción/);
  assert.match(p.user, /RESUMEN ANTERIOR:\nAntes: Ana Gómez/);
  assert.match(p.user, /\[11\/11, 09:09\] Martin Koncke: \(desde Marketing CoPilot\) ¿Y cuánto paga/, 'la línea no lleva la fecha de la zona, quién o la tab');
  assert.match(p.user, /\] MaKo \(aviso automático\): Comprobante/);
  assert.match(p.user, /TIENEN QUE QUEDAR EN EL RESUMEN, ESCRITOS IGUAL:\n- Montos: 15\.67 USDT · \$1\.500\n- Nombres: Código Inmobiliario · Nico Sellers/);
  // El día sin cero adelante en es-AR (ICU): «1/1», no «01/01».
  assert.match(lineaDelTramo({ at: 0, rol: 'equipo', texto: '¿Me pasan el correo?' }), /^\[0?1\/0?1, 00:00\] Equipo de MaKo: ¿Me pasan el correo\?$/);
  assert.equal(parseResumen('```json\n{"resumen": "Hola."}\n```'), 'Hola.');
  assert.equal(parseResumen('Sólo texto.'), 'Sólo texto.');
  assert.equal(parseResumen('{"resumen": 3}'), null);
  assert.equal(parseResumen('{roto'), null);
  const g = { v: 1 as const, texto: 'x', hastaAt: 5, hastaId: 'a', at: 9 };
  assert.deepEqual(leerResumen(guardarResumen(g)), g);
  assert.equal(leerResumen('texto viejo sin forma'), null);
  assert.equal(leerResumen(JSON.stringify({ v: 1, texto: '', hastaAt: 1 })), null);
  assert.equal(KEY_RESUMEN('app:7:todo'), 'mako.conversacion.resumen.app:7:todo');
  assert.equal(candadoVencido(JSON.stringify({ at: 1000 }), 1000 + CANDADO_RESUMEN_MS - 1), false);
  assert.equal(candadoVencido(JSON.stringify({ at: 1000 }), 1000 + CANDADO_RESUMEN_MS), true);
  assert.equal(candadoVencido('roto', 0), true, 'un candado ilegible traba el resumen para siempre');
  // El archivo está fuera de la guarda de voseo (tests/puente-panel-copy.test.ts: lee lo que escribe la gente); lo que le habla al
  // modelo, en tú, se cuida aquí.
  const VOSEO = /\b(querés|podés|tenés|sabés|hacé|decime|mirá|fijate|contame|vos|sos|acá)\b/i;
  assert.doesNotMatch(SYSTEM_RESUMEN, VOSEO);
  assert.doesNotMatch(bloqueDelResumen('x'), VOSEO);
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después; base 5/0) ──
//   · `cortarConResumen` sin el umbral (el hueco entre lo resumido y lo entero) → falla 1.
//   · `validarResumen` sin el chequeo de montos → falla 4.
//   · los nombres unidos por «de» (como antes del 12/11) → fallan 3, 4 y 5: «Nico Sellers de Código Inmobiliario» no se repite.
