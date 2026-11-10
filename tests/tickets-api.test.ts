// =============================================================================
// La Ticketera por la API de MaKo (10/11/2026)
// =============================================================================
// Martín, 9/11/2026: «todo tiene que estar documentado en la API. Por ejemplo, hoy en día en la API ni siquiera se pueden
// levantar tickets, y sí se debería». Desde acá salen por /api/v1: levantar (`POST /mako/tickets`), listar (`GET /mako/tickets`),
// ver uno con su conversación (`GET /mako/tickets/{numero}`) y contestarlo (`POST /mako/tickets/{numero}/comentarios`).
//
// Lo que fija este archivo, por las funciones REALES (tests/_tickets-api-hijo.ts: `aplicarEnElActo` = un token detallado,
// `ejecutarOperacion` = el clásico, `confirmarPendiente` = la bandeja) sobre un PostgREST de mentira:
//   1. un token detallado levanta el ticket en el acto, lo FIRMA LA PERSONA del token y el triage es el de siempre: en el
//      negocio de Leandro entra por su vía libre («Aprobado por regla») y en uno sin regla espera al equipo;
//   2. el nombre del token NO firma, aunque traiga una «@»: sin persona no se crea nada;
//   3. el token clásico PROPONE; por HTTP no se confirma (no hay quién firme) y la pendiente sigue viva; en la bandeja firma
//      quien confirma;
//   4. listar y ver son del negocio entero, sin lo interno del triage, y un número de otro negocio no existe;
//   5. contestar suma el mensaje firmado y devuelve al equipo el que esperaba la respuesta; cerrado o ajeno, no.
//   6. lo puro (`quienPideElTicket`, `ticketParaLaApi`, `pasaElFiltro`) contesta lo mismo que el camino real.
//
// Probado rompiéndolo (10/11/2026, base 7/0):
//   · `quienPideElTicket` devolviendo `ctx.actor` también por HTTP → 5 rojos (el nombre del token firma, y el puro).
//   · sacar `faltaParaConfirmar` de levantar_ticket → 2 rojos (por HTTP se crea el ticket sin nadie que firme).
//   · `ticketDeLaCuenta` sin `.eq('workspace_id', ws)` → 1 rojo (se ve el ticket de otro negocio).
//   · `comentarComoCliente` sin la firma `por` → 1 rojo.
//   · `declaradoPor: 'mako'` también por la API → 0 rojos: el triage pesa distinto, pero la vía libre no depende de eso (esperado).
//   · un renombre neutro (`quien` → `quienEs` en el runner) → verde.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { pasaElFiltro, quienPideElTicket, ticketParaLaApi } from '../lib/tickets-api';

const RAIZ = join(__dirname, '..');

type Escena = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let cache: Map<string, Escena> | null = null;
function escenas(): Map<string, Escena> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', join(RAIZ, 'tests/_tickets-api-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
  });
  if (r.status !== 0) throw new Error(`el hijo salió con ${r.status}: ${r.stderr.slice(-2000)}`);
  cache = new Map();
  for (const l of r.stdout.split('\n')) {
    if (!l.startsWith('@@TICKETS_API@@')) continue;
    const e = JSON.parse(l.slice('@@TICKETS_API@@'.length)) as Escena;
    cache.set(e.nombre, e);
  }
  return cache;
}
const escena = (n: string): Escena => {
  const e = escenas().get(n);
  assert.ok(e, `falta la escena «${n}»`);
  return e;
};

test('las cinco operaciones salen por HTTP, cada una con su ruta REST', () => {
  const ids = ['levantar_ticket', 'mis_tickets', 'listar_tickets', 'ver_ticket', 'responder_ticket'];
  for (const id of ids) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d, `${id} existe`);
    assert.ok((d!.canales as readonly string[]).includes('http'), `${id} sale por HTTP`);
  }
  const rutas = RUTAS_REST.filter(([, ruta]) => ruta.startsWith('/mako/tickets')).map(([m, r, op]) => `${m} ${r} ${op}`).sort();
  assert.deepEqual(rutas, [
    'GET /mako/tickets listar_tickets', 'GET /mako/tickets/mios mis_tickets', 'GET /mako/tickets/{numero} ver_ticket',
    'POST /mako/tickets levantar_ticket', 'POST /mako/tickets/{numero}/comentarios responder_ticket',
  ]);
  // Lo de sólo HTTP no viaja al chat: el turno ya tiene mis_tickets, y el presupuesto de herramientas es de 12.000 caracteres.
  for (const id of ['listar_tickets', 'ver_ticket', 'responder_ticket']) {
    assert.deepEqual([...REGISTRO.find((x) => x.id === id)!.canales], ['http'], `${id} es sólo de HTTP`);
  }
});

test('1. un token detallado levanta el ticket en el acto, firmado por su persona, con la vía libre del negocio', () => {
  const e = escena('detallado');
  assert.equal(e.r.ok, true, JSON.stringify(e.r));
  assert.equal(e.ticket.usuario_email, 'duena@fiesta-ficticia.com', 'lo firma quien creó el token');
  assert.equal(e.ticket.canal, 'api');
  assert.equal(e.ticket.estado, 'en_curso');
  assert.equal(e.ticket.despacho, 'runner');
  assert.equal(e.ticket.regla, 'Leandro', 'Aprobado por regla: Leandro');
  assert.equal(e.r.datos.aprobadoPorRegla, 'Leandro');
  assert.equal(e.r.datos.numero, `#${e.r.datos.ticketId}`);
  assert.match(e.r.resumen, /vía libre de tu negocio \(Leandro\)/);
  assert.equal(e.ticket.contexto.chat, undefined, 'por HTTP no hay un hilo al que avisarle');
  // Sin regla: espera al equipo.
  const s = escena('sin-regla');
  assert.equal(s.r.ok, true);
  assert.equal(s.estado, 'esperando_decision');
  assert.equal(s.r.datos.aprobadoPorRegla, null);
  assert.match(s.r.resumen, /lo deciden y te contestan en el ticket/);
});

test('2. el NOMBRE del token no firma, aunque traiga una «@»', () => {
  const e = escena('nombre-con-arroba');
  assert.equal(e.r.ok, false);
  assert.equal(e.tickets, 0, 'no se creó ningún ticket');
  assert.deepEqual(e.pendientes, ['pendiente'], 'queda viva para que la confirme una persona');
});

test('3. el token clásico propone; por HTTP no confirma; en la bandeja firma quien confirma', () => {
  const e = escena('clasico');
  assert.equal(e.r.ok, true);
  assert.equal(e.r.tipo, 'pendiente');
  assert.match(e.r.pendiente.resumen, /lo firma quien lo confirme/);
  assert.equal(e.payload.email, undefined, 'la propuesta no inventa quién la pidió');
  assert.match(e.confirmaPorHttp.error, /no sé quién eres/);
  assert.deepEqual(e.trasHttp, { estado: 'pendiente', tickets: 0 }, 'la pendiente sigue viva para quien sí puede confirmarla');
  assert.equal(e.confirmaEnBandeja.ok, true, JSON.stringify(e.confirmaEnBandeja));
  assert.equal(e.ticket.usuario_email, 'duena@fiesta-ficticia.com');
  assert.equal(e.ticket.estado, 'en_curso');
});

test('4. listar y ver: el negocio entero, sin lo interno, y nada de otro negocio', () => {
  const e = escena('leer-y-contestar');
  assert.equal(e.lista.ok, true);
  assert.deepEqual(e.lista.tickets.map((t: Escena) => t.numero), ['#21', '#22', '#23'], 'los tres del negocio, el de otro no');
  const t21 = e.lista.tickets[0];
  assert.equal(t21.estado, 'tu_respuesta');
  assert.equal(t21.aprobadoPorRegla, 'Leandro');
  assert.equal(t21.tuyo, true);
  assert.equal(e.lista.tickets[1].levantadoPor, 'Beto Cierra');
  assert.equal(e.lista.tickets[1].tuyo, undefined);
  assert.match(e.lista.tickets[2].levantadoPor, /^MaKo/, 'el que abrió MaKo solo lo dice');
  assert.deepEqual(e.abiertos.tickets.map((t: Escena) => t.numero), ['#21', '#23']);
  assert.equal(e.abiertos.tickets[0].tuyo, undefined, 'con el token clásico no se sabe de quién es');
  const v = e.ver.ticket;
  assert.equal(v.numero, '#21');
  assert.ok(Array.isArray(v.conversacion) && v.conversacion.some((l: Escena) => l.texto === '¿En qué tarjeta?'), 'trae lo que preguntó el equipo');
  const todo = JSON.stringify(e.lista) + JSON.stringify(e.ver);
  assert.doesNotMatch(todo, /NOTA INTERNA DEL TRIAGE|Aprobado por regla"|porque|confianza|secreto/, 'nada del triage ni de otro negocio');
  assert.doesNotMatch(todo, /@fiesta-ficticia\.com/, 'los emails del equipo no salen');
  assert.equal(e.ajeno.ok, false);
  assert.equal(e.ajeno.status, 400);
  assert.match(e.ajeno.error, /No encuentro el ticket #40/);
});

test('5. contestar: firmado, y vuelve al equipo; cerrado o ajeno, no', () => {
  const e = escena('leer-y-contestar');
  assert.equal(e.resp.ok, true, JSON.stringify(e.resp));
  assert.equal(e.estado21, 'esperando_decision', 'el que esperaba la respuesta vuelve a la bandeja del equipo');
  assert.equal(e.comentario.texto, 'En la de Instagram del Reel.');
  assert.deepEqual(e.comentario.datos, { por: 'duena@fiesta-ficticia.com' }, 'se sabe quién contestó');
  assert.equal(e.cerrado.ok, false);
  assert.match(e.cerrado.resumen, /ya está cerrado/);
  assert.equal(e.deOtro.ok, false);
  assert.equal(e.eventos40, 0, 'el ticket de otro negocio no se tocó');
});

test('6. lo puro: quién pide por canal, el filtro y lo que sale de una fila', () => {
  assert.equal(quienPideElTicket({ canal: 'app', actor: 'ana@x.com' }), 'ana@x.com');
  assert.equal(quienPideElTicket({ canal: 'whatsapp', actor: 'whatsapp:+525511112222' }), 'whatsapp:+525511112222');
  assert.equal(quienPideElTicket({ canal: 'http', actor: 'API · token «ana@x.com»' }), null, 'el nombre del token no firma');
  assert.equal(quienPideElTicket({ canal: 'http', actor: 'API · token «x»', persona: 'Ana@X.com' }), 'ana@x.com');
  assert.equal(pasaElFiltro('esperando_cliente', 'abiertos'), true);
  assert.equal(pasaElFiltro('resuelto', 'abiertos'), false);
  assert.equal(pasaElFiltro('duplicado', 'cerrados'), true);
  const base = {
    id: 5, titulo: 't', descripcion: 'd', tipo: 'bug' as const, estado: 'en_curso' as const, created_at: '2026-11-10T00:00:00Z', updated_at: '2026-11-10T00:00:00Z',
    respuesta: null, despacho: 'runner', decidido_at: null, resuelto_at: null, duplicado_de: null,
  };
  // La regla sólo cuenta si el triage la mandó al arreglo: una regla con `autoArreglo: false` (lo delicado) no es vía libre.
  const conRegla = { ...base, triage: { v: 1 as const, tipo: 'bug' as const, autoArreglo: true, regla: 'Leila', confianza: 'media' as const, prioridad: 'media' as const, porque: [] } };
  assert.equal(ticketParaLaApi(conRegla).aprobadoPorRegla, 'Leila');
  assert.equal(ticketParaLaApi({ ...conRegla, triage: { ...conRegla.triage, autoArreglo: false } }).aprobadoPorRegla, null);
  assert.equal(ticketParaLaApi({ ...base, usuario_email: 'whatsapp:+525511112222' }).levantadoPor, 'Alguien por WhatsApp');
  assert.equal(ticketParaLaApi(base).conversacion, undefined, 'el detalle va sólo con conDetalle');
});
