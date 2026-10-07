// =============================================================================
// calendly-error — el webhook de Calendly contesta 5xx SÓLO a lo que se arregla reintentando
// =============================================================================
// Ejecuta el clasificador (lib/calendly-error.ts → `esErrorTransitorio`) sobre errores MEDIDOS y
// fija con guards, sobre el route SIN comentarios, que ningún catch del despacho pueda volver a
// contestar un 5xx sin pasar por él. El porqué: Calendly, ante un no-2xx, reintenta un par de días
// y DESHABILITA la suscripción entera; los catch contestaban 500 a todo y un solo evento que falla
// siempre la apagó dos veces (11/09 y 21/09/2026). Ver docs/hallazgos-infra.md → «Y se murió OTRA
// VEZ…» y AGENTS.md → «UN WEBHOOK CONTESTA 5xx SÓLO A LO QUE SE ARREGLA REINTENTANDO».
//
// LAS MEDICIONES (06/10/2026, node 24.17, supabase-js / postgrest-js 2.106.1). Tres fuentes:
//   · EN VIVO, en este mismo test: fetch y supabase-js contra un server LOCAL (puerto cerrado,
//     respuesta lenta, una fila de más, el cuerpo de Cloudflare). Si una versión nueva de undici o
//     de postgrest-js cambia la forma de sus errores, esto lo dice en la próxima corrida.
//   · El pooler (sólo lectura, una vez): `select leads.nope …` (42703), `set local
//     statement_timeout = 50; select pg_sleep(1)` (57014) y `'no-es-numero'::bigint` (22P02). Los
//     objetos de abajo son copia de lo que devolvió el driver `postgres`.
//   · Documentados, NO medidos —provocarlos exige tumbar la base o hacer un UPDATE—: van marcados
//     como tales al lado de cada caso.
//
// Probado ROMPIÉNDOLO (06/10/2026) con un arnés que rompe, corre y restaura DE MEMORIA (nunca con
// git checkout), verificando que cada archivo volviera idéntico byte a byte. Sin romper: 12 pass /
// 0 fail. Las 19 roturas cayeron, cada una en el test que la persigue:
//   EN EL ROUTE
//   · la rama J2 con el `{ status: 500 }` viejo → 10 / 2 (el 5xx fuera del clasificador y el catch).
//   · la cancelación con el `{ status: 500 }` viejo → 10 / 2 (ídem).
//   · la rama J1 relanzando (`throw err`, un 500 de Next) → 11 / 1.
//   · `if (!esErrorTransitorio(err))`, el clasificador negado → 11 / 1.
//   · lo no transitorio contestando `{ status: 500 }` → 11 / 1.
//   · sin la red de afuera de `runWithWorkspace` → 11 / 1.
//   · anotar leyendo con `getSetting` en vez del estricto → 11 / 1.
//   EN EL CLASIFICADOR Y LA HUELLA
//   · todo transitorio → 9 / 3; nada transitorio → 9 / 3 (los dos caen también EN VIVO).
//   · el código HTTP como número SUELTO (`\b5\d\d\b`) → 11 / 1 (el id del lead 503/504/429).
//   · sin la regla de lo DETERMINISTA → 11 / 1 (los headers de 40 KB y el puerto prohibido).
//   · sin «fetch failed» → 10 / 2 (y cae EN VIVO); sin el timeout → 10 / 2 (ídem).
//   · «schema cache» suelta en vez de la frase de PGRST002 → 11 / 1 (PGRST204 pasaba a reintento).
//   · sin bajar a los `errors` del AggregateError → 11 / 1; `status` sin bajar a la causa → 11 / 1;
//     sin los SQLSTATE → 11 / 1.
//   · la huella sin tope → 11 / 1; sin sanear las entradas rotas → 11 / 1.
//
// Y LA SEGUNDA TANDA (06/10/2026 a la noche: el ruteo estricto, el cuerpo cortado, el gateway sin
// cuerpo, nginx y la firma). Mismo arnés. Sin romper: 15 pass / 0 fail. Las 12 cayeron:
//   · sin `terminated` → 13 / 2 (y cae EN VIVO); `terminated` sin borde de palabra → 14 / 1.
//   · sin «Temporarily» → 13 / 2 (ídem); sin la regla de la cola vacía → 13 / 2 (ídem).
//   · la cola vacía sin el `$` → 13 / 2: «…por email: JSON object requested…» pasaba a reintento.
//   · la firma comparando caracteres en vez de bytes → 14 / 1.
//   · el ruteo con `wsPorIdentificador`, contestando con otra rama, o sin el tope de largo; la key
//     de firma o la R1 con `credWs`; la rama ruteo anotada sin el super admin → 14 / 1 cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  esErrorTransitorio, mensajeDeError, huellaFallosPrevia, sumarFalloProceso, uuidDeUri,
  KEY_FALLOS_PROCESO, TOPE_FALLOS_PROCESO, type FalloProceso,
} from '../lib/calendly-error';
import { verifyCalendlySignature, CalendlySignatureError } from '../lib/calendly';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas `//` PRIMERO y los bloques después: un `/*` adentro de un comentario de línea abriría
// un bloque que se come el código del medio (AGENTS.md).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que hay entre la llave que abre en `i` y la que la cierra (cuenta llaves; las del código del route están balanceadas). */
function cuerpoDeLlave(src: string, i: number): string {
  assert.equal(src[i], '{', `en ${i} no abre una llave: «${src.slice(i, i + 20)}»`);
  let prof = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') prof++;
    else if (src[j] === '}' && --prof === 0) return src.slice(i + 1, j);
  }
  throw new Error(`la llave de ${i} no cierra`);
}

/** El bloque de una función: desde su firma hasta la llave que cierra su cuerpo. */
function funcion(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const llave = src.indexOf('{', src.indexOf(')', i + firma.length));
  return src.slice(i, llave) + '{' + cuerpoDeLlave(src, llave) + '}';
}

// ── Los casos medidos ────────────────────────────────────────────────────────

/** Un error de `postgres` (el driver de los scripts), como lo devolvió el pooler. */
const pg = (message: string, code: string) => Object.assign(new Error(message), { name: 'PostgresError', code });
/** Un TypeError de undici con su causa, como lo tira `fetch`. */
const fetchFallido = (cause: object) => Object.assign(new TypeError('fetch failed'), { cause });

const TRANSITORIOS: Array<[string, unknown]> = [
  // La base inalcanzable, como llega al catch: lib/leads.ts envuelve SÓLO el mensaje.
  ['supabase sin base, envuelto por lib/leads (medido)', new Error('Error buscando lead por email: TypeError: fetch failed')],
  ['el error CRUDO de supabase-js, ECONNREFUSED (medido)', {
    message: 'TypeError: fetch failed', hint: '', code: '',
    details: 'TypeError: fetch failed\n\nCaused by: Error: connect ECONNREFUSED 127.0.0.1:62495 (ECONNREFUSED)',
  }],
  ['socket cortado a mitad de la respuesta (medido)', {
    message: 'TypeError: fetch failed', hint: '', code: '',
    details: 'TypeError: fetch failed\n\nCaused by: SocketError: other side closed (UND_ERR_SOCKET)',
  }],
  // El cuerpo cortado a la MITAD (los headers ya salieron): el crudo trae «other side closed» en
  // `details`, pero lib/leads.ts envuelve sólo el `message`, que dice «TypeError: terminated».
  // Hasta el 06/10/2026 esto daba false: un fallo de red real se contestaba 200 y se perdía.
  ['cuerpo cortado a la mitad, envuelto por lib/leads (medido EN VIVO abajo)', new Error('Error buscando lead por email: TypeError: terminated')],
  // Un gateway que contesta SIN cuerpo: postgrest-js deja `message: ''` y el envoltorio queda con
  // la cola vacía (el status se perdió en el camino). Ídem: daba false.
  ['un gateway sin cuerpo, envuelto por lib/leads (medido EN VIVO abajo)', new Error('Error buscando lead por email: ')],
  ['un gateway sin cuerpo, como lo arma el ruteo estricto (medido EN VIVO abajo)', Object.assign(new Error('webhook_routing (calendly): '), { code: undefined })],
  ['el ruteo estricto con la base caída (la forma de wsPorIdentificadorEstricto)', Object.assign(new Error('webhook_routing (calendly): TypeError: fetch failed'), {
    code: '', hint: '', details: 'TypeError: fetch failed\n\nCaused by: Error: connect ECONNREFUSED 127.0.0.1:62495 (ECONNREFUSED)',
  })],
  // La página de nginx dice «Service TEMPORARILY Unavailable»: la frase corta no la cubría.
  ['nginx 503 en HTML, «Temporarily» (medido EN VIVO abajo)', {
    message: '<html>\r\n<head><title>503 Service Temporarily Unavailable</title></head>\r\n<body>\r\n<center><h1>503 Service Temporarily Unavailable</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n',
  }],
  ['fetch crudo: ::1 y 127.0.0.1 rebotan, AggregateError sin mensaje (medido)', fetchFallido({
    name: 'AggregateError', message: '', code: 'ECONNREFUSED',
    errors: [{ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED ::1:60746' }, { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:60746' }],
  })],
  // Derivado del anterior: la causa manda aunque el mensaje de afuera no diga nada de red.
  ['la causa anidada manda aunque el mensaje de afuera sea mudo', {
    message: 'falló el pedido',
    cause: { name: 'AggregateError', message: '', errors: [{ message: 'connect ECONNREFUSED ::1:60746' }] },
  }],
  ['fetch crudo: DNS (medido)', fetchFallido({ name: 'Error', message: 'getaddrinfo ENOTFOUND no-existe-mako.invalid', code: 'ENOTFOUND' })],
  ['fetch con AbortSignal.timeout (medido)', Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError', code: 23 })],
  ['supabase-js con abortSignal vencido (medido)', { message: 'TimeoutError: The operation was aborted due to timeout', details: 'TimeoutError: The operation was aborted due to timeout', code: '' }],
  ['PGRST003, sin conexión libre en el pool (forma medida por supabase-js)', { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool.', details: null }],
  ['PGRST003 envuelto por lib/leads', new Error('Error actualizando lead 12: Timed out acquiring connection from connection pool.')],
  ['el gateway de Cloudflare: 522 como cuerpo (forma medida por supabase-js)', { message: 'error code: 522' }],
  ['el gateway de Cloudflare: 502 en HTML (forma medida por supabase-js)', {
    message: '<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>cloudflare</center>\r\n</body>\r\n</html>\r\n',
  }],
  ['Envoy 503 (forma medida por supabase-js)', { message: 'upstream connect error or disconnect/reset before headers. reset reason: connection failure' }],
  ['statement timeout por el pooler (medido)', pg('canceling statement due to statement timeout', '57014')],
  ['statement timeout envuelto por lib/leads', new Error('Error seteando fecha_junta_2 en lead 7: canceling statement due to statement timeout')],
  // Documentados (no medidos: hace falta tumbar la base para verlos).
  ['57P01 la base se reinicia (documentado)', pg('terminating connection due to administrator command', '57P01')],
  ['53300 sin conexiones (documentado), envuelto', new Error('Error creando lead desde Calendly: sorry, too many clients already')],
  ['40P01 deadlock (documentado), envuelto', new Error('Error actualizando lead 3: deadlock detected')],
  ['sólo el SQLSTATE, sin frase', { code: '08006', message: 'algo' }],
  // Proveedores, con las formas que arman las libs del repo (`HTTP ${status}`, `Chatwoot ${status}: …`).
  ['HTTP 503', new Error('HTTP 503: Service Unavailable')],
  ['HTTP 429', new Error('HTTP 429: rate limited')],
  ['Chatwoot 502', new Error('Chatwoot 502: <html>…')],
  ['Fathom 503 en …', new Error('Fathom 503 en /meetings: upstream')],
  ['Meta sin JSON (HTTP 500)', new Error('Respuesta no-JSON de Meta (HTTP 500)')],
  ['un status numérico 503', Object.assign(new Error('x'), { status: 503 })],
  ['un status 504 en la causa', { message: 'x', cause: { statusCode: 504 } }],
];

const NO_TRANSITORIOS: Array<[string, unknown]> = [
  // ⚠️ El caso que más importa: findLeadByContacto con DOS leads del mismo email falla SIEMPRE.
  ['maybeSingle con dos filas, PGRST116, envuelto (medido)', new Error('Error buscando lead por email: JSON object requested, multiple (or no) rows returned')],
  ['una columna que no existe, por el pooler (medido)', pg('column leads.nope does not exist', '42703')],
  ['una columna que no existe, de PostgREST (forma medida)', { code: '42703', message: 'column leads.nope does not exist', details: null }],
  ['un tipo que no cierra, por el pooler (medido)', pg('invalid input syntax for type bigint: "no-es-numero"', '22P02')],
  ['isoToFechaTijuana con basura (lib/calendly.ts)', new Error('ISO timestamp inválido: mañana')],
  ['upsertLeadFromCalendly sin email (lib/leads.ts)', new Error('Email inválido en payload de Calendly')],
  ['un TypeError del CÓDIGO (medido): el nombre no alcanza', Object.assign(new TypeError("Cannot read properties of undefined (reading 'x')"))],
  ['headers de 40 KB: fetch failed DETERMINISTA (medido)', {
    message: 'TypeError: fetch failed', code: '', hint: 'HTTP headers exceeded server limits (typically 16KB)',
    details: 'TypeError: fetch failed\n\nCaused by: HeadersOverflowError: Headers Overflow Error (UND_ERR_HEADERS_OVERFLOW)',
  }],
  ['un puerto que undici prohíbe (medido)', fetchFallido({ name: 'Error', message: 'bad port' })],
  // ⚠️ La trampa del número suelto: lib/leads.ts mete el id del lead en el mensaje.
  ['el id del lead es 503', new Error('Error actualizando lead 503: duplicate key value violates unique constraint "leads_email_key"')],
  ['el id del lead es 504', new Error('Lead 504 no existe')],
  ['el id del lead es 429', new Error('Error cancelando fecha_junta_1 en lead 429: new row violates row-level security policy for table "leads"')],
  // PGRST204: un deploy antes de su migración. Falla igual en cada reintento (documentado).
  ['PGRST204, «in the schema cache» sin ser PGRST002 (documentado)', new Error("Error actualizando lead 9: Could not find the 'junta_1_url' column of 'leads' in the schema cache")],
  ['sólo el SQLSTATE de un dato (23505)', { code: '23505', message: 'duplicate key value violates unique constraint "leads_email_key"' }],
  ['HTTP 400', new Error('HTTP 400: Invalid parameter')],
  ['Chatwoot 404', new Error('Chatwoot 404: Resource could not be found')],
  ['un status numérico 404', Object.assign(new Error('x'), { status: 404 })],
  // El borde de palabra de `terminated`: un JSON roto que arma el CÓDIGO no es un socket cortado.
  ['«Unterminated» de un JSON.parse del código no es un socket', new SyntaxError('Unterminated string in JSON at position 12')],
  // La cola vacía se mira sobre el MENSAJE de afuera: un Error sin mensaje no es un gateway mudo,
  // y un mensaje con contenido después de los dos puntos tampoco.
  ['un Error sin mensaje', new Error('')],
  ['dos puntos con contenido después', new Error('Error buscando lead por email: JSON object requested, multiple (or no) rows returned')],
  ['null', null],
  ['undefined', undefined],
  ['un string cualquiera', 'algo raro'],
  ['un objeto vacío', {}],
];

test('el clasificador: lo que se arregla REINTENTANDO es transitorio', () => {
  for (const [nombre, e] of TRANSITORIOS) {
    assert.equal(esErrorTransitorio(e), true, `debería ser TRANSITORIO (503): ${nombre}`);
  }
});

test('el clasificador: lo que va a fallar igual NO es transitorio (200 y anotado)', () => {
  for (const [nombre, e] of NO_TRANSITORIOS) {
    assert.equal(esErrorTransitorio(e), false, `NO debería ser transitorio: ${nombre}`);
  }
});

test('el clasificador nunca lanza: una cadena de causas cíclica y un getter que tira', () => {
  const ciclo: Record<string, unknown> = { message: 'x' };
  ciclo.cause = ciclo;
  assert.equal(esErrorTransitorio(ciclo), false);
  const traicionero = { get message(): string { throw new Error('boom'); }, code: 'ECONNRESET' };
  assert.equal(esErrorTransitorio(traicionero), true, 'el getter que tira se saltea y el code se sigue leyendo');
  assert.equal(mensajeDeError(traicionero).length > 0, true);
});

// ── En vivo: las formas de hoy, contra un server local ───────────────────────

test('EN VIVO: fetch y supabase-js contra un server local dan la forma que el clasificador espera', async () => {
  // Un puerto CERRADO de verdad: se abre, se anota y se cierra.
  const s0 = http.createServer();
  await new Promise<void>((r) => s0.listen(0, '127.0.0.1', () => r()));
  const cerrado = (s0.address() as { port: number }).port;
  await new Promise<void>((r) => s0.close(() => r()));

  const srv = http.createServer((req, res) => {
    const p = req.url ?? '';
    if (p.includes('/dos')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('[{"id":1},{"id":2}]'); return; }
    if (p.includes('/cf522')) { res.writeHead(522, { 'content-type': 'text/plain' }); res.end('error code: 522'); return; }
    if (p.includes('/lento')) { setTimeout(() => { try { res.writeHead(200); res.end('[]'); } catch { /* ya cortó */ } }, 1500); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('[]');
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const port = (srv.address() as { port: number }).port;
  const cliente = (base: string) => createClient(base, 'k', { auth: { persistSession: false } });
  try {
    // 1) La base inalcanzable: el error crudo, y como llega envuelto por lib/leads.
    const r1 = await cliente(`http://127.0.0.1:${cerrado}`).from('leads').update({ a: 1 }).eq('id', 1);
    assert.ok(r1.error, 'supabase-js contra un puerto cerrado tiene que devolver un error');
    assert.equal(esErrorTransitorio(r1.error), true, `crudo: ${JSON.stringify(r1.error).slice(0, 200)}`);
    assert.equal(esErrorTransitorio(new Error(`Error actualizando lead 503: ${r1.error.message}`)), true, 'envuelto, con un id que parece un 5xx');

    // 2) fetch pelado al mismo puerto.
    let e2: unknown = null;
    try { await fetch(`http://127.0.0.1:${cerrado}/`); } catch (e) { e2 = e; }
    assert.ok(e2, 'fetch a un puerto cerrado tiene que tirar');
    assert.equal(esErrorTransitorio(e2), true, `fetch: ${mensajeDeError(e2)}`);

    // 3) Un timeout del lado del cliente.
    let e3: unknown = null;
    try { await fetch(`http://127.0.0.1:${port}/lento`, { signal: AbortSignal.timeout(50) }); } catch (e) { e3 = e; }
    assert.ok(e3, 'el AbortSignal.timeout tiene que cortar');
    assert.equal(esErrorTransitorio(e3), true, `timeout: ${mensajeDeError(e3)}`);

    // 4) maybeSingle con DOS filas: PGRST116, que se repite en cada reintento.
    const r4 = await cliente(`http://127.0.0.1:${port}/dos`).from('leads').select('id').eq('email', 'x').maybeSingle();
    assert.equal(r4.error?.code, 'PGRST116');
    assert.equal(esErrorTransitorio(r4.error), false, 'dos leads con el mismo email no se arreglan reintentando');
    assert.equal(esErrorTransitorio(new Error(`Error buscando lead por email: ${r4.error?.message}`)), false);

    // 5) El gateway contestando con su propio cuerpo (PATCH: postgrest-js sólo reintenta GET solo).
    const r5 = await cliente(`http://127.0.0.1:${port}/cf522`).from('leads').update({ a: 1 }).eq('id', 1);
    assert.equal(r5.error?.message, 'error code: 522');
    assert.equal(esErrorTransitorio(new Error(`Error actualizando lead 9: ${r5.error?.message}`)), true);
  } finally {
    srv.closeAllConnections();
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

test('EN VIVO: el cuerpo cortado a la mitad, el gateway sin cuerpo y nginx (lo que el 06/10 se perdía con 200)', async () => {
  const srv = http.createServer((req, res) => {
    const p = req.url ?? '';
    if (p.includes('/cortado')) {
      // Los headers salen, medio cuerpo sale, y el socket se corta.
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': '1000' });
      res.write('[{"id":1,"email":"x');
      setTimeout(() => res.socket?.destroy(), 20);
      return;
    }
    if (p.includes('/vacio502')) { res.writeHead(502); res.end(); return; }
    if (p.includes('/nginx503')) {
      res.writeHead(503, { 'content-type': 'text/html' });
      res.end('<html>\r\n<head><title>503 Service Temporarily Unavailable</title></head>\r\n<body>\r\n<center><h1>503 Service Temporarily Unavailable</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('[]');
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const port = (srv.address() as { port: number }).port;
  const cliente = (base: string) => createClient(base, 'k', { auth: { persistSession: false } });
  const comoRuteo = (e: { message: string; code?: string; details?: string; hint?: string }) =>
    Object.assign(new Error(`webhook_routing (calendly): ${e.message}`), { code: e.code, details: e.details, hint: e.hint });
  try {
    // 1) El cuerpo cortado: la forma de hoy, cruda y como llega envuelta.
    const r1 = await cliente(`http://127.0.0.1:${port}/cortado`).from('leads').select('id').eq('email', 'x').maybeSingle();
    assert.equal(r1.error?.message, 'TypeError: terminated', `crudo: ${JSON.stringify(r1.error).slice(0, 200)}`);
    assert.equal(esErrorTransitorio(r1.error), true, 'crudo');
    assert.equal(esErrorTransitorio(new Error(`Error buscando lead por email: ${r1.error?.message}`)), true,
      'envuelto por lib/leads, que pierde el `details`: sólo queda «terminated»');
    assert.equal(esErrorTransitorio(comoRuteo(r1.error!)), true, 'como lo arma el ruteo estricto');
    let e1: unknown = null;
    try { await (await fetch(`http://127.0.0.1:${port}/cortado`)).text(); } catch (e) { e1 = e; }
    assert.ok(e1, 'el body cortado tiene que tirar al leerlo');
    assert.equal(esErrorTransitorio(e1), true, `fetch: ${mensajeDeError(e1)}`);

    // 2) El gateway sin cuerpo: el status no viaja en el error, y el mensaje queda vacío.
    const r2 = await cliente(`http://127.0.0.1:${port}/vacio502`).from('leads').select('id').eq('email', 'x').maybeSingle();
    assert.equal(r2.status, 502);
    assert.equal(r2.error?.message, '', `crudo: ${JSON.stringify(r2.error)}`);
    assert.equal(esErrorTransitorio(new Error(`Error buscando lead por email: ${r2.error?.message}`)), true, 'envuelto: la cola vacía');
    assert.equal(esErrorTransitorio(comoRuteo(r2.error!)), true, 'como lo arma el ruteo estricto');

    // 3) nginx: «Service Temporarily Unavailable», envuelto.
    const r3 = await cliente(`http://127.0.0.1:${port}/nginx503`).from('leads').update({ a: 1 }).eq('id', 1);
    assert.match(r3.error?.message ?? '', /Service Temporarily Unavailable/);
    assert.equal(esErrorTransitorio(new Error(`Error actualizando lead 7: ${r3.error?.message}`)), true);
  } finally {
    srv.closeAllConnections();
    await new Promise<void>((r) => srv.close(() => r()));
  }
});

// ── La firma: una mala es un 401, nunca un 500 ───────────────────────────────

test('la firma: un v1 con caracteres de más de un byte es una firma MALA, no un RangeError', () => {
  const t = Math.floor(Date.now() / 1000);
  const cuerpo = '{"event":"invitee.created"}';
  const key = 'secreto-de-prueba';
  // 'ñ' × 64: 64 caracteres —lo que mide el hex esperado— y 128 bytes. Comparando caracteres,
  // timingSafeEqual recibía dos Buffers de distinto largo y tiraba RangeError: un 500 de Next.
  assert.throws(() => verifyCalendlySignature(cuerpo, `t=${t},v1=${'ñ'.repeat(64)}`, key), CalendlySignatureError);
  // La buena sigue pasando (para que el anterior no dé verde porque TODO tira).
  const v1 = createHmac('sha256', key).update(`${t}.${cuerpo}`).digest('hex');
  assert.doesNotThrow(() => verifyCalendlySignature(cuerpo, `t=${t},v1=${v1}`, key));
  assert.throws(() => verifyCalendlySignature(cuerpo, `t=${t},v1=${v1.replace(/.$/, (c) => (c === '0' ? '1' : '0'))}`, key), CalendlySignatureError);
});

// ── La huella `calendly.fallos_proceso` ──────────────────────────────────────

const fallo = (n: number, extra: Partial<FalloProceso> = {}): FalloProceso => ({
  cuando: new Date(Date.UTC(2026, 9, 6, 12, 0, n)).toISOString(),
  evento: 'invitee.canceled',
  rama: 'cancelacion',
  uuid: `ev-${n}`,
  email: `lead${n}@x.com`,
  mensaje: `falló ${n}`,
  ...extra,
});

test('la huella: suma, topea dejando los MÁS RECIENTES y cuenta el total', () => {
  let h = huellaFallosPrevia(null);
  for (let n = 0; n < TOPE_FALLOS_PROCESO + 7; n++) h = sumarFalloProceso(h, fallo(n));
  assert.equal(h.ultimos.length, TOPE_FALLOS_PROCESO, 'una huella, no un log: topea');
  assert.equal(h.veces, TOPE_FALLOS_PROCESO + 7, 'el total sigue contando lo que el tope sacó');
  assert.equal(h.ultimos[0].uuid, `ev-${TOPE_FALLOS_PROCESO + 6}`, 'el más reciente primero');
  assert.equal(h.ultimos.at(-1)?.uuid, 'ev-7', 'lo que se va es lo más VIEJO');
  assert.equal(h.cuando, fallo(TOPE_FALLOS_PROCESO + 6).cuando);
  // Ida y vuelta por el setting.
  const releida = huellaFallosPrevia(JSON.stringify(h));
  assert.deepEqual(releida, h);
});

test('la huella: el orden sale de `cuando`, no de cómo venía guardada', () => {
  const desordenada = JSON.stringify({ cuando: 'x', veces: 2, ultimos: [fallo(1), fallo(5)] });
  const h = sumarFalloProceso(huellaFallosPrevia(desordenada), fallo(3));
  assert.deepEqual(h.ultimos.map((f) => f.uuid), ['ev-5', 'ev-3', 'ev-1']);
});

test('la huella: lo ilegible arranca de cero y las entradas rotas se descartan', () => {
  assert.deepEqual(huellaFallosPrevia('{no es json'), { cuando: '', veces: 0, ultimos: [] });
  assert.deepEqual(huellaFallosPrevia('[1,2]'), { cuando: '', veces: 0, ultimos: [] });
  const h = huellaFallosPrevia(JSON.stringify({
    cuando: '2026-10-06T12:00:00.000Z', veces: 'muchas',
    ultimos: [fallo(1), { evento: 'invitee.created' }, null, 'x', fallo(2, { mensaje: 'y'.repeat(900), email: '   ' })],
  }));
  assert.equal(h.ultimos.length, 2, 'sin `cuando` o sin `evento` no es un fallo');
  assert.equal(h.veces, 2, 'un `veces` ilegible cae al largo de lo que sí se leyó');
  assert.equal(h.ultimos[1].mensaje.length, 300, 'el mensaje se recorta');
  assert.equal(h.ultimos[1].email, null, 'un email en blanco es null');
});

test('uuidDeUri: el último tramo de la URI del scheduled_event', () => {
  assert.equal(uuidDeUri('https://api.calendly.com/scheduled_events/ABC-123'), 'ABC-123');
  assert.equal(uuidDeUri('https://api.calendly.com/scheduled_events/ABC-123/'), 'ABC-123');
  assert.equal(uuidDeUri(undefined), null);
  assert.equal(uuidDeUri(''), null);
});

// ── Guards sobre el route ────────────────────────────────────────────────────

const ROUTE = sinComentarios(leer('app/api/webhooks/calendly/route.ts'));
const HELPER = funcion(ROUTE, 'async function responderFalloDeProceso(');

test('GUARD: el route sin comentarios se leyó entero', () => {
  // Si `sinComentarios` se comiera medio archivo, los guards de abajo darían verde sobre nada.
  assert.ok(ROUTE.includes('export async function POST('), 'falta el POST');
  assert.ok(ROUTE.includes('export async function GET('), 'falta el GET: algo se comió el final');
  assert.ok(HELPER.length > 300 && HELPER.length < 3000, `el helper mide ${HELPER.length}: está mirando otra cosa`);
});

test('GUARD: ningún status 5xx en el route fuera de responderFalloDeProceso, y adentro cuelga del clasificador', () => {
  const resto = ROUTE.replace(HELPER, '');
  assert.deepEqual([...resto.matchAll(/status:\s*5\d\d/g)].map((m) => m[0]), [],
    'un 5xx fuera del clasificador: Calendly reintenta y deshabilita la suscripción');
  assert.equal((HELPER.match(/status:\s*5\d\d/g) ?? []).length, 1, 'el helper tiene UN 5xx, el del transitorio');
  const iIf = HELPER.indexOf('if (esErrorTransitorio(err)) {');
  assert.ok(iIf >= 0, 'el 503 tiene que colgar de `if (esErrorTransitorio(err))`, sin negar');
  const llaveIf = iIf + 'if (esErrorTransitorio(err)) '.length;
  const elIf = cuerpoDeLlave(HELPER, llaveIf);
  assert.match(elIf, /status: 503/, 'el 503 vive ADENTRO del if del clasificador');
  const despues = HELPER.slice(llaveIf + elIf.length + 2);
  assert.match(despues, /await anotarFalloDeProceso\(ctx, message\);/, 'lo que no es transitorio se ANOTA');
  assert.match(despues, /\{ status: 200 \}/, 'y se contesta 200: un ACK, no un reintento');
});

test('GUARD: todo catch del despacho contesta por responderFalloDeProceso (las tres ramas y la red de afuera)', () => {
  const desde = ROUTE.indexOf('return runWithWorkspace(ws, async () => {');
  const hasta = ROUTE.indexOf('export async function GET(');
  assert.ok(desde > 0 && hasta > desde, 'no encontré el despacho');
  const despacho = ROUTE.slice(desde, hasta);
  assert.match(despacho, /^return runWithWorkspace\(ws, async \(\) => \{\s*try \{/, 'la red de afuera abre ni bien entra al workspace');
  const catches = [...despacho.matchAll(/\bcatch\s*(?:\((\w+)\))?\s*\{/g)];
  assert.ok(catches.length >= 4, `esperaba los tres de proceso y la red de afuera, hay ${catches.length}`);
  const ramas: string[] = [];
  for (const m of catches) {
    const cuerpo = cuerpoDeLlave(despacho, (m.index ?? 0) + m[0].length - 1);
    if (!/\breturn\b|\bthrow\b/.test(cuerpo)) continue;   // un catch best-effort que no contesta nada
    assert.ok(m[1], `un catch sin variable no puede pasar el error al clasificador: «${cuerpo.trim().slice(0, 80)}»`);
    assert.match(cuerpo, new RegExp(`return responderFalloDeProceso\\(${m[1]}, \\{ evento: body\\.event, rama: '(\\w+)'`),
      `un catch del despacho contesta sin el clasificador: «${cuerpo.trim().slice(0, 120)}»`);
    assert.doesNotMatch(cuerpo, /\bthrow\b|status:/, 'relanzar es un 500 de Next; un status a mano saltea el clasificador');
    ramas.push(cuerpo.match(/rama: '(\w+)'/)?.[1] ?? '?');
  }
  assert.deepEqual([...ramas].sort(), ['cancelacion', 'despacho', 'j1', 'j2']);
});

test('GUARD: el ruteo y la key leen ESTRICTO, acotados, y su fallo contesta por el clasificador', () => {
  // «No pude leer» no es «no está mapeado»: con las lecturas que tragan el error, la base caída
  // daba null y la reserva se contestaba 200 como «ningún negocio la tiene» (06/10/2026).
  assert.doesNotMatch(ROUTE, /\bwsPorIdentificador\(|\bcredWs\(/, 'una lectura que traga el error decide con null');
  const desde = ROUTE.indexOf('const candidatosWs =');
  const hasta = ROUTE.indexOf('return runWithWorkspace(ws, async () => {');
  assert.ok(desde > 0 && hasta > desde, 'no encontré el ruteo');
  const ruteo = ROUTE.slice(desde, hasta);
  assert.match(ruteo, /c\.length <= 300/, 'sin el tope, un identificador de 20 KB hace fallar la consulta ANTES de la firma');
  const porElClasificador = String.raw`\} catch \(err\) \{\s*return responderFalloDeProceso\(err, \{ evento: body\.event, rama: 'ruteo'`;
  assert.match(ruteo, new RegExp(String.raw`try \{\s*for \(const c of candidatosWs\) \{\s*const r = await wsPorIdentificadorEstricto\('calendly', c\);[\s\S]{0,120}?` + porElClasificador),
    'el ruteo va adentro de un try que contesta por el clasificador');
  assert.match(ruteo, new RegExp(String.raw`try \{\s*keyWs = ws == null \? null : await credWsEstricta\('CALENDLY_WEBHOOK_SIGNING_KEY', ws\);\s*` + porElClasificador),
    'la key de firma, ídem');
  // La R1/R2 estricta: sin el tipo de la R2, una R2 se graba como R1.
  assert.match(ROUTE, /j1: await credWsEstricta\('CALENDLY_EVENT_TYPE_J1', ws\),\s*j2: await credWsEstricta\('CALENDLY_EVENT_TYPE_J2', ws\)/);
  // Y lo de la rama `ruteo` se anota en el super admin: fuera de runWithWorkspace caería al ws1.
  const anotar = funcion(ROUTE, 'async function anotarFalloDeProceso(');
  assert.match(anotar, /if \(ctx\.rama === 'ruteo'\) await runWithWorkspace\(await wsSuperAdmin\(\), anotar\);\s*else await anotar\(\);/);
});

test('GUARD: anotar lee con el estricto, escribe la clave del módulo y nunca tira', () => {
  const anotar = funcion(ROUTE, 'async function anotarFalloDeProceso(');
  assert.match(anotar, /getSettingEstricto\(KEY_FALLOS_PROCESO\)/, '«no pude leer» con getSetting pisaría los fallos anotados');
  assert.doesNotMatch(anotar, /\bgetSetting\(/);
  assert.match(anotar, /setSetting\(KEY_FALLOS_PROCESO, JSON\.stringify\(huella\)\)/);
  assert.match(anotar, /^async function anotarFalloDeProceso\([^)]*\)[^{]*\{\s*try \{[\s\S]*\} catch \(e\) \{[\s\S]*console\.error/,
    'anotar NUNCA puede cambiar la respuesta: todo adentro de un try');
  assert.equal(KEY_FALLOS_PROCESO, 'calendly.fallos_proceso');
});
