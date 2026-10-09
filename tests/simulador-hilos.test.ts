// =============================================================================
// «Probar» con VARIOS CAMINOS A LA VEZ (lib/simulador-grafo.ts) — segunda tanda, 08/10/2026
// =============================================================================
// Pedido de Martín, punto 2: «de un mismo cron puedo sacar todo una secuencia para WhatsApp y
// toda otra secuencia de email». Con flechas en paralelo la salida es una lista de hilos con su
// reloj virtual (docs/chatbot-flujo-ramas-diseno.md, «"Probar" (parte P)»). Acá se EJECUTA:
//   · el orden real (corre el hilo de reloj más bajo; empate = el orden del array);
//   · una espera suma a SU reloj; un reparto abre hilos con el reloj del padre;
//   · una condición pendiente frena la prueba entera y `elegir` mueve SU hilo;
//   · una respuesta pausa todos, «Si responde» corre en UNO y su «Ir a» retoma UNO;
//   · un hilo que termina no termina la prueba; el tope de hilos vivos; adentro de «Si
//     responde» no se reparte; el email como mail (`correoDeEjemplo`).
//
// Los flujos son VÁLIDOS para `validarGrafo` (se comprueba en cada uno) salvo los dos que prueban
// qué hace la prueba con lo que no se podría guardar: «Probar» corre lo LOCAL, sin publicar.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie, con lo que cazó cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarGrafo, TOPE_HILOS, type PasoGrafo } from '../lib/flujo-grafo';
import {
  iniciar, siguiente, elegir, pausarPorRespuesta, entrarEnRespuesta, proximoHilo, correoDeEjemplo,
  type EstadoSim, type EventoSim,
} from '../lib/simulador-grafo';

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const mail = (o: Partial<PasoGrafo> = {}): PasoGrafo => msg({ canal: 'email', asunto: 'Asunto', ...o });
const esperar = (id: string, minutos: number, sig: string | null, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id, nodo: 'esperar', espera: { modo: 'tiempo', minutos }, siguiente: sig, canal: 'whatsapp', cuerpo: '', ...extra });
const inicio = (sig: string, paralelos: string[]): PasoGrafo => ({ id: 'entrada', nodo: 'inicio', siguiente: sig, paralelos, canal: 'whatsapp', cuerpo: '' });

/** Corre hasta que no hay nada que hacer (fin, una elección o la salida pausada). */
function correr(pasos: PasoGrafo[], estado: EstadoSim): { eventos: EventoSim[]; estado: EstadoSim; maxHilos: number } {
  const eventos: EventoSim[] = [];
  let e = estado;
  let maxHilos = e.hilos.length;
  for (let k = 0; k < 500; k++) {
    const r = siguiente(pasos, e);
    e = r.estado;
    maxHilos = Math.max(maxHilos, e.hilos.length);
    if (!r.evento) break;
    eventos.push(r.evento);
    if (r.evento.t === 'condicion' || r.evento.t === 'fin') break;
  }
  return { eventos, estado: e, maxHilos };
}

/** Lo que se ve, en una línea por evento: 💬 un WhatsApp, ✉ un email. */
const ver = (ev: EventoSim[]) => ev.map((e) => (
  e.t === 'mensaje' ? `${e.paso.canal === 'email' ? '✉' : '💬'}${e.paso.cuerpo}`
    : e.t === 'condicion' ? `◇${e.opciones.map((o) => o.texto).join('|')}`
      : e.t === 'fin' ? `■${e.texto}` : e.texto));

const sinCursor = (e: EstadoSim) => e.hilos.map((h) => [h.cursor, h.reloj]);

// ── El ejemplo de Martín: del CRON, WhatsApp por un lado y email por el otro ─────────────────────

const WA_Y_EMAIL: PasoGrafo[] = [
  msg({ id: 'w1', cuerpo: 'WA día 0', siguiente: 'esp' }),
  esperar('esp', 1440, 'w2'),
  msg({ id: 'w2', cuerpo: 'WA día 1', siguiente: null }),
  mail({ id: 'e1', cuerpo: 'Email día 0', siguiente: null }),
  inicio('w1', ['e1']),
];

test('del CRON salen dos hilos y la prueba muestra el ORDEN REAL: WhatsApp día 0, email día 0, WhatsApp día 1', () => {
  assert.deepEqual(validarGrafo(WA_Y_EMAIL), []);
  const e0 = iniciar(WA_Y_EMAIL);
  assert.deepEqual(sinCursor(e0), [['w1', 0], ['e1', 0]], 'un hilo por raíz (raicesSalida), los dos en el minuto 0');
  // La píldora de la espera sale cuando al hilo le vuelve a tocar: DESPUÉS del email del día 0,
  // justo antes del WhatsApp del día 1.
  assert.deepEqual(ver(correr(WA_Y_EMAIL, e0).eventos), ['💬WA día 0', '✉Email día 0', '⏳ Esperar 1 día', '💬WA día 1', '■Fin']);
});

test('corre el hilo de reloj más bajo; en un empate, el primero del array', () => {
  assert.equal(proximoHilo([{ cursor: 'a', reloj: 60 }, { cursor: 'b', reloj: 0 }, { cursor: 'c', reloj: 0 }]), 1);
  assert.equal(proximoHilo([{ cursor: 'a', reloj: 0 }, { cursor: 'b', reloj: 0 }]), 0);
  assert.equal(proximoHilo([{ cursor: 'a', reloj: 1440 }, { cursor: 'b', reloj: 60 }]), 1);
});

// ── Un reparto desde una tarjeta: los hilos nuevos nacen con el reloj del padre ──────────────────

const REPARTO: PasoGrafo[] = [
  msg({ id: 'a', cuerpo: 'A', siguiente: 'esp' }),
  // La espera reparte cuando TERMINA: «C» (la de siempre) y «B» (en paralelo) arrancan el día 1.
  esperar('esp', 1440, 'c', { paralelos: ['b'] }),
  msg({ id: 'c', cuerpo: 'C', siguiente: null }),
  mail({ id: 'b', cuerpo: 'B', siguiente: 'esp2' }),
  esperar('esp2', 60, 'd'),
  mail({ id: 'd', cuerpo: 'D', siguiente: null }),
];

test('una tarjeta con flechas en paralelo agrega hilos con el reloj del padre (una espera, después de esperar)', () => {
  assert.deepEqual(validarGrafo(REPARTO), []);
  let e = iniciar(REPARTO);
  const vistos: EventoSim[] = [];
  // Hasta la píldora de la espera: ahí se reparte.
  for (let k = 0; k < 2; k++) { const r = siguiente(REPARTO, e); e = r.estado; vistos.push(r.evento!); }
  assert.deepEqual(ver(vistos), ['💬A', '⏳ Esperar 1 día']);
  assert.deepEqual(sinCursor(e), [['c', 1440], ['b', 1440]], 'el hilo nuevo va al final, con el reloj del padre');
  assert.deepEqual(ver(correr(REPARTO, e).eventos), ['💬C', '✉B', '⏳ Esperar 1 h', '✉D', '■Fin']);
});

test('«N antes de la reunión» no mueve el reloj: la prueba no tiene una reunión de la que descontar', () => {
  const f: PasoGrafo[] = [
    msg({ id: 'w1', cuerpo: 'W1', siguiente: 'esp' }),
    { id: 'esp', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 1440 }, siguiente: 'w2', canal: 'whatsapp', cuerpo: '' },
    msg({ id: 'w2', cuerpo: 'W2', siguiente: null }),
    mail({ id: 'e1', cuerpo: 'E1', siguiente: null }),
    inicio('w1', ['e1']),
  ];
  assert.deepEqual(validarGrafo(f), []);
  const r = correr(f, iniciar(f));
  assert.deepEqual(ver(r.eventos), ['💬W1', '⏳ 1 día antes de la reunión', '💬W2', '✉E1', '■Fin']);
});

// ── Una condición pendiente frena TODO, y elegir mueve SU hilo ──────────────────────────────────

const CONDICION: PasoGrafo[] = [
  msg({ id: 'w1', cuerpo: 'W1', siguiente: 'esp' }),
  esperar('esp', 1440, 'w2'),
  msg({ id: 'w2', cuerpo: 'W2', siguiente: null }),
  { id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'tiene_email' }], siguiente: 'e1' }], si_no: null },
  mail({ id: 'e1', cuerpo: 'E1', siguiente: null }),
  inicio('w1', ['c1']),
];

test('una condición pendiente frena la prueba ENTERA, aunque otro hilo tenga algo para mostrar', () => {
  assert.deepEqual(validarGrafo(CONDICION), []);
  const r = correr(CONDICION, iniciar(CONDICION));
  assert.deepEqual(ver(r.eventos), ['💬W1', '◇Tiene email|Si no']);
  assert.equal(r.estado.eligiendo?.hilo, 1, 'la pregunta es del hilo de la condición');
  assert.equal(r.estado.hilos.length, 2, 'el otro hilo sigue vivo, esperando');
  assert.equal(siguiente(CONDICION, r.estado).evento, null, 'una pregunta a la vez: no corre nada más');
});

test('elegir mueve el hilo de la CONDICIÓN, y «Si no» sin destino cierra sólo ese hilo', () => {
  const parado = correr(CONDICION, iniciar(CONDICION)).estado;
  // Por la rama: el email del día 0 sale antes que la espera del otro hilo.
  assert.deepEqual(ver(correr(CONDICION, elegir(parado, 'r1')).eventos), ['✉E1', '⏳ Esperar 1 día', '💬W2', '■Fin']);
  // Por «Si no» (termina): el otro hilo sigue como si nada.
  assert.deepEqual(ver(correr(CONDICION, elegir(parado, 'si_no')).eventos), ['⏳ Esperar 1 día', '💬W2', '■Fin']);
});

// ── La respuesta del lead: pausa todos, «Si responde» en UNO, el «Ir a» retoma UNO ──────────────

const RESPUESTA: PasoGrafo[] = [
  msg({ id: 'w1', cuerpo: 'W1', siguiente: 'esp' }),
  esperar('esp', 1440, 'w2'),
  msg({ id: 'w2', cuerpo: 'W2', siguiente: null }),
  mail({ id: 'e1', cuerpo: 'E1', siguiente: 'esp3' }),
  esperar('esp3', 2880, 'e2'),
  mail({ id: 'e2', cuerpo: 'E2', siguiente: null }),
  { id: 'resp', nodo: 'respuesta', canal: 'whatsapp', cuerpo: '', casos: [{ id: 'k1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'r1' }], si_no: null },
  msg({ id: 'r1', cuerpo: 'R1', siguiente: 'salto' }),
  { id: 'salto', nodo: 'ir_a', destino: { nodo: 'w2' }, canal: 'whatsapp', cuerpo: '' },
  inicio('w1', ['e1']),
];

test('una respuesta pausa TODOS los hilos; «Si responde» corre en uno y su «Ir a» retoma UNO solo', () => {
  assert.deepEqual(validarGrafo(RESPUESTA), []);
  let e = iniciar(RESPUESTA);
  for (let k = 0; k < 2; k++) e = siguiente(RESPUESTA, e).estado; // W1 y E1, los dos del día 0
  assert.equal(e.hilos.length, 2);
  const p = pausarPorRespuesta(e);
  assert.equal(p.pausoLaSalida, true);
  assert.equal(siguiente(RESPUESTA, p.estado).evento, null, 'ningún hilo de la salida corre');
  const r = entrarEnRespuesta(RESPUESTA, p.estado, 'k1');
  assert.deepEqual(sinCursor(r.estado), [['r1', 0]], 'UN hilo, con el reloj de «ahora» (lo último que corrió fue el día 0)');
  const resto = correr(RESPUESTA, r.estado);
  // Retoma en «W2» y nada más: la espera del WhatsApp y el email del día 2 estaban congelados y
  // se descartan, como en el motor.
  assert.deepEqual(ver(resto.eventos), ['💬R1', '↪ Ir a otra tarjeta', '💬W2', '■Fin']);
  assert.equal(resto.estado.rama, 'salida');
});

test('una salida sin hilos vivos no se «pausa»: no había nada corriendo', () => {
  const f: PasoGrafo[] = [msg({ id: 'w1', cuerpo: 'W1', siguiente: null })];
  const despues = siguiente(f, iniciar(f)).estado; // salió W1; el «Fin» todavía no se dijo
  assert.equal(despues.terminado, false);
  assert.equal(pausarPorRespuesta(despues).pausoLaSalida, false);
});

// ── Un hilo que termina no termina la prueba ────────────────────────────────────────────────────

test('«Ir a otra automatización» cierra SU hilo; la prueba sigue con los demás', () => {
  const f: PasoGrafo[] = [
    mail({ id: 'e1', cuerpo: 'E1', siguiente: 'x' }),
    { id: 'x', nodo: 'ir_a', destino: { secuencia_id: 7 }, canal: 'email', cuerpo: '' },
    msg({ id: 'w1', cuerpo: 'W1', siguiente: 'esp' }),
    esperar('esp', 60, 'w2'),
    msg({ id: 'w2', cuerpo: 'W2', siguiente: null }),
    inicio('e1', ['w1']),
  ];
  assert.deepEqual(validarGrafo(f), []);
  let e = iniciar(f);
  const evs: EventoSim[] = [];
  for (let k = 0; k < 2; k++) { const r = siguiente(f, e, { secuencia: () => 'Bienvenida' }); e = r.estado; evs.push(r.evento!); }
  assert.deepEqual(ver(evs), ['✉E1', '↪ Sigue en «Bienvenida»']);
  assert.equal(e.terminado, false, 'queda el hilo del WhatsApp');
  assert.deepEqual(sinCursor(e), [['w1', 0]]);
  assert.deepEqual(ver(correr(f, e).eventos), ['💬W1', '⏳ Esperar 1 h', '💬W2', '■Fin']);
});

test('sin flechas en paralelo hay UN hilo, como siempre; sin tarjetas, «Sin tarjetas»', () => {
  const lineal: PasoGrafo[] = [msg({ id: 'a', siguiente: 'b' }), msg({ id: 'b', siguiente: null })];
  assert.deepEqual(sinCursor(iniciar(lineal)), [['a', 0]]);
  assert.deepEqual(ver(correr([], iniciar([])).eventos), ['■Sin tarjetas']);
});

// ── Lo que no se podría guardar (se prueba lo LOCAL) ────────────────────────────────────────────

test('nunca hay más de TOPE_HILOS hilos vivos, aunque el flujo local se pase', () => {
  const f: PasoGrafo[] = [
    msg({ id: 'm0', cuerpo: 'm0', siguiente: 'm9', paralelos: ['q1', 'q2', 'q3'] }),
    msg({ id: 'm9', cuerpo: 'm9', siguiente: null }),
    msg({ id: 'p1', cuerpo: 'p1', siguiente: null }), msg({ id: 'p2', cuerpo: 'p2', siguiente: null }), msg({ id: 'p3', cuerpo: 'p3', siguiente: null }),
    msg({ id: 'q1', cuerpo: 'q1', siguiente: null }), msg({ id: 'q2', cuerpo: 'q2', siguiente: null }), msg({ id: 'q3', cuerpo: 'q3', siguiente: null }),
    inicio('m0', ['p1', 'p2', 'p3']),
  ];
  assert.ok(validarGrafo(f).some((x) => x.includes('caminos a la vez')), 'este flujo NO se puede guardar');
  const r = correr(f, iniciar(f));
  assert.equal(TOPE_HILOS, 6);
  assert.equal(r.maxHilos, TOPE_HILOS);
  // m0 + su siguiente + las 3 del CRON + 2 de sus 3 flechas: la sexta ya no entra.
  assert.equal(r.eventos.filter((x) => x.t === 'mensaje').length, 7);
});

test('adentro de «Si responde» no se reparte: la respuesta corre en un hilo', () => {
  const f: PasoGrafo[] = [
    msg({ id: 'm1', cuerpo: 'M1', siguiente: null }),
    { id: 'resp', nodo: 'respuesta', canal: 'whatsapp', cuerpo: '', casos: [{ id: 'k1', titulo: 'X', cuando: 'y', siguiente: 'r1' }], si_no: null },
    msg({ id: 'r1', cuerpo: 'R1', siguiente: null, paralelos: ['r2'] }),
    msg({ id: 'r2', cuerpo: 'R2', siguiente: null }),
  ];
  assert.ok(validarGrafo(f).some((x) => x.includes('no puede sacar flechas en paralelo')), 'este flujo NO se puede guardar');
  const e = entrarEnRespuesta(f, iniciar(f), 'k1').estado;
  assert.deepEqual(ver(correr(f, e).eventos), ['💬R1', '■Fin de la respuesta']);
});

// ── El email se ve como un mail ─────────────────────────────────────────────────────────────────

test('un email del flujo: asunto, vista previa (el preheader) y cuerpo, con el lead de ejemplo', () => {
  assert.deepEqual(
    correoDeEjemplo({ asunto: 'Hola {{nombre}}', preheader: 'De {{negocio}}', cuerpo: 'Te escribo por {{empresa}}' }, 'Mi negocio'),
    // `html: ''`: el paso no trae `cuerpo_html` (integración de la tercera tanda; el HTML lo prueba
    // tests/simulador-grafo.test.ts).
    { asunto: 'Hola Luis', vistaPrevia: 'De Mi negocio', cuerpo: 'Te escribo por Acme', html: '' },
  );
  // Vacío es vacío: sin preheader no se inventa una vista previa con el principio del cuerpo.
  assert.deepEqual(correoDeEjemplo({ asunto: null, cuerpo: 'Cuerpo' }), { asunto: '', vistaPrevia: '', cuerpo: 'Cuerpo', html: '' });
});

// ROTURAS (08/10/2026), una por vez sobre lib/simulador-grafo.ts, con un arnés que rompe, corre este
// archivo y restaura DE MEMORIA (nunca con git checkout) verificando con md5 que volviera idéntico.
// Sin romper: 13 pass / 0 fail. Las 18 cayeron:
//   · H1 en un empate gana el ÚLTIMO del array (`<` → `<=` en `proximoHilo`): 5 pass / 8 fail.
//   · H2 corre el hilo de reloj más ALTO: 8 pass / 5 fail.
//   · H3 la espera no suma al reloj de su hilo: 9 pass / 4 fail.
//   · H4 la píldora «Esperar 1 día» sale al EMPEZAR a esperar (el email del día 0 quedaba debajo):
//     10 pass / 3 fail.
//   · H5 un hilo repartido nace en el minuto 0 y no con el reloj del padre: 12 / 1.
//   · H6 el hilo repartido va ADELANTE del array en vez de al final: 12 / 1.
//   · H7 sin el tope de hilos vivos (`TOPE_HILOS`): 12 / 1.
//   · H8 una condición pendiente no frena a los otros hilos: 12 / 1.
//   · H9 `elegir` mueve el PRIMER hilo y no el de la condición: 12 / 1.
//   · H10 la respuesta del lead no pausa la salida: 12 / 1.
//   · H11 «Si responde» conserva los hilos congelados de la salida: 11 / 2.
//   · H12 el «Ir a» desde «Si responde» no vuelve a la salida: 12 / 1.
//   · H13 «Ir a otra automatización» termina la prueba entera y no sólo su hilo: 12 / 1.
//   · H14 se reparte adentro de «Si responde»: 12 / 1.
//   · H15 arranca con UN hilo (sólo la raíz principal, sin las flechas del CRON): 6 / 7.
//   · H16 «N antes de la reunión» mueve el reloj: 12 / 1.
//   · H17 «Se pausa» con la salida ya sin hilos vivos: 12 / 1.
//   · H18 la vista previa del email inventada con el principio del cuerpo: 12 / 1.
