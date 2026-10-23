// =============================================================================
// La edición completa de un evento desde «Vincular evento» (23/10/2026)
// =============================================================================
// Martín, 22/10/2026: «Edición COMPLETA del evento desde ahí: nombre, duración, preguntas, disponibilidad, lo que permita
// cada API». Lo que deja cada una (leído en su documentación el 23/10/2026, docs/hallazgos-integraciones.md): la
// descripción y dónde es la reunión en las dos; las preguntas que ya existen, sólo en Cal.com; la disponibilidad, en
// ninguna de forma segura (un PATCH reemplaza todas las reglas, y en Calendly la ruta no es clara): se edita allá.
// Lo puro (lib/agenda-evento-detalle.ts) se EJECUTA; la red y la pantalla se leen como fuente.
//
// PROBADO ROMPIÉNDOLO (23/10/2026): ver el pie del archivo.
// Correr: node --import tsx --test tests/agenda-edicion-completa-23-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  UBICACIONES, datosDeDetalle, editarAllaDe, preguntasCambiadas, preguntasDeCalcom, preguntasDeCalendly,
  ubicacionACalcom, ubicacionACalendly, ubicacionDeCalcom, ubicacionDeCalendly, type UbicacionEvento,
} from '../lib/agenda-evento-detalle';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('dónde es la reunión: ida y vuelta con Calendly y con Cal.com, para cada tipo común', () => {
  for (const { tipo, conValor } of UBICACIONES) {
    const u: UbicacionEvento = conValor === 'direccion' ? { tipo, valor: 'Av. Siempreviva 742' } : conValor === 'link' ? { tipo, valor: 'https://x.co/sala' } : { tipo };
    assert.deepEqual(ubicacionDeCalendly(ubicacionACalendly(u)), { ubicacion: u, alla: false }, `Calendly: ${tipo}`);
    assert.deepEqual(ubicacionDeCalcom(ubicacionACalcom(u) as never), { ubicacion: u, alla: false }, `Cal.com: ${tipo}`);
  }
  // Sin ubicación: nada que pisar.
  assert.deepEqual(ubicacionDeCalendly([]), { ubicacion: null, alla: false });
  // Más de una, o una que no es de las comunes: se edita allá (cambiarla acá borraría las otras).
  assert.deepEqual(ubicacionDeCalendly([{ kind: 'zoom_conference' }, { kind: 'physical', location: 'x' }]), { ubicacion: null, alla: true });
  assert.deepEqual(ubicacionDeCalendly([{ kind: 'webex_conference' }]), { ubicacion: null, alla: true });
  assert.deepEqual(ubicacionDeCalcom([{ type: 'integration', integration: 'cal-video' }]), { ubicacion: null, alla: true });
  assert.deepEqual(ubicacionDeCalcom([{ type: 'link', link: 'a' }, { type: 'attendeePhone' }]), { ubicacion: null, alla: true });
});

test('las preguntas: las de Calendly se leen; las de Cal.com, sólo las PROPIAS (las de sistema no se tocan)', () => {
  assert.deepEqual(preguntasDeCalendly([{ name: ' ¿Qué vendes? ', position: 0, enabled: true, required: true }, { name: '', position: 1 }, { name: 'Web', position: 2, enabled: false }]), [
    { id: '0', texto: '¿Qué vendes?', obligatoria: true, oculta: false },
    { id: '2', texto: 'Web', obligatoria: false, oculta: true },
  ]);
  assert.deepEqual(preguntasDeCalcom([
    { slug: 'name', label: 'Tu nombre', required: true }, { slug: 'email', label: 'Email', required: true, isDefault: true },
    { slug: 'facturacion', label: '¿Cuánto facturas?', required: true, type: 'select' }, { slug: 'web', label: 'Tu web', hidden: true },
  ]), [
    { id: 'facturacion', texto: '¿Cuánto facturas?', obligatoria: true, oculta: false },
    { id: 'web', texto: 'Tu web', obligatoria: false, oculta: true },
  ]);
  // Al guardar, sólo las que cambiaron (Cal.com: lo que no se nombra queda como está).
  const antes = [{ id: 'a', texto: 'A', obligatoria: false, oculta: false }, { id: 'b', texto: 'B', obligatoria: true, oculta: false }];
  assert.deepEqual(preguntasCambiadas(antes, [{ ...antes[0] }, { ...antes[1], obligatoria: false }, { id: 'z', texto: 'nueva', obligatoria: false, oculta: false }]),
    [{ id: 'b', texto: 'B', obligatoria: false, oculta: false }], 'una que no existía no se inventa por esta vía');
});

test('lo que llega a editar se valida (la pantalla y MaKo pasan por acá)', () => {
  assert.deepEqual(datosDeDetalle({}), { ok: true, cambios: {} });
  assert.deepEqual(datosDeDetalle({ descripcion: '  Hola  ' }), { ok: true, cambios: { descripcion: 'Hola' } });
  assert.equal(datosDeDetalle({ descripcion: 'x'.repeat(1001) }).ok, false);
  assert.deepEqual(datosDeDetalle({ ubicacion: { tipo: 'zoom', valor: 'ignorado' } }), { ok: true, cambios: { ubicacion: { tipo: 'zoom' } } });
  assert.equal(datosDeDetalle({ ubicacion: { tipo: 'presencial' } }).ok, false, 'en persona sin dirección');
  assert.equal(datosDeDetalle({ ubicacion: { tipo: 'link', valor: 'sala' } }).ok, false, 'un link sin https');
  assert.equal(datosDeDetalle({ ubicacion: { tipo: 'webex' } }).ok, false);
  assert.equal(datosDeDetalle({ preguntas: [{ id: 'a', texto: '' }] }).ok, false);
  assert.deepEqual(datosDeDetalle({ preguntas: [{ id: 'a', texto: ' ¿Web?  ', obligatoria: true }] }),
    { ok: true, cambios: { preguntas: [{ id: 'a', texto: '¿Web?', obligatoria: true, oculta: false }] } });
});

test('lo que no deja la API se edita allá: el link de cada una', () => {
  assert.equal(editarAllaDe('calcom', '123'), 'https://app.cal.com/event-types/123?tabName=availability');
  assert.match(editarAllaDe('calendly', 'https://api.calendly.com/event_types/AAA'), /^https:\/\/calendly\.com\//);
});

test('la red: Calendly y Cal.com editan descripción y dónde; las preguntas de Cal.com, por su ruta y su versión', () => {
  const cal = sinComentarios(leer('lib/calendly-agenda.ts'));
  assert.match(cal, /if \(i\.descripcion != null\) cuerpo\.description = i\.descripcion;/, 'Calendly: el campo es `description` (description_plain es sólo de respuesta)');
  assert.match(cal, /if \(i\.locations\) cuerpo\.locations = i\.locations;/);
  assert.match(cal, /export async function detalleEventTypeCalendly\(token: string, uri: string\)/);
  const cc = sinComentarios(leer('lib/calcom.ts'));
  assert.match(cc, /if \(i\.descripcion != null\) cuerpo\.description = i\.descripcion;/);
  assert.match(cc, /if \(i\.locations\) cuerpo\.locations = i\.locations;/);
  assert.match(cc, /export const VERSION_BOOKING_FIELDS_CALCOM = '2026-06-12';/, 'sin esta versión, Cal.com contesta con la vieja');
  assert.match(cc, /`\$\{CALCOM_API\.base\}\/event-types\/\$\{id\.trim\(\)\}\/booking-fields`/);
  assert.match(cc, /method: 'PATCH'[\s\S]{0,200}'cal-api-version': VERSION_BOOKING_FIELDS_CALCOM/);
});

test('el servidor: lee el detalle con la cuenta que tiene el evento; Calendly no recibe preguntas; Cal.com, sólo las que cambiaron', () => {
  const srv = sinComentarios(leer('lib/agenda-evento-etapa-server.ts'));
  const i = srv.indexOf('export async function detalleDeEventoDeAgenda(');
  const det = srv.slice(i, srv.indexOf('export async function editarEventoDeAgenda(', i));
  assert.match(det, /const cta = await cuentaParaEscribir\(proveedor, input\.cuenta, identificador\);/);
  assert.match(det, /const token = await tokenDeAgenda\(proveedor, cta\.cuenta\);/);
  const j = srv.indexOf('export async function editarEventoDeAgenda(');
  const ed = srv.slice(j, srv.indexOf('// ── VINCULAR Y DESVINCULAR', j));
  assert.match(ed, /if \(proveedor === 'calendly' && preguntas\) return \{ ok: false, error:/, 'Calendly no deja: se dice antes de escribir');
  assert.match(ed, /const cambiadas = preguntas \? preguntasCambiadas\(preguntasDeCalcom\(\(await detalleEventTypeCalcom\(key, identificador\)\)\.bookingFields\), preguntas\) : \[\];/);
  assert.match(ed, /Cal\.com guardó lo demás, pero no las preguntas/, 'una falla a medias tiene que decir qué quedó');
});

test('la pantalla: la cuenta de cada evento, elegir la cuenta al crear, y el formulario completo al editar', () => {
  const m = sinComentarios(leer('app/crm/EventosDeEtapaModal.tsx'));
  // Varias cuentas: cada evento dice de cuál es, y al crear se elige (proveedor + cuenta).
  assert.match(m, /variasCuentas\(e\.proveedor\) && e\.cuentaNombre \? e\.cuentaNombre : NOMBRE_PROVEEDOR\[e\.proveedor\]/);
  assert.match(m, /value=\{`\$\{creando\.proveedor\}\|\$\{creando\.cuenta\}`\}/);
  assert.match(m, /setCreando\(\{ nombre: '', duracionMin: 30, proveedor: conectados\[0\]\.proveedor, cuenta: conectados\[0\]\.cuenta \}\)/);
  // Editar: el nombre y la duración al toque; lo demás, de la API, con la cuenta del evento.
  assert.match(m, /void detalleEventoAgendaAction\(\{ proveedor: e\.proveedor, cuenta: e\.cuenta, identificador: e\.identificador \}\)/);
  assert.match(m, /onClick=\{\(\) => abrirEdicion\(e\)\}/);
  // Sólo lo que cambió viaja; sin cambios, se cierra sin escribir.
  assert.match(m, /if \(!Object\.keys\(cambios\)\.length\) \{ setEditando\(null\); return; \}/);
  assert.match(m, /\.\.\.\(o && !o\.ubicacionAlla && editando\.ubicacion &&/, 'con varias ubicaciones, la de acá pisaría las otras');
  assert.match(m, /\.\.\.\(o\?\.preguntasEditables &&/);
  // Lo que no deja la API: un link a la cuenta, y las preguntas de Calendly de lectura.
  assert.match(m, /<a className="vx-link" href=\{o\.editarAlla\} target="_blank" rel="noreferrer">\s*Disponibilidad/);
  assert.match(m, /<ul className="vx-solo-leer">/);
  assert.match(m, /aria-pressed=\{p\.obligatoria\}/);
  // En el teléfono, la hoja de siempre: los renglones se apilan (`flex-wrap`).
  assert.match(leer('app/crm/vincular-etapa.ts'), /\.vx-pregunta \{ display: flex; align-items: center; gap: 6px; flex-wrap: wrap; \}/);
});

test('MaKo: crear en una cuenta, y editar la descripción y dónde, por las MISMAS funciones', async () => {
  const { porId } = await import('../lib/api-mako/registro');
  const crear = porId('crear_pagina_reserva')!;
  assert.ok(crear.parametros?.some((p) => p.nombre === 'cuenta'));
  const ed = porId('editar_pagina_reserva')!;
  for (const n of ['descripcion', 'ubicacion', 'ubicacionValor']) assert.ok(ed.parametros?.some((p) => p.nombre === n), `editar sin ${n}`);
  assert.deepEqual(ed.parametros?.find((p) => p.nombre === 'ubicacion')?.enum, UBICACIONES.map((u) => u.tipo));
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  assert.match(run, /const dd = datosDeDetalle\(\{/, 'MaKo valida igual que la pantalla');
  assert.match(run, /\.\.\.\(e\.cuenta \? \{ cuenta: e\.cuenta \} : \{\}\)/, 'editar va a la cuenta que TIENE el evento');
  assert.match(run, /dónde es la reunión a \$\{dondeNombre\} \(reemplaza la de hoy\)/, 'el «sí» dice que reemplaza');
  assert.match(run, /cuenta: e\.cuenta, cuenta_nombre: e\.cuentaNombre/, 'la lista dice de qué cuenta es cada evento');
});

// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · `ubicacionDeCalendly` que toma la primera de varias                                    → 7 / 1
//   · `preguntasDeCalcom` sin sacar las de sistema                                           → 7 / 1
//   · `preguntasCambiadas` que manda también las que no cambiaron                            → 7 / 1
//   · `datosDeDetalle` que acepta un link sin https                                          → 7 / 1
//   · Calendly con `description_plain` en el PATCH                                           → 7 / 1
//   · las preguntas de Cal.com con la versión de los tipos de evento                         → 7 / 1
//   · Calendly que acepta preguntas (sin el error de antes de escribir)                      → 7 / 1
//   · la pantalla que manda todo aunque no haya cambiado                                     → 7 / 1
//   · editar en MaKo sin la cuenta del evento                                                → 7 / 1
