// =============================================================================
// Los dos carteles de la PC: «no da noticias» y «nadie entrega» (30/10/2026; docs/diseno-cartero-servicio.md §2.2)
// =============================================================================
// El Runner estuvo parado del 24/10 al 30/10 y nadie se enteró: lo único que lo decía era un renglón gris, sólo en la computadora. La
// regla es pura y la calcula MaKo con sus datos. Lo que fija este archivo: cuál cartel va en cada caso, que una vuelta del servicio no hace
// pasar a una cuenta por «con Runner» en ninguna de las preguntas que leen eso, y que los dos carteles están en la computadora Y el teléfono.
//
// Probado rompiéndolo: la tabla al pie. Datos inventados.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cartelDeLaPc, comoSale, completarChats, preguntaDeChatCerrado, sinNoticiasDesde } from '../lib/centro-chats';
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

test('la PC apagada: «no da noticias», con la hora de la última vuelta de cualquiera', () => {
  const c = cartelDeLaPc(apagada, [pedido(7 * DIA)], AHORA)!;
  assert.equal(c.tipo, 'sin_noticias');
  assert.equal(c.texto, 'La PC no da noticias desde las 14:20');
  assert.equal(c.hacer, 'Mira si está prendida y abre el Runner de la cuenta 2.');
  assert.equal(sinNoticiasDesde(apagada, AHORA), AHORA - 40 * MIN);
});

test('una hora sola, de hace días, miente: lleva el día', () => {
  const k = (antes: number) => [{ cuenta: 'claude1', vistoAt: iso(antes), noticiasAt: iso(antes) }];
  assert.equal(cartelDeLaPc(k(DIA), [], AHORA)!.texto, 'La PC no da noticias desde ayer a las 15:00');
  assert.equal(cartelDeLaPc(k(6 * DIA), [], AHORA)!.texto, 'La PC no da noticias desde el 24 oct a las 15:00');
  assert.equal(cartelDeLaPc(k(6 * DIA), [], AHORA)!.hacer, 'Mira si está prendida y abre el Runner.', 'sin pedidos no hay una cuenta que nombrar');
});

test('vueltas sin Runner y un pedido viejo: «nadie entrega», cuántos y de hace cuánto', () => {
  const uno = cartelDeLaPc(sinRunner, [pedido(7 * DIA)], AHORA)!;
  assert.equal(uno.tipo, 'nadie_entrega');
  assert.equal(uno.texto, 'Nadie entrega en la PC: 1 pedido tuyo espera (de hace 7 días)');
  assert.equal(uno.hacer, 'Abre el Runner de la cuenta 2.');
  const varios = cartelDeLaPc(sinRunner, [pedido(2 * DIA, { destino_cuenta: 'claude3' }), pedido(7 * DIA), pedido(20 * MIN, { destino_cuenta: null })], AHORA)!;
  assert.equal(varios.texto, 'Nadie entrega en la PC: 3 pedidos tuyos esperan (el más viejo, de hace 7 días)');
  assert.equal(varios.tipo === 'nadie_entrega' && varios.pedidos, 3);
  assert.equal(varios.cuenta, 'claude2', 'la cuenta del más viejo');
});

test('«nadie entrega» cuenta sólo lo que sigue en «escrito», y sin pedidos igual lo dice', () => {
  const lista = ['tomado', 'entregado', 'no_entregado', 'hecho', 'cancelado'].map((estado) => pedido(DIA, { estado }));
  const c = cartelDeLaPc(sinRunner, lista, AHORA)!;
  assert.equal(c.texto, 'Nadie entrega en la PC');
  assert.equal(c.hacer, 'Abre el Runner.');
  assert.equal(cartelDeLaPc(sinRunner, [{ estado: 'escrito', created_at: 'no es una fecha', destino_cuenta: null }], AHORA)!.texto, 'Nadie entrega en la PC');
});

test('con un Runner dando vueltas, sin cartel, aunque haya pedidos esperando: eso lo dice el cartel del limbo', () => {
  assert.equal(cartelDeLaPc(conRunner, [pedido(7 * DIA)], AHORA), null);
  assert.equal(sinNoticiasDesde(conRunner, AHORA), null);
});

test('sin carteros, o una PC que nunca dio noticias, no se alarma', () => {
  assert.equal(cartelDeLaPc([], [pedido(DIA)], AHORA), null);
  assert.equal(cartelDeLaPc([{ vistoAt: null, noticiasAt: null }], [pedido(DIA)], AHORA), null);
});

test('sin la mig 0355 (`noticiasAt` sin dato): las dos preguntas leen `vistoAt`, como antes', () => {
  assert.equal(cartelDeLaPc([{ vistoAt: iso(MIN) }], [pedido(DIA)], AHORA), null);
  assert.equal(cartelDeLaPc([{ vistoAt: iso(40 * MIN) }], [], AHORA)!.tipo, 'sin_noticias');
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

test('los dos carteles están en la computadora Y el teléfono, una vez y arriba, y el renglón gris ya no', () => {
  const lista = leer('app/admin/operaciones/PiezasCentro.tsx');
  assert.equal(lista.match(/<CartelPc /g)?.length, 1, 'en la lista de la computadora');
  assert.match(lista, /<CartelPc centro=\{k\} conComando \/>/);
  assert.doesNotMatch(lista, /Sin noticias del Runner|sinNoticiasDesde/, 'el renglón gris sigue');
  assert.ok(lista.indexOf('<CartelPc ') < lista.indexOf('<CartelLimbo ') && lista.indexOf('<CartelLimbo ') < lista.indexOf('secciones.map('), 'van arriba de la lista');
  const movil = leer('app/m/operaciones/CentroAppMovil.tsx');
  assert.equal(movil.match(/<CartelPc /g)?.length, 1, 'en el teléfono');
  assert.match(movil, /<CartelPc centro=\{k\} \/>/, 'en el teléfono no hay dónde pegar un comando');
  assert.ok(movil.indexOf('<CartelPc ') < movil.indexOf('<ListaM '), 'arriba de todo');
  assert.match(leer('app/admin/operaciones/useCentro.ts'), /const cartelPc = useMemo\(\(\) => cartelDeLaPc\(carteros, cola, ahora\)/);
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-cartel-pc \{[^}]*var\(--bad\)/, 'en rojo');
});

// ── Probado rompiéndolo (30/10/2026; cada rotura sola, restaurada y comparada byte a byte: las 14 dieron rojo) ─────────────────────
//   C1  sinNoticiasDesde lee el Runner · C2 el cartel no mira si hay Runner · C3 cuenta lo que no sigue en «escrito» · C4 la hora sin el día
//   C5  una PC que nunca dio noticias alarma · C6 sin cartel en la computadora · C7 sin cartel en el teléfono · C8 guarda lo que venga en `version`
//   C9  el servicio pisa la versión · C10 el servicio escribe `runner_visto_at` · C11 el null de la columna cae a `visto_at`
//   C12 tapa otro error de columna · C13 la foto de los chats lee el Runner · C14 el aviso de chat cerrado lee el Runner
