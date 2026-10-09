// =============================================================================
// Lo que viaja en un evento de CAPI, y lo que un 200 de Meta NO garantiza
// =============================================================================
// Las cuatro decisiones del payload (lib/meta-capi-payload.ts) se EJECUTAN acá, y
// aparte hay tres guards de cableado: una función pura con tests y sin call site
// es una salida huérfana, y un call site sin test de la función es lo contrario.
//
// Cada assert que se probó rompiéndolo dice al lado con cuántos fallos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EVENTOS_CALIFICADO,
  VENTANA_CAPI_DIAS,
  eventIdCalificado,
  eventIdLeadCrudo,
  eventosRecibidos,
  falloEnRespuesta,
  hayIdentidad,
  leadIdDeMeta,
  tiempoDelHecho,
} from '../lib/meta-capi-payload';

// ⚠️ El `\r` se saca EN LA ENTRADA, antes de cualquier búsqueda: en este repo el
// fin de línea es POR ARCHIVO (`lib/leads.ts` es CRLF, `lib/meta-leads.ts` es LF) y
// un ancla con `\n` no calza contra un archivo CRLF — el guard frena sobre código
// perfectamente bien, y en un worktree nuevo frena sobre TODOS.
const leer = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\r\n/g, '\n');

/** El bloque REAL, cortado en lo que abre el siguiente — nunca en N caracteres. */
function bloque(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.notEqual(i, -1, `no aparece el arranque del bloque: ${abre}`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.notEqual(j, -1, `no aparece el cierre del bloque: ${cierra}`);
  return src.slice(i, j);
}

test('el lead_id de Meta se valida por FORMA: 15-17 dígitos y nada más', () => {
  assert.equal(leadIdDeMeta('123456789012345'), '123456789012345'); // 15
  assert.equal(leadIdDeMeta('12345678901234567'), '12345678901234567'); // 17
  assert.equal(leadIdDeMeta('  123456789012345  '), '123456789012345'); // se recorta
  // ⚠️ EL CENTINELA QUE YA VIVE EN ESTA BASE: los leads cargados a mano de un
  // negocio que prospecta en frío tienen `meta_lead_id = '0'` (ver la cabecera de
  // lib/audios-paso.ts). Ninguno vino de un formulario, y un lead_id inválido hace
  // que Meta RECHACE el evento entero — o sea que una conversión que hoy entra
  // dejaría de entrar.
  assert.equal(leadIdDeMeta('0'), null);
  assert.equal(leadIdDeMeta('12345678901234'), null); // 14
  assert.equal(leadIdDeMeta('123456789012345678'), null); // 18
  assert.equal(leadIdDeMeta('12345678901234a'), null);
  assert.equal(leadIdDeMeta(''), null);
  assert.equal(leadIdDeMeta(null), null);
  assert.equal(leadIdDeMeta(undefined), null);
  //   ROTO A PROPOSITO (05/10/2026): con `d.length > 0 ? d : null` en vez de la
  //   forma —o sea «mando lo que haya»— la corrida da 7 pass / 1 fail y el que cae
  //   es este, en el assert del '0', que es el valor que esta vivo en la base.
});

test('event_time es la hora del HECHO, y fuera de la ventana se recorta DECLARÁNDOLO', () => {
  const ahora = new Date('2026-10-05T12:00:00Z');
  const ahoraSeg = Math.floor(ahora.getTime() / 1000);

  // Sin hecho: la hora de la llamada, y no se finge que se recortó nada.
  assert.deepEqual(tiempoDelHecho(null, ahora), { segundos: ahoraSeg, real: null, recortado: false });
  assert.deepEqual(tiempoDelHecho('no es una fecha', ahora), { segundos: ahoraSeg, real: null, recortado: false });

  // Adentro de la ventana: va el instante real, tal cual.
  const hace2h = new Date('2026-10-05T10:00:00Z');
  assert.deepEqual(tiempoDelHecho(hace2h, ahora), {
    segundos: Math.floor(hace2h.getTime() / 1000),
    real: '2026-10-05T10:00:00.000Z',
    recortado: false,
  });
  // Un ISO con offset (la forma en que lo manda la Graph API de Meta) también.
  assert.equal(tiempoDelHecho('2026-10-05T10:00:00+0000', ahora).segundos, Math.floor(hace2h.getTime() / 1000));

  // ⚠️ MÁS VIEJO QUE LA VENTANA: Meta rechazaría el evento, así que se recorta al
  // borde — con `recortado: true` y el instante REAL conservado, porque un recorte
  // invisible es una hora inventada.
  const hace3semanas = new Date('2026-09-14T12:00:00Z');
  const r = tiempoDelHecho(hace3semanas, ahora);
  assert.equal(r.recortado, true);
  assert.equal(r.real, '2026-09-14T12:00:00.000Z');
  assert.equal(r.segundos, ahoraSeg - VENTANA_CAPI_DIAS * 86400 + 3600);
  assert.ok(r.segundos > Math.floor(hace3semanas.getTime() / 1000), 'el borde es más nuevo que el hecho');
  assert.ok(r.segundos < ahoraSeg, 'y nunca es «ahora»: eso es lo que hacía antes');

  // Un hecho en el FUTURO es un reloj desfasado. Meta rechaza cualquier adelanto.
  const futuro = tiempoDelHecho(new Date('2026-10-06T12:00:00Z'), ahora);
  assert.equal(futuro.segundos, ahoraSeg);
  assert.equal(futuro.recortado, true);
  //   ROTO A PROPOSITO (05/10/2026): devolviendo siempre
  //   `{ segundos: ahora, real: null, recortado: false }` —el comportamiento de
  //   antes— la corrida da 7 pass / 1 fail y el que cae es este.
});

test('el lead_id cuenta como identidad por sí solo', () => {
  assert.equal(hayIdentidad({ em: 'hash', ph: null, leadId: null }), true);
  assert.equal(hayIdentidad({ em: null, ph: 'hash', leadId: null }), true);
  // Esto es lo que antes se saltaba: un lead de formulario sin email ni teléfono
  // tiene el identificador que MEJOR matchea y no mandaba nada.
  assert.equal(hayIdentidad({ em: null, ph: null, leadId: '123456789012345' }), true);
  assert.equal(hayIdentidad({ em: null, ph: null, leadId: null }), false);
  assert.equal(hayIdentidad({}), false);
  //   ROTO A PROPOSITO (05/10/2026): con `!!(x.em || x.ph)` (la condicion vieja de
  //   lib/meta-capi.ts) la corrida da 7 pass / 1 fail y el que cae es este.
});

test('un 200 de Meta NO es un éxito: el fallo viene adentro', () => {
  // El camino feliz, tal como contesta /events.
  assert.equal(falloEnRespuesta({ events_received: 1, messages: [], fbtrace_id: 'Abc' }), null);
  assert.equal(eventosRecibidos({ events_received: 2 }), 2);

  // 200 con el error adentro — con Meta ya mordió (subcode 4841013, «Permisos»).
  const f = falloEnRespuesta({
    error: { message: 'Invalid parameter', code: 100, error_subcode: 2804003, type: 'OAuthException' },
    fbtrace_id: 'Zzz',
  });
  assert.ok(f);
  assert.match(f!, /Invalid parameter/);
  assert.match(f!, /code 100/);
  assert.match(f!, /subcode 2804003/);
  assert.match(f!, /fbtrace Zzz/);

  // 200 que no confirma NINGÚN evento: «te escuché y no hice nada».
  assert.match(falloEnRespuesta({ events_received: 0 })!, /events_received=0/);
  assert.match(falloEnRespuesta({ messages: [] })!, /events_received=ausente/);
  // Y un cuerpo que no es un objeto no se da por bueno.
  assert.ok(falloEnRespuesta(null));
  assert.ok(falloEnRespuesta('ok'));
  assert.equal(eventosRecibidos('ok'), 0);
  //   ROTO A PROPOSITO (05/10/2026): salteando el chequeo de `events_received` —o
  //   sea mirando solo el `error`, que es la mitad obvia— la corrida da 7 pass /
  //   1 fail y el que cae es este. Esa es la forma silenciosa del rechazo.
});

test('la calificación viaja con los dos nombres y UNA sola clave de dedup', () => {
  // El estándar primero: `SubmitApplication` es elegible como objetivo de un
  // conjunto de anuncios HOY, sin que nadie declare nada del lado de Meta. El
  // propio va igual, para medirlo con su nombre.
  assert.deepEqual([...EVENTOS_CALIFICADO], ['SubmitApplication', 'QualifiedLead']);
  // Estable por lead: marcar → desmarcar → marcar manda la MISMA clave.
  assert.equal(eventIdCalificado(4321), 'calif:4321');
  assert.equal(eventIdCalificado(4321), eventIdCalificado(4321));
  assert.notEqual(eventIdCalificado(4321), eventIdCalificado(4322));
  assert.equal(eventIdLeadCrudo('123456789012345'), 'lead:123456789012345');
  // Las dos familias no se pisan entre sí.
  assert.notEqual(eventIdCalificado(1), eventIdLeadCrudo('1'));
  //   ROTO A PROPOSITO (05/10/2026): dejando `EVENTOS_CALIFICADO = ['QualifiedLead']`
  //   —sin el estandar, o sea sin nada que Meta pueda usar como objetivo hoy— la
  //   corrida da 7 pass / 1 fail y el que cae es este.
});

test('el cliente HTTP lee el cuerpo del 200 y manda la hora del hecho', () => {
  const cuerpo = bloque(leer('lib/meta-capi.ts'), 'export async function sendMetaCAPIEvent', '\n}\n');
  assert.ok(cuerpo.length > 1500 && cuerpo.length < 7000, `el recorte mide ${cuerpo.length}: si creció mucho, está mirando otra cosa`);
  // `res.ok` no alcanza: el fallo de Meta viene adentro del 200.
  assert.match(cuerpo, /falloEnRespuesta\(cuerpo\)/);
  assert.match(cuerpo, /JSON\.parse\(crudo\)/);
  // La hora del hecho, no la de la llamada.
  assert.match(cuerpo, /event_time: t\.segundos/);
  assert.doesNotMatch(cuerpo, /event_time: Math\.floor\(Date\.now\(\)/);
  // El lead_id va SIN hashear y pasa por el filtro de forma.
  assert.match(cuerpo, /user_data\.lead_id = leadId/);
  assert.match(cuerpo, /leadIdDeMeta\(params\.metaLeadId\)/);
  assert.doesNotMatch(cuerpo, /lead_id = \[/);
  //   ROTO A PROPOSITO (05/10/2026), dos veces y por separado: volviendo a
  //   `event_time: Math.floor(Date.now() / 1000)` la corrida da 7 pass / 1 fail, y
  //   dejando `const fallo = null` en vez de leer el cuerpo del 200 tambien. Las
  //   dos veces el que cae es este.
});

test('la calificación del CRM manda los dos eventos, con lead_id y con event_id', () => {
  const calif = bloque(leer('lib/leads.ts'), 'if (fireCalificado) {', '// Auto-etiqueta de WhatsApp');
  assert.ok(calif.length < 2500, `el recorte mide ${calif.length}`);
  assert.match(calif, /for \(const eventName of EVENTOS_CALIFICADO\)/);
  assert.match(calif, /eventIdCalificado\(id\)/);
  assert.match(calif, /metaLeadId: merged\.meta_lead_id/);
  assert.match(calif, /eventTime: new Date\(\)/);
  // ⚠️ `Lead` ES EL EVENTO DEL LEAD CRUDO y se mudó al webhook: si vuelve a salir
  // de acá, las dos etapas del embudo viajan otra vez con el mismo nombre y Meta no
  // las puede distinguir.
  assert.doesNotMatch(calif, /eventName: 'Lead'/);
  // Lo que Meta rechaza queda donde el dueño lo lee, no sólo en el log.
  assert.match(calif, /logLeadEvent\(id, 'Meta'/);
  //   ROTO A PROPOSITO (05/10/2026): iterando `['Lead'] as const` en vez de
  //   EVENTOS_CALIFICADO —la conflacion que habia antes— la corrida da 7 pass /
  //   1 fail y el que cae es este.
});

test('el lead CRUDO lo manda el webhook de formularios, con la hora real de Meta', () => {
  // El bloque cerraba en «// Alta del chat» (el contacto en Chatwoot), que se fue el 09/10/2026.
  const envio = bloque(leer('app/api/webhooks/meta-leads/route.ts'), 'const capi = await sendMetaCAPIEvent(', '// Aviso al dueño del workspace');
  assert.ok(envio.length < 1500, `el recorte mide ${envio.length}`);
  assert.match(envio, /eventName: 'Lead'/);
  assert.match(envio, /metaLeadId: leadgenId/);
  // La hora del formulario, no la de este request: el webhook puede llegar tarde.
  assert.match(envio, /eventTime: graphLead\.created_time \?\? null/);
  // Meta reintenta el batch entero cuando el webhook no contesta 200.
  assert.match(envio, /eventId: eventIdLeadCrudo\(leadgenId\)/);
  assert.match(envio, /logLeadEvent\(lead\.id, 'Meta'/);
  // ⚠️ El camino de POLLING hace una pasada de 90 días: si mandara `Lead`, le
  // pegaría a Meta con leads que caen fuera de la ventana de CAPI.
  assert.doesNotMatch(leer('lib/meta-leads.ts'), /sendMetaCAPIEvent/);
  //   ROTO A PROPOSITO (05/10/2026): borrando la linea del `eventTime` del envio
  //   —o sea mandando la hora de ESTE request en vez de la del formulario— la
  //   corrida da 7 pass / 1 fail y el que cae es este.
});
