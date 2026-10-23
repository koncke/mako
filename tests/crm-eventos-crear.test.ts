// =============================================================================
// «Asignar evento»: crear, editar y conectar la agenda sin salir del CRM (21/10/2026)
// =============================================================================
// Martín, textual: «Y dentro de la edición de eventos, si no se conectó un calendly o cal se debería poder hacer desde
// allí mismo... Y también me gustaría que se pueda editar o crear eventos desde allí también. Y claro, que puedo tener
// eventos en Calendly, Cal o Google Calendar...».
//   1. lo que se crea o se cambia, limpio (`datosDeEvento`): al crear, nombre y duración; al editar, lo que venga;
//   2. Cal.com: `POST`/`PATCH /v2/event-types` con su versión y su cuerpo, y lo que contesta, leído (con fetch falso);
//   3. Calendly: `POST /event_types` con el dueño del token y ACTIVO, `PATCH /event_types/{uuid}`;
//   4. la pantalla: crear y asignar en un gesto, editar en el lugar, conectar con el modal de /integraciones, Google dicho;
//   5. las puertas (sólo el admin) y la API de MaKo con las MISMAS funciones.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · `datosDeEvento` aceptando crear sin duración                                    → 4 / 1
//   · Cal.com con `length` (la v1) en vez de `lengthInMinutes`                          → 4 / 1
//   · Calendly creando sin `active: true` (nace apagado y no aparece en la lista)        → 4 / 1
//   · la pantalla creando sin `vincularA` (se crea y no queda asignado)                  → 4 / 1
//   · `editarEventoAgendaAction` sin la puerta del admin                                → 4 / 1
// Correr: node --import tsx --test tests/crm-eventos-crear.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DURACIONES_EVENTO, datosDeEvento } from '../lib/agenda-evento-etapa';
import { crearEventTypeCalcom, editarEventTypeCalcom, slugCalcom } from '../lib/calcom';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('lo que se crea o se cambia, limpio: al crear, nombre y duración; al editar, lo que venga', () => {
  assert.deepEqual(datosDeEvento({ nombre: '  Llamada   de diagnóstico ', duracionMin: 30 }), { ok: true, nombre: 'Llamada de diagnóstico', duracionMin: 30 });
  assert.equal(datosDeEvento({ nombre: 'Llamada' }).ok, false, 'crear sin duración');
  assert.equal(datosDeEvento({ duracionMin: 30 }).ok, false, 'crear sin nombre');
  assert.equal(datosDeEvento({ nombre: 'x', duracionMin: 3 }).ok, false, 'menos de 5 minutos');
  assert.equal(datosDeEvento({ nombre: 'x', duracionMin: 30.5 }).ok, false, 'minutos con coma');
  assert.equal(datosDeEvento({ nombre: 'x'.repeat(81), duracionMin: 30 }).ok, false, 'nombre largo');
  assert.deepEqual(datosDeEvento({ duracionMin: '45' }, true), { ok: true, duracionMin: 45 }, 'editar sólo la duración');
  assert.deepEqual(datosDeEvento({ nombre: 'Demo' }, true), { ok: true, nombre: 'Demo' }, 'editar sólo el nombre');
  assert.equal(datosDeEvento({}, true).ok, false, 'editar sin nada');
  assert.equal(datosDeEvento({ nombre: '   ' }, true).ok, false, 'dejar el nombre vacío');
  assert.ok(DURACIONES_EVENTO.includes(30));
  assert.equal(slugCalcom('Llamada de Diagnóstico ¡ya!'), 'llamada-de-diagnostico-ya');
});

test('Cal.com: crear y editar por /v2/event-types, con su versión, y lo que contesta leído', async () => {
  const original = globalThis.fetch;
  const pedidos: Array<{ url: string; method?: string; headers: Record<string, string>; body: unknown }> = [];
  let respuesta: { status: number; body: unknown } = { status: 201, body: { status: 'success', data: { id: 987, title: 'Demo', slug: 'demo', lengthInMinutes: 45 } } };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url: String(url), method: init?.method, headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body ?? 'null')) });
    return new Response(JSON.stringify(respuesta.body), { status: respuesta.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const e = await crearEventTypeCalcom('cal_live_x', { nombre: 'Demo', duracionMin: 45 });
    assert.deepEqual(e, { id: '987', slug: 'demo', nombre: 'Demo', duracionMin: 45 }, 'el id es el que llega en el webhook: el que se vincula');
    assert.equal(pedidos[0].url, 'https://api.cal.com/v2/event-types');
    assert.equal(pedidos[0].method, 'POST');
    assert.equal(pedidos[0].headers['cal-api-version'], '2024-06-14');
    assert.equal(pedidos[0].headers.Authorization, 'Bearer cal_live_x');
    assert.deepEqual(pedidos[0].body, { title: 'Demo', slug: 'demo', lengthInMinutes: 45 });

    await editarEventTypeCalcom('cal_live_x', '987', { duracionMin: 30 });
    assert.equal(pedidos[1].url, 'https://api.cal.com/v2/event-types/987');
    assert.equal(pedidos[1].method, 'PATCH');
    assert.deepEqual(pedidos[1].body, { lengthInMinutes: 30 }, 'lo que no se pasa no viaja');
    await assert.rejects(editarEventTypeCalcom('cal_live_x', '../borrar', { nombre: 'x' }), /no es un evento de Cal\.com/);

    // Un 200 con el error adentro, y una key rechazada: se dice, no se toma por creado.
    respuesta = { status: 200, body: { status: 'error', error: { message: 'Slug already exists' } } };
    await assert.rejects(crearEventTypeCalcom('k', { nombre: 'Demo', duracionMin: 30 }), /Cal\.com: Slug already exists/);
    respuesta = { status: 403, body: {} };
    await assert.rejects(crearEventTypeCalcom('k', { nombre: 'Demo', duracionMin: 30 }), /no aceptó la API key/);
  } finally {
    globalThis.fetch = original;
  }
});

test('Calendly: crear con el dueño del token y ACTIVO; editar por su uuid', () => {
  const c = sinComentarios(leer('lib/calendly-agenda.ts'));
  // Con el token que recibe desde el 23/10/2026 (tests/agenda-velocidad-23-10.test.ts).
  assert.match(c, /const owner = await usuarioUri\(token\);/);
  assert.match(c, /pedir<\{ resource\?: EventTypeCrudo \}>\(`\$\{API\}\/event_types`, \{\s*method: 'POST', body: JSON\.stringify\(\{ owner, name: i\.nombre, duration: i\.duracionMin, active: true \}\),/);
  assert.match(c, /pedir<\{ resource\?: EventTypeCrudo \}>\(`\$\{API\}\/event_types\/\$\{uuid\}`, \{ method: 'PATCH',/);
  assert.match(c, /if \(!\/\^\[A-Za-z0-9-\]\{6,\}\$\/\.test\(uuid\)\) throw/, 'un identificador cualquiera armaría otra ruta');
});

test('la pantalla: crear y asignar en un gesto, editar en el lugar, conectar sin salir, y Google dicho', () => {
  const m = sinComentarios(leer('app/crm/EventosDeEtapaModal.tsx'));
  assert.match(m, /const r = await crearEventoAgendaAction\(\{ \.\.\.creando, vincularA: \{ funnelId, etapa \} \}\);/, 'se crea PARA asignarlo');
  // Desde el 23/10/2026 manda la cuenta del evento y SÓLO lo que cambió (la edición completa: tests/agenda-edicion-completa-23-10.test.ts).
  assert.match(m, /const r = await editarEventoAgendaAction\(\{ proveedor: e\.proveedor, cuenta: e\.cuenta \?\? undefined, identificador: e\.identificador, \.\.\.cambios \}\);/);
  assert.match(m, /<BotonIntegracion key=\{p\} servicio=\{SERVICIO_INTEGRACION\[p\]\} onConectado=\{\(\) => leer\(\)\}/, 'conectar abre el modal de /integraciones acá');
  // Crear no manda a otra pestaña. Lo único que abre una (23/10/2026) es lo que la API no deja editar: la disponibilidad.
  assert.equal((m.match(/target="_blank"/g) ?? []).length, (m.match(/href=\{o\.editarAlla\} target="_blank" rel="noreferrer"/g) ?? []).length, 'otra pestaña que no es «editar allá»');
  // Google Calendar: una ⓘ desde el 22/10/2026 (tests/crm-asignar-evento.test.ts).
  assert.match(m, /title=\{AVISO_GOOGLE_AGENDA\}/, 'Google Calendar, dicho');
  const a = sinComentarios(leer('app/crm/agenda-evento-actions.ts'));
  for (const fn of ['crearEventoAgendaAction', 'editarEventoAgendaAction']) {
    const i = a.indexOf(`export async function ${fn}`);
    assert.ok(i > 0, fn);
    assert.match(a.slice(i, i + 600), /await exigirSesion\(\);\s*if \(!\(await esAdmin\(\)\)\) return \{ ok: false, error: SOLO_ADMIN \};/, `${fn} sin la puerta del admin`);
  }
});

test('la API de MaKo: crear y editar un evento, sólo el admin, con «sí», por las MISMAS funciones', () => {
  const def = sinComentarios(leer('lib/api-mako/areas/crm.def.ts'));
  for (const id of ['crear_pagina_reserva', 'editar_pagina_reserva']) {
    const i = def.indexOf(`id: '${id}'`);
    assert.ok(i > 0, `la API no declara ${id}`);
    const op = def.slice(i, def.indexOf('\n  },', i));
    assert.match(op, /tipo: 'accion', confirmacion: 'chat'/);
    assert.match(op, /gating: TAB_ADMIN/);
  }
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  assert.match(run, /const r = await crearEventoDeAgenda\(\{ proveedor: payload\.proveedor, cuenta: payload\.cuenta, nombre: payload\.nombre, duracionMin: payload\.duracionMin \}\);/);
  assert.match(run, /const r = await editarEventoDeAgenda\(\{\s*proveedor: payload\.proveedor, identificador: payload\.evento,/);
  const srv = sinComentarios(leer('lib/agenda-evento-etapa-server.ts'));
  assert.match(srv, /const d = datosDeEvento\(input\);/);
  // Editar valida el nombre y la duración igual, salvo que sólo cambie la descripción, dónde o las preguntas (23/10/2026).
  assert.match(srv, /const d = hayBasico \|\| !hayDetalle \? datosDeEvento\(input, true\) :/);
});
