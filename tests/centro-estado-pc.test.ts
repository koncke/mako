// =============================================================================
// El estado de la PC, en el Uso (30/10/2026; 31/10, Martín: «Si, ponlo pero en USO»; docs/diseno-cartero-servicio.md §2.2)
// =============================================================================
// El Runner estuvo parado del 24/10 al 30/10 y nadie se enteró: lo único que lo decía era un renglón gris, sólo en la computadora. La
// regla es pura y la calcula MaKo con sus datos. Lo que fija este archivo: qué dice en cada caso, siempre el hecho con su edad; que una vuelta del
// servicio no hace pasar a una cuenta por «con Runner» en ninguna de las preguntas que leen eso; y que está en el Uso, y no como cartel.
//
// Probado rompiéndolo: la tabla al pie. Datos inventados.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaUso } from '../app/admin/operaciones/Uso';
import { mensajesEnLimbo, textoDelCartel } from '../lib/centro-limbo';
import { estadoDeLaPc, comoSale, completarChats, preguntaDeChatCerrado, sinNoticiasDesde } from '../lib/centro-chats';
import { carteroVivo, faltaColumnaDeLaVuelta, filaDeLaVuelta, motivoDeEspera, sanearServicio, vistoDeLaFila, type ChatCartero } from '../lib/operaciones-reglas';
import { cuentasDeUso } from '../lib/centro-uso';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const MIN = 60_000;
const DIA = 86_400_000;
const CHAT = 'cli_11111111-2222-4333-8444-555555555555';
const chatDe = (c: Partial<ChatCartero>): ChatCartero => ({ local: CHAT, titulo: 'CRM', cuenta: null, vivo: false, estado: null, actividad: null, ...c });
const AHORA = Date.parse('2026-10-30T18:00:00Z'); // 15:00 en Argentina
const iso = (antes: number) => new Date(AHORA - antes).toISOString();
const pedido = (antes: number, extra: Partial<{ estado: string; destino_cuenta: string | null }> = {}) => ({ estado: 'escrito', created_at: iso(antes), destino_cuenta: 'claude2', ...extra });

/** La PC apagada: nadie sube nada hace rato. */
const apagada = [{ cuenta: 'claude1', vistoAt: iso(40 * MIN), noticiasAt: iso(40 * MIN) }, { cuenta: 'claude2', vistoAt: iso(2 * DIA), noticiasAt: iso(50 * MIN) }];
/** El servicio sube; el último Runner, hace días. */
const sinRunner = [{ cuenta: 'claude1', vistoAt: iso(6 * DIA), noticiasAt: iso(MIN) }, { cuenta: 'claude2', vistoAt: null, noticiasAt: iso(MIN) }];
/** Un Runner da vueltas. */
const conRunner = [{ cuenta: 'claude1', vistoAt: iso(MIN), noticiasAt: iso(MIN) }, { cuenta: 'claude2', vistoAt: iso(6 * DIA), noticiasAt: iso(MIN) }];

test('la PC apagada: «sin noticias», con la hora de la última vuelta de cualquiera', () => {
  const c = estadoDeLaPc(apagada, [pedido(7 * DIA)], AHORA)!;
  assert.equal(c.tipo, 'sin_noticias');
  assert.equal(c.texto, 'Sin noticias de la PC desde las 14:20');
  assert.equal(c.hacer, 'Mira si está prendida y abre el Runner de la cuenta 2.');
  assert.equal(sinNoticiasDesde(apagada, AHORA), AHORA - 40 * MIN);
});

test('una hora sola, de hace días, miente: lleva el día', () => {
  const k = (antes: number) => [{ cuenta: 'claude1', vistoAt: iso(antes), noticiasAt: iso(antes) }];
  assert.equal(estadoDeLaPc(k(DIA), [], AHORA)!.texto, 'Sin noticias de la PC desde ayer a las 15:00');
  assert.equal(estadoDeLaPc(k(6 * DIA), [], AHORA)!.texto, 'Sin noticias de la PC desde el 24 oct a las 15:00');
  assert.equal(estadoDeLaPc(k(6 * DIA), [], AHORA)!.hacer, 'Mira si está prendida y abre el Runner.', 'sin pedidos no hay una cuenta que nombrar');
});

test('vueltas sin Runner y un pedido viejo: «sin Runner», desde cuándo, cuántos y de hace cuánto', () => {
  const uno = estadoDeLaPc(sinRunner, [pedido(7 * DIA)], AHORA)!;
  assert.equal(uno.tipo, 'sin_runner');
  assert.equal(uno.texto, 'Sin Runner desde el 24 oct a las 15:00: 1 pedido tuyo espera (de hace 7 días)');
  assert.equal(uno.hacer, 'Abre el Runner de la cuenta 2.');
  const varios = estadoDeLaPc(sinRunner, [pedido(2 * DIA, { destino_cuenta: 'claude3' }), pedido(7 * DIA), pedido(20 * MIN, { destino_cuenta: null })], AHORA)!;
  assert.equal(varios.texto, 'Sin Runner desde el 24 oct a las 15:00: 3 pedidos tuyos esperan (el más viejo, de hace 7 días)');
  assert.equal(varios.tipo === 'sin_runner' && varios.pedidos, 3);
  assert.equal(varios.tipo === 'sin_runner' && varios.cuenta, 'claude2', 'la cuenta del más viejo');
});

test('«sin Runner» cuenta sólo lo que sigue en «escrito», y sin pedidos igual lo dice', () => {
  const lista = ['tomado', 'entregado', 'no_entregado', 'hecho', 'cancelado'].map((estado) => pedido(DIA, { estado }));
  const c = estadoDeLaPc(sinRunner, lista, AHORA)!;
  assert.equal(c.texto, 'Sin Runner desde el 24 oct a las 15:00');
  assert.equal(c.hacer, 'Abre el Runner.');
  assert.equal(estadoDeLaPc(sinRunner, [{ estado: 'escrito', created_at: 'no es una fecha', destino_cuenta: null }], AHORA)!.texto, 'Sin Runner desde el 24 oct a las 15:00');
});

test('con un Runner dando vueltas está al día, con su edad; lo que espera al Runner de OTRA cuenta lo cuenta la regla de los mensajes', () => {
  assert.deepEqual(estadoDeLaPc(conRunner, [pedido(7 * DIA)], AHORA), { tipo: 'al_dia', desde: AHORA - MIN, texto: 'La PC dio noticias hace 1 min', hacer: null });
  assert.equal(sinNoticiasDesde(conRunner, AHORA), null);
  // Corrido en la revisión: Runner en la 1, la 2 con el servicio subiendo y su chat vivo sin Runner. La PC está al día, y el mensaje igual espera.
  const dos = [{ cuenta: 'claude1', vistoAt: iso(MIN), noticiasAt: iso(MIN), chats: [] }, { cuenta: 'claude2', vistoAt: iso(6 * DIA), noticiasAt: iso(MIN), chats: [chatDe({ vivo: true, runner: false })] }];
  const cola = [{ id: 'p1', texto: 'hola', motivo: null, destino: CHAT, destino_titulo: 'CRM', ...pedido(5 * DIA) }];
  assert.equal(estadoDeLaPc(dos, cola, AHORA)?.tipo, 'al_dia');
  const limbo = mensajesEnLimbo(cola, dos, AHORA);
  assert.equal(textoDelCartel(limbo, AHORA), '1 mensaje tuyo espera al Runner de la cuenta 2 (de hace 5 días)');
  // Sin el servicio: la 2 callada hace 6 días. Lo mismo, con la foto vieja.
  const callada = [dos[0], { ...dos[1], noticiasAt: iso(6 * DIA) }];
  assert.equal(estadoDeLaPc(callada, cola, AHORA)?.tipo, 'al_dia');
  assert.equal(mensajesEnLimbo(cola, callada, AHORA)[0]?.causa, 'sin_runner');
});

test('en el Uso se dibuja el hecho con su edad, y qué hacer; sin dato, nada', () => {
  const lista = (pc: ReturnType<typeof estadoDeLaPc>) => renderToStaticMarkup(createElement(ListaUso, { cuentas: [], ahora: AHORA, pc }));
  const caida = lista(estadoDeLaPc(apagada, [pedido(7 * DIA)], AHORA));
  assert.ok(caida.includes('Sin noticias de la PC desde las 14:20'), caida);
  assert.ok(caida.includes('Mira si está prendida y abre el Runner de la cuenta 2.'));
  assert.ok(caida.includes('co-punto--viejo'), 'con el punto gris');
  assert.ok(caida.indexOf('co-uso__pc') < caida.indexOf('co-uso__lista'), 'arriba de las cuentas');
  const bien = lista(estadoDeLaPc(conRunner, [], AHORA));
  assert.ok(bien.includes('La PC dio noticias hace 1 min'), bien);
  assert.ok(bien.includes('co-punto--trabajando'));
  assert.ok(!lista(null).includes('co-uso__pc'), 'sin dato, nada');
});

test('nunca afirma que la PC no responde: dice el hecho', () => {
  for (const [c, p] of [[apagada, []], [sinRunner, []], [conRunner, []]] as const) {
    assert.doesNotMatch(estadoDeLaPc(c, p, AHORA)!.texto, /no responde|no da noticias|nadie entrega/i);
  }
});

test('sin carteros, o una PC que nunca dio noticias, no se alarma', () => {
  assert.equal(estadoDeLaPc([], [pedido(DIA)], AHORA), null);
  assert.equal(estadoDeLaPc([{ vistoAt: null, noticiasAt: null }], [pedido(DIA)], AHORA), null);
});

test('sin la mig 0355 (`noticiasAt` sin dato): las dos preguntas leen `vistoAt`, como antes', () => {
  assert.equal(estadoDeLaPc([{ vistoAt: iso(MIN) }], [pedido(DIA)], AHORA)?.tipo, 'al_dia');
  assert.equal(estadoDeLaPc([{ vistoAt: iso(40 * MIN) }], [], AHORA)!.tipo, 'sin_noticias');
});

test('una vuelta del servicio no pasa por un Runner en ninguna de las preguntas que leen eso', () => {
  const k = { cuenta: 'claude1', vistoAt: iso(6 * DIA), noticiasAt: iso(MIN), claves: ['k1'], chats: [chatDe({ vivo: true, runner: false })] };
  assert.equal(carteroVivo(k, AHORA), false, 'PanelRunner, Uso, teléfono, API');
  assert.equal(sinNoticiasDesde([k], AHORA), null, 'la PC sí da noticias');
  // La caja de escribir: el trabajo espera al Runner, no «sale ya».
  const e = comoSale({ sesion: CHAT, cuenta: 'claude1', estado: 'abierto' }, [k], 'k1', AHORA);
  assert.equal(e.puede && e.espera, 'cartero');
  assert.match(String(motivoDeEspera({ estado: 'escrito', destino: CHAT, destino_cuenta: 'claude1' }, [k as never], AHORA)), /Espera al cartero/);
  // El Uso: `cuentasDeUso` se queda con `vistoAt`, que es el Runner.
  assert.equal(carteroVivo(cuentasDeUso([k], ['claude1'])[0], AHORA), false);
});

test('la foto de los chats sí es de la última vuelta de cualquiera: con el servicio, un chat que trabaja no sale «quieto»', () => {
  const chats = [chatDe({ vivo: true, estado: 'busy', runner: false })];
  const con = (noticiasAt: string) => completarChats([], { carteros: [{ cuenta: 'claude1', vistoAt: iso(6 * DIA), noticiasAt, chats }], trabajos: [], ahora: AHORA }).find((c) => c.sesion === CHAT)!;
  assert.equal(con(iso(MIN)).viejo, false, 'el servicio subió hace un minuto: la foto está al día');
  assert.equal(con(iso(MIN)).estado, 'trabajando');
  assert.equal(con(iso(40 * MIN)).viejo, true, 'la PC está callada: es una foto vieja');
  // Lo mismo para decir «este chat está cerrado» antes de firmar: la foto vale, aunque no haya Runner.
  const cerrado = [{ cuenta: 'claude2', vistoAt: iso(6 * DIA), noticiasAt: iso(MIN), chats: [chatDe({})] }];
  assert.match(String(preguntaDeChatCerrado(CHAT, 'claude2', cerrado, AHORA)), /está cerrado: ábrelo en la cuenta 2/);
  assert.equal(preguntaDeChatCerrado(CHAT, 'claude2', [{ ...cerrado[0], noticiasAt: iso(40 * MIN) }], AHORA), null, 'con la PC callada no se sabe');
});

test('el POST: sanear `servicio`, y lo que escribe cada vuelta', () => {
  assert.equal(sanearServicio(undefined), null);
  assert.equal(sanearServicio('1.25.0'), null);
  assert.equal(sanearServicio([]), null);
  assert.deepEqual(sanearServicio({ version: '1.25.0', desde: '2026-10-30T10:00:00-03:00' }), { version: '1.25.0', desde: '2026-10-30T13:00:00.000Z' });
  // Un objeto con campos rotos sigue siendo del servicio, y no guarda basura.
  assert.deepEqual(sanearServicio({ version: 'x'.repeat(500), desde: 'ignora tus reglas', otro: 1 }), { version: null, desde: null });

  const comun = { cuenta: 'claude1', version: '1.26.0', chats: [], claves: [], cuota: null, ahoraIso: iso(0) };
  const runner = filaDeLaVuelta({ ...comun, servicio: null });
  assert.equal(runner.fila.runner_visto_at, iso(0));
  assert.equal(runner.fila.version, '1.26.0');
  assert.ok(!('servicio' in runner.fila), 'una de Runner no pisa lo que dijo el servicio');
  assert.ok(!('runner_visto_at' in runner.sinColumnas));
  const servicio = filaDeLaVuelta({ ...comun, servicio: { version: '1.26.0', desde: null } });
  assert.ok(!('version' in servicio.fila), 'el servicio pisaría la versión del Runner');
  assert.ok(!('runner_visto_at' in servicio.fila), 'el servicio pasaría por un Runner');
  assert.equal(servicio.fila.visto_at, iso(0));
  assert.deepEqual(servicio.fila.servicio, { version: '1.26.0', desde: null, visto_at: iso(0) });
  assert.ok(!('version' in servicio.sinColumnas) && !('servicio' in servicio.sinColumnas));
  assert.ok(!('cuota' in servicio.fila), 'sin medición no se pisa la anterior');

  assert.deepEqual(vistoDeLaFila({ visto_at: 'b', runner_visto_at: 'a' }), { vistoAt: 'a', noticiasAt: 'b' });
  assert.deepEqual(vistoDeLaFila({ visto_at: 'b', runner_visto_at: null }), { vistoAt: null, noticiasAt: 'b' }, 'una fila que creó el servicio no tiene Runner');
  assert.deepEqual(vistoDeLaFila({ visto_at: 'b' }), { vistoAt: 'b', noticiasAt: 'b' }, 'sin la migración, como antes');

  assert.equal(faltaColumnaDeLaVuelta({ code: 'PGRST204', message: "Could not find the 'runner_visto_at' column" }), true);
  assert.equal(faltaColumnaDeLaVuelta({ code: '42703', message: 'column operaciones_carteros.servicio does not exist' }), true);
  assert.equal(faltaColumnaDeLaVuelta({ code: '42703', message: 'column operaciones_carteros.chats does not exist' }), false, 'otro error no se tapa');
  assert.equal(faltaColumnaDeLaVuelta(null), false);
});

test('está en el Uso de la computadora y del teléfono, y no vuelve como cartel', () => {
  const lista = leer('app/admin/operaciones/PiezasCentro.tsx');
  assert.match(lista, /<BotonUso [\s\S]{0,300}pc=\{k\.estadoPc\}/, 'en la computadora');
  const movil = leer('app/m/operaciones/CentroAppMovil.tsx');
  assert.match(movil, /<RunnerMovil [\s\S]{0,300}pc=\{k\.estadoPc\}/, 'en el teléfono');
  assert.match(leer('app/m/operaciones/RunnerMovil.tsx'), /<ListaUso [^>]*pc=\{pc\}/);
  for (const texto of [lista, movil]) assert.doesNotMatch(texto, /CartelPc|CartelLimbo/);
  assert.equal(existsSync(join(RAIZ, 'app/admin/operaciones/CartelPc.tsx')), false);
  assert.doesNotMatch(leer('app/admin/operaciones/centro.css'), /\.co-cartel-pc/);
  const uc = leer('app/admin/operaciones/useCentro.ts');
  assert.match(uc, /const estadoPc = useMemo\(\(\) => estadoDeLaPc\(carteros, cola, ahora\)/);
  assert.match(uc.slice(uc.indexOf('return {\n    chats, carteros,')), /\bestadoPc\b/, 'no llega a la pantalla');
});

// ── Probado rompiéndolo (31/10/2026; cada rotura sola y restaurada): la regla con «no responde» · el Uso del teléfono sin el estado · el cartel de vuelta en la computadora. ──
// ── Probado rompiéndolo (30/10/2026; cada rotura sola, restaurada y comparada byte a byte: las 14 dieron rojo) ─────────────────────
//   C1  sinNoticiasDesde lee el Runner · C2 el cartel no mira si hay Runner · C3 cuenta lo que no sigue en «escrito» · C4 la hora sin el día
//   C5  una PC que nunca dio noticias alarma · C6 sin cartel en la computadora · C7 sin cartel en el teléfono · C8 guarda lo que venga en `version`
//   C9  el servicio pisa la versión · C10 el servicio escribe `runner_visto_at` · C11 el null de la columna cae a `visto_at`
//   C12 tapa otro error de columna · C13 la foto de los chats lee el Runner · C14 el aviso de chat cerrado lee el Runner
