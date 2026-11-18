// =============================================================================
// Cuánto tarda cada ticket, y la alerta a Martín a las 24 h (18/11/2026, la promesa de Martín a Teo)
// =============================================================================
// LO QUE SE CUIDA:
//   1. el rótulo de la Ticketera (`tiempoDelTicket`, lib/tickets-demora.ts): «tardó 5 h» de un cerrado, «lleva 26 h» en rojo del
//      que pasó las 24 h en nuestra cancha, y nada del que espera al cliente ni del abierto de menos de 24 h («hace X» ya lo dice);
//   2. a quién alerta (`paraLaAlerta24h`) y qué le dice a Martín (`textoAlerta24h`): por quién y de qué trata, nunca por número;
//   3. la alerta REAL del cron (`avisarTicketsDeMasDe24h`, tests/_tickets-24h-hijo.ts, sobre un PostgREST de mentira): un ticket de
//      25 h abierto dispara el aviso UNA sola vez; uno de 23 h no (hasta que cruza); uno cerrado no; uno que espera al cliente no;
//      sin poder leer a quién ya se avisó no avisa; y 55 ya avisados no le tapan la vista al que acaba de cruzar;
//   4. la tabla y la tarjeta de la bandeja lo dibujan, y el cron lo llama.
//
// PROBADO ROMPIÉNDOLO (18/11/2026), con el archivo en verde (5 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · `esperando_cliente` dentro de `ESTADOS_QUE_NOS_ESPERAN`                                         → 2 / 3 (1, 2 y 3)
//   · sin el límite de 24 h en `paraLaAlerta24h` (avisa a cualquier abierto)                           → 4 / 1 (2; en el cron real
//     lo sigue frenando el `lte('created_at', …)` de la lectura, que es la segunda capa)
//   · sin filtrar los ya avisados (`!yaAvisados.has`) en `paraLaAlerta24h`                             → 3 / 2 (2 y 3)
//   · la lectura del cron con `ascending: true` (la cola de los ya avisados tapa al nuevo)             → 4 / 1 (3)
//   · sin el `throw` cuando no se puede leer el historial (avisa a ciegas)                             → 4 / 1 (3)
//   · `tiempoDelTicket` devuelve «lleva…» también debajo de las 24 h                                   → 3 / 2 (1 y 4)
//   · la tabla sin el rótulo (el `<span>` de `tiempoDelTicket` sacado)                                  → 4 / 1 (4)
// Correr: node --import tsx --test tests/tickets-24h.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FilaTicket } from '../lib/tickets-db';
import {
  ALERTA_24H_DESDE, ESTADOS_QUE_NOS_ESPERAN, TIPO_ALERTA_24H, duracionCorta, paraLaAlerta24h, textoAlerta24h, tiempoDelTicket,
  type TicketParaAlerta,
} from '../lib/tickets-demora';
import { TablaTickets } from '../app/tickets/bandeja/TablaTickets';
import { TarjetaTicket } from '../app/tickets/bandeja/TarjetaTicket';
import { ORDEN_INICIAL } from '../app/tickets/bandeja/mazo-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const H = 3600_000;
const AHORA = Date.parse('2026-12-01T15:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

/** Un ticket con la forma que devuelve la bandeja. Por defecto, uno de una persona (datos inventados). */
function ticket(p: Partial<FilaTicket> = {}): FilaTicket {
  const t: FilaTicket = {
    id: 501, created_at: iso(AHORA - 26 * H), updated_at: iso(AHORA - 26 * H), workspace_id: 77, usuario_id: 3,
    usuario_email: 'laura@prueba.test', usuario_nombre: 'Laura Gómez', rol: 'admin', plan: 'Completo', tipo: 'bug', tipo_manual: false,
    titulo: 'No se guardan los cambios del funnel', descripcion: 'Moví una etapa y al otro día estaba como antes.', canal: 'formulario',
    contexto: { ruta: '/crm?funnel=3', chat: { donde: 'reportar-problema' } }, estado: 'esperando_decision', prioridad: 'media',
    triage: null, decision: null, decision_nota: null, decidido_at: null, duplicado_de: null, respuesta: null, despacho: null,
    pedido_id: null, despachado_at: null, aviso_estado: null, aviso_intentos: 0, aviso_motivo: null, aviso_at: null,
    arreglado_at: null, arreglo_nota: null, resuelto_at: null, avisado_at: null, negocio: 'Estudio Gómez', foto: null, nota: null,
  };
  return { ...t, ...p };
}

test('1. el rótulo de la Ticketera: cuánto tardó, o cuánto lleva si pasó las 24 h en nuestra cancha', () => {
  assert.equal(duracionCorta(20 * 1000), '1 min', 'menos de un minuto no dice «0 min»');
  assert.equal(duracionCorta(12 * 60_000), '12 min');
  assert.equal(duracionCorta(23.9 * H), '23 h', 'hacia abajo: 23,9 h no dice «24 h» sin haberlas pasado');
  assert.equal(duracionCorta(26 * H), '26 h', 'hasta las 48 h en horas: «ayer» no dice si pasó las 24');
  assert.equal(duracionCorta(75 * H), '3 días');
  // Abierto en nuestra cancha.
  assert.deepEqual(tiempoDelTicket(ticket({ estado: 'nuevo', created_at: iso(AHORA - 25 * H) }), AHORA), { texto: 'lleva 25 h', tono: 'vencido' });
  assert.deepEqual(tiempoDelTicket(ticket({ estado: 'en_curso', created_at: iso(AHORA - 4 * 24 * H) }), AHORA), { texto: 'lleva 4 días', tono: 'vencido' });
  assert.deepEqual(tiempoDelTicket(ticket({ estado: 'arreglado', created_at: iso(AHORA - 30 * H) }), AHORA), { texto: 'lleva 30 h', tono: 'vencido' }, 'arreglado y sin publicar: para el cliente sigue roto');
  assert.equal(tiempoDelTicket(ticket({ estado: 'esperando_decision', created_at: iso(AHORA - 23 * H) }), AHORA), null, 'debajo de las 24 h ya lo dice «hace X»');
  assert.equal(tiempoDelTicket(ticket({ estado: 'esperando_cliente', created_at: iso(AHORA - 5 * 24 * H) }), AHORA), null, 'espera al cliente: no es nuestra demora');
  // Cerrados: cuánto tardó, de `created_at` al cierre.
  assert.deepEqual(tiempoDelTicket(ticket({ estado: 'resuelto', created_at: iso(AHORA - 30 * H), resuelto_at: iso(AHORA - 25 * H) }), AHORA), { texto: 'tardó 5 h', tono: 'ok' });
  assert.deepEqual(tiempoDelTicket(ticket({ estado: 'resuelto', created_at: iso(AHORA - 80 * H), resuelto_at: iso(AHORA - 2 * H) }), AHORA), { texto: 'tardó 3 días', tono: 'tarde' });
  assert.deepEqual(tiempoDelTicket(ticket({ estado: 'rechazado', created_at: iso(AHORA - 3 * H), decidido_at: iso(AHORA - 2 * H) }), AHORA), { texto: 'tardó 1 h', tono: 'ok' }, 'cerrado al decidir: su fecha de decisión');
  assert.equal(tiempoDelTicket(ticket({ estado: 'duplicado', created_at: iso(AHORA - 3 * H) }), AHORA), null, 'cerrado sin fecha: lo que no se midió no se afirma');
  assert.ok(!ESTADOS_QUE_NOS_ESPERAN.includes('esperando_cliente'));
});

test('2. a quién alerta y qué le dice a Martín: por quién y de qué trata, con el estado en sus palabras', () => {
  const t = (id: number, estado: FilaTicket['estado'], horas: number, p: Partial<TicketParaAlerta> = {}): TicketParaAlerta => ({
    id, workspace_id: 77, estado, created_at: iso(AHORA - horas * H), tipo: 'bug', canal: 'formulario', contexto: {}, titulo: `Ticket ${id}`,
    usuario_nombre: 'Laura Gómez', usuario_email: 'laura@prueba.test', negocio: 'Estudio Gómez', ...p,
  });
  const filas = [
    t(1, 'nuevo', 25), t(2, 'esperando_decision', 23), t(3, 'resuelto', 30), t(4, 'esperando_cliente', 30), t(5, 'en_curso', 26),
    t(6, 'nuevo', 25, { created_at: '2026-11-17T12:00:00.000Z' }), t(7, 'arreglado', 48),
  ];
  assert.deepEqual(paraLaAlerta24h(filas, new Set(), AHORA).map((f) => f.id), [7, 5, 1], 'del más viejo al más nuevo; nunca el de 23 h, el cerrado, el que espera al cliente ni el de antes del arranque');
  assert.deepEqual(paraLaAlerta24h(filas, new Set([5, 7]), AHORA).map((f) => f.id), [1], 'el que ya se avisó no vuelve');
  assert.ok(Date.parse('2026-11-17T12:00:00.000Z') < Date.parse(ALERTA_24H_DESDE));
  assert.ok(TIPO_ALERTA_24H.length >= 1 && TIPO_ALERTA_24H.length <= 40, 'ticket_eventos.tipo tiene un CHECK de 1 a 40 (mig 0311)');
  const texto = textoAlerta24h([
    t(1, 'nuevo', 25, { titulo: 'No se guardan los cambios del funnel' }),
    t(5, 'en_curso', 26, { canal: 'sistema', usuario_nombre: 'Ana Pérez', titulo: 'MaKo no pudo «contestarte»', contexto: { chat: { donde: 'error-mako' }, herramienta: 'responder' } }),
  ], AHORA);
  assert.equal(texto, [
    '2 tickets pasaron las 24 h sin resolverse:',
    '• Laura (Estudio Gómez): No se guardan los cambios del funnel · espera tu decisión · lleva 25 h',
    '• Estudio Gómez: MaKo no le pudo contestar a Ana en su chat · en curso · lleva 26 h',
    'Están en la Ticketera.',
  ].join('\n'));
  assert.doesNotMatch(texto, /contestarte|#\d/, 'ni el título que lee el cliente ni el número del ticket');
  assert.match(textoAlerta24h([t(1, 'arreglado', 30)], AHORA), /^Un ticket pasó las 24 h sin resolverse:\n• Laura \(Estudio Gómez\): Ticket 1 · arreglado, sin publicar todavía · lleva 30 h\n/);
  const muchos = textoAlerta24h(Array.from({ length: 11 }, (_, i) => t(i + 1, 'nuevo', 30)), AHORA);
  assert.match(muchos, /^11 tickets pasaron/);
  assert.match(muchos, /\n• y 3 más\nEstán en la Ticketera\.$/, 'ocho renglones y el resto en uno');
});

let cache: Record<string, any> | null = null;
function hijo(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', join(RAIZ, 'tests/_tickets-24h-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
  });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const linea = salida.split('\n').find((l) => l.startsWith('@@24H@@'));
  assert.ok(linea, `el hijo no contestó (${r.status}):\n${salida.slice(-2000)}`);
  cache = JSON.parse(linea.slice('@@24H@@'.length)) as Record<string, any>;
  return cache;
}

test('3. la alerta REAL del cron: 25 h abierto avisa una sola vez; 23 h, cerrado y esperando al cliente no', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.sinMock, [], 'una tabla que el hijo no preparó');
  // El cron de ahora: el de 25 h (nuevo) y el de 26 h (en curso), en UN aviso a Martín (campanita de la plataforma y grupo).
  assert.equal(r.primera.r, 2);
  assert.deepEqual(r.primera.avisados, [201, 205], 'ni el de 23 h (202), ni el resuelto (203), ni el que espera al cliente (204), ni el viejo (206), ni el rechazado (207)');
  assert.equal(r.primera.campanitas.length, 1, 'un aviso por vuelta, no uno por ticket');
  assert.deepEqual(r.primera.campanitas[0], { titulo: '2 tickets pasaron las 24 h sin resolverse', tickets: [205, 201], link: '/admin/operaciones?ticketera=lista', ws: 9 });
  assert.equal(r.grupoWs, 9, 'el grupo es el de la plataforma (el de Martín)');
  assert.match(r.texto, /^2 tickets pasaron las 24 h sin resolverse:\n• Estudio Gómez: MaKo no le pudo contestar a Ana en su chat · en curso · lleva 26 h\n• Laura \(Estudio Gómez\): No se guardan los cambios del funnel · espera tu decisión · lleva 25 h\n/);
  assert.deepEqual(r.renglones.map((e: { ticket: number; actor: string }) => [e.ticket, e.actor]), [[205, 'sistema'], [201, 'sistema']]);
  assert.match(r.renglones[0].texto, /se le avisó a Martín/);
  // Quince minutos después: nada (una sola vez por ticket).
  assert.equal(r.segunda.r, 0);
  assert.deepEqual(r.segunda.campanitas, []);
  assert.deepEqual(r.segunda.avisados, [201, 205], 'sin un renglón más');
  // Cuando el de 23 h cruza, avisa él solo.
  assert.equal(r.tercera.r, 1);
  assert.deepEqual(r.tercera.campanitas.map((c: { tickets: number[] }) => c.tickets), [[202]]);
  // Sin poder leer a quién ya se avisó: no avisa, ni deja el renglón; con el historial de vuelta, una vez.
  assert.match(String(r.sinHistorial.r), /^tiró: /);
  assert.deepEqual(r.sinHistorial.campanitas, []);
  assert.ok(!r.sinHistorial.avisados.includes(208));
  assert.deepEqual(r.conHistorial.campanitas.map((c: { tickets: number[] }) => c.tickets), [[208]]);
  // 55 abiertos ya avisados (más viejos) no tapan al que acaba de cruzar.
  assert.deepEqual(r.conMuchos.campanitas.map((c: { tickets: number[] }) => c.tickets), [[300]]);
});

test('4. la tabla y la tarjeta de la bandeja lo dibujan al lado de «hace X»', () => {
  const vencido = ticket({ id: 601, estado: 'esperando_decision', created_at: iso(AHORA - 26 * H) });
  const reciente = ticket({ id: 602, estado: 'esperando_decision', created_at: iso(AHORA - 3 * H) });
  const cerrado = ticket({ id: 603, estado: 'resuelto', created_at: iso(AHORA - 30 * H), resuelto_at: iso(AHORA - 25 * H) });
  const tabla = (ts: FilaTicket[], grupo: string) => renderToStaticMarkup(createElement(TablaTickets, {
    tickets: ts, ahoraLista: AHORA, grupo, onGrupo: () => {}, orden: ORDEN_INICIAL, setOrden: () => {}, elegido: null, onAbrir: () => {}, barra: null,
  }));
  const decidir = tabla([vencido, reciente], 'decidir');
  assert.match(decidir, /<span class="tickets-bandeja__demora tickets-bandeja__demora--vencido">lleva 26 h<\/span>/);
  assert.equal((decidir.match(/tickets-bandeja__demora/g) ?? []).length, 2, 'sólo el vencido (clase base y modificador de UN rótulo): el reciente no lleva');
  assert.match(tabla([cerrado], 'cerrados'), /tickets-bandeja__demora--ok">tardó 5 h</);
  const carta = renderToStaticMarkup(createElement(TarjetaTicket, { t: vencido, ahora: AHORA }));
  assert.match(carta, /<\/time><span class="tickets-bandeja__demora tickets-bandeja__demora--vencido"> · lleva 26 h<\/span>/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(TarjetaTicket, { t: reciente, ahora: AHORA })), /tickets-bandeja__demora/);
});

test('5. el cron de tickets la llama, aparte, y la regla del color vive en la hoja de la bandeja', () => {
  const ruta = sinComentarios(leer('app/api/cron/tickets/route.ts'));
  assert.match(ruta, /const de24h = await avisarTicketsDeMasDe24h\(\)\.catch\(/, 'aparte: si falla, lo de arriba ya se hizo');
  const css = leer('app/tickets/bandeja/bandeja.css');
  assert.match(css, /\.tickets-bandeja__demora--vencido \{ color: var\(--bad\)/);
  assert.match(css, /\.tickets-bandeja__demora--tarde \{ color: var\(--warn\)/);
});
