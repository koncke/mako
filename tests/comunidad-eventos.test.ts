// =============================================================================
// comunidad-eventos — el calendario de la comunidad: la serie a través del horario de verano, el fin,
// las excepciones, «este y los siguientes», el acceso y el .ics
// =============================================================================
// Ejecuta lib/comunidad-eventos.ts (puro). Lo que más importa es lo que no da error y sale mal:
//   · una serie que suma 7 días EN MILISEGUNDOS deriva una hora el día del cambio de horario (la clase
//     de las 9 sale a las 10, sin un solo error);
//   · una conversión de hora de pared con UNA pasada se equivoca justo en el salto (Tijuana, 8/3, 9:00:
//     medido en lib/cron-aviso.ts);
//   · un .ics con LF en vez de CRLF, sin plegar o sin escapar la coma lo rechaza algún calendario.
// Las fechas de los casos caen ENCIMA de los cambios de horario reales de 2026 (Tijuana: 8/3 y 1/11;
// Santiago de Chile: 5/4 y 6/9), no lejos: lejos del salto una pasada también acierta y el test da
// verde sobre el bug (la lección de tests/cron-aviso: la primera versión probaba el 15/7).
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partesEn } from '../lib/cron-aviso';
import {
  ocurrencias, indiceDeFecha, partirSerie, partirExcepciones, sanearEvento, sanearRecurrencia, sanearAcceso, accesoGuardado,
  accesoPermite, motivoBloqueo, textoRecurrencia, leerFecha, linkDeLugar, escaparIcs, plegar, icsDeOcurrencia, icsDeSerie,
  cambiosDeHorario, esZonaValida, excepcionesGuardadas, rangoDeCalendario, RANGO_MAX_MS, HORIZONTE_MS,
  type SerieEvento, type Recurrencia,
} from '../lib/comunidad-eventos';

const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Una serie armada como la arma el server: validada con `sanearEvento`. */
function serie(e: Record<string, unknown>, excepciones: string[] = []): SerieEvento {
  const v = sanearEvento({ titulo: 'Clase', duracionMin: 60, ...e });
  assert.ok(v.ok, v.ok ? '' : v.error);
  return { inicioMs: v.evento.inicioMs, zona: v.evento.zona, duracionMin: v.evento.duracionMin, recurrencia: v.evento.recurrencia, excepciones };
}

/** La hora de pared de un instante en una zona: «09:00». */
const paredEn = (ms: number, zona: string) => { const p = partesEn(zona, new Date(ms)); return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`; };

// ── El horario de verano ──────────────────────────────────────────────────────────

test('semanal a las 9 en Tijuana: el lunes después del cambio sigue siendo a las 9 (UTC se corre una hora)', () => {
  const s = serie({ fecha: '2026-03-02', hora: '09:00', zona: 'America/Tijuana', recurrencia: { frecuencia: 'semanal', dias: [1], fin: { tipo: 'veces', veces: 3 } } });
  const oc = ocurrencias(s, Date.UTC(2026, 1, 1), Date.UTC(2026, 4, 1));
  assert.deepEqual(oc.map((o) => iso(o.inicio)), ['2026-03-02T17:00:00.000Z', '2026-03-09T16:00:00.000Z', '2026-03-16T16:00:00.000Z']);
  assert.deepEqual(oc.map((o) => o.fecha), ['2026-03-02', '2026-03-09', '2026-03-16']);
});

test('diaria a las 9 en Tijuana: el MISMO día del cambio (8/3) es a las 9, no a las 10 (dos pasadas)', () => {
  const s = serie({ fecha: '2026-03-06', hora: '09:00', zona: 'America/Tijuana', recurrencia: { frecuencia: 'diaria', fin: { tipo: 'veces', veces: 5 } } });
  const oc = ocurrencias(s, Date.UTC(2026, 2, 1), Date.UTC(2026, 2, 20));
  const del8 = oc.find((o) => o.fecha === '2026-03-08');
  assert.ok(del8, 'falta la ocurrencia del 8/3');
  assert.equal(iso(del8.inicio), '2026-03-08T16:00:00.000Z');
  for (const o of oc) assert.equal(paredEn(o.inicio, 'America/Tijuana'), '09:00', o.fecha);
});

test('hemisferio sur (Santiago, fin del horario de verano el 5/4): todas a las 19 de pared, y el UTC se corre', () => {
  const s = serie({ fecha: '2026-03-30', hora: '19:00', zona: 'America/Santiago', recurrencia: { frecuencia: 'semanal', dias: [1], fin: { tipo: 'veces', veces: 3 } } });
  const oc = ocurrencias(s, Date.UTC(2026, 2, 1), Date.UTC(2026, 5, 1));
  assert.equal(oc.length, 3);
  for (const o of oc) assert.equal(paredEn(o.inicio, 'America/Santiago'), '19:00', o.fecha);
  assert.equal(oc[1].inicio - oc[0].inicio, 7 * DIA + 3_600_000, 'cruzando el cambio, la semana dura una hora más en UTC');
});

test('fin del horario de verano en Tijuana (1/11): la mensual del día 1 sigue a la misma hora de pared', () => {
  const s = serie({ fecha: '2026-10-01', hora: '18:30', zona: 'America/Tijuana', recurrencia: { frecuencia: 'mensual', fin: { tipo: 'veces', veces: 3 } } });
  const oc = ocurrencias(s, Date.UTC(2026, 8, 1), Date.UTC(2027, 1, 1));
  assert.deepEqual(oc.map((o) => o.fecha), ['2026-10-01', '2026-11-01', '2026-12-01']);
  for (const o of oc) assert.equal(paredEn(o.inicio, 'America/Tijuana'), '18:30', o.fecha);
});

// ── La regla: días, intervalo, mes sin el día, fin ────────────────────────────────

test('semanal con varios días: arranca el día del inicio y sigue en orden (lun y mié, empezando un miércoles)', () => {
  const s = serie({ fecha: '2026-10-14', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'semanal', dias: [1, 3], fin: { tipo: 'veces', veces: 4 } } });
  assert.deepEqual(ocurrencias(s, Date.UTC(2026, 9, 1), Date.UTC(2026, 11, 1)).map((o) => o.fecha), ['2026-10-14', '2026-10-19', '2026-10-21', '2026-10-26']);
});

test('cada 2 semanas: salta una', () => {
  const s = serie({ fecha: '2026-10-05', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'semanal', cada: 2, dias: [1], fin: { tipo: 'nunca' } } });
  assert.deepEqual(ocurrencias(s, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 10)).map((o) => o.fecha), ['2026-10-05', '2026-10-19', '2026-11-02']);
});

test('mensual el 31: los meses sin 31 no tienen evento (y no cuentan para «tras N veces»)', () => {
  const s = serie({ fecha: '2026-01-31', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'mensual', fin: { tipo: 'veces', veces: 3 } } });
  assert.deepEqual(ocurrencias(s, Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1)).map((o) => o.fecha), ['2026-01-31', '2026-03-31', '2026-05-31']);
});

test('termina en una fecha (inclusive) y tras N veces; las borradas CUENTAN para N (como el COUNT del RFC)', () => {
  const hasta = serie({ fecha: '2026-10-01', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'diaria', fin: { tipo: 'fecha', fecha: '2026-10-03' } } });
  assert.deepEqual(ocurrencias(hasta, Date.UTC(2026, 8, 1), Date.UTC(2026, 11, 1)).map((o) => o.fecha), ['2026-10-01', '2026-10-02', '2026-10-03']);
  const veces = serie({ fecha: '2026-10-01', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'diaria', fin: { tipo: 'veces', veces: 3 } } }, ['2026-10-02']);
  const oc = ocurrencias(veces, Date.UTC(2026, 8, 1), Date.UTC(2026, 11, 1));
  assert.deepEqual(oc.map((o) => o.fecha), ['2026-10-01', '2026-10-03'], 'borrar una no estira la serie');
  assert.deepEqual(oc.map((o) => o.indice), [0, 2]);
});

test('el rango: entra la que está EN CURSO al empezar, no la que ya terminó ni la que empieza al cerrar', () => {
  const s = serie({ fecha: '2026-10-01', hora: '10:00', zona: 'UTC', duracionMin: 120, recurrencia: { frecuencia: 'diaria', fin: { tipo: 'nunca' } } });
  const desde = Date.UTC(2026, 9, 2, 11);
  const oc = ocurrencias(s, desde, Date.UTC(2026, 9, 3, 10));
  assert.deepEqual(oc.map((o) => o.fecha), ['2026-10-02'], 'la del 2 sigue en curso a las 11; la del 3 empieza justo al cierre');
});

test('un evento que no se repite: una sola ocurrencia', () => {
  const s = serie({ fecha: '2026-10-15', hora: '18:00', zona: 'America/Mexico_City' });
  const oc = ocurrencias(s, Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 1));
  assert.equal(oc.length, 1);
  assert.equal(paredEn(oc[0].inicio, 'America/Mexico_City'), '18:00');
});

// ── «Este y los siguientes» ──────────────────────────────────────────────────────

test('partir una serie: el índice de la fecha, el fin de cada mitad y las excepciones', () => {
  const s = serie({ fecha: '2026-10-05', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'semanal', dias: [1], fin: { tipo: 'veces', veces: 10 } } });
  assert.equal(indiceDeFecha(s, '2026-10-05'), 0);
  assert.equal(indiceDeFecha(s, '2026-11-02'), 4);
  assert.equal(indiceDeFecha(s, '2026-11-03'), null, 'un martes no es de la serie');
  assert.equal(indiceDeFecha({ ...s, excepciones: ['2026-11-02'] }, '2026-11-02'), null, 'una borrada no se edita');
  const corte = leerFecha('2026-11-02')!;
  assert.deepEqual(partirSerie(s.recurrencia!, corte, 4), { antes: { tipo: 'veces', veces: 4 }, despues: { tipo: 'veces', veces: 6 } });
  assert.equal(partirSerie(s.recurrencia!, corte, 0), null, 'desde la primera no se parte: es «todos»');
  const nunca: Recurrencia = { ...s.recurrencia!, fin: { tipo: 'nunca' } };
  assert.deepEqual(partirSerie(nunca, corte, 4), { antes: { tipo: 'fecha', fecha: '2026-11-01' }, despues: { tipo: 'nunca' } });
  assert.deepEqual(partirExcepciones(['2026-10-12', '2026-11-02', '2026-11-09'], corte), { antes: ['2026-10-12'], despues: ['2026-11-02', '2026-11-09'] });
});

test('la serie vieja termina justo antes del corte y la nueva arranca ahí: ninguna ocurrencia se repite ni se pierde', () => {
  const s = serie({ fecha: '2026-10-05', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'semanal', dias: [1], fin: { tipo: 'veces', veces: 6 } } });
  const corte = leerFecha('2026-10-26')!;
  const k = indiceDeFecha(s, '2026-10-26')!;
  const p = partirSerie(s.recurrencia!, corte, k)!;
  const vieja = { ...s, recurrencia: { ...s.recurrencia!, fin: p.antes } };
  const nueva = serie({ fecha: '2026-10-26', hora: '10:00', zona: 'UTC', recurrencia: { frecuencia: 'semanal', dias: [1], fin: p.despues } });
  const rango = [Date.UTC(2026, 9, 1), Date.UTC(2027, 1, 1)] as const;
  const juntas = [...ocurrencias(vieja, ...rango), ...ocurrencias(nueva, ...rango)].map((o) => o.fecha);
  assert.deepEqual(juntas, ocurrencias(s, ...rango).map((o) => o.fecha));
});

// ── Validar ──────────────────────────────────────────────────────────────────────

test('sanear: la zona existe, la duración va de 30 min a 24 h, el link es web y la portada pasa por el saneo', () => {
  const base = { titulo: 'Clase', fecha: '2026-10-15', hora: '18:00', zona: 'America/Mexico_City', duracionMin: 60 };
  assert.equal(sanearEvento({ ...base, zona: 'Marte/Olympus' }).ok, false);
  assert.equal(sanearEvento({ ...base, duracionMin: 15 }).ok, false);
  assert.equal(sanearEvento({ ...base, duracionMin: 1441 }).ok, false);
  assert.equal(sanearEvento({ ...base, fecha: '2026-02-30' }).ok, false, 'una fecha que no existe');
  assert.equal(sanearEvento({ ...base, hora: '25:00' }).ok, false);
  assert.equal(sanearEvento({ ...base, lugarTipo: 'link', lugar: 'javascript:alert(1)' }).ok, false);
  assert.equal(linkDeLugar('zoom.us/j/123'), 'https://zoom.us/j/123');
  // Corto escrito, largo guardado (cada «ñ» normalizada son seis letras): no entra en el CHECK de 600.
  assert.equal(linkDeLugar(`https://zoom.us/j/1?pwd=${'ñ'.repeat(120)}`), null);
  const v = sanearEvento({ ...base, portada: 'javascript:alert(1)' });
  assert.ok(v.ok && v.evento.portada === null, 'una portada que no es del catálogo ni de un origen permitido es «sin portada»');
  assert.equal(esZonaValida('UTC'), true);
});

test('una semanal siempre incluye el día de la semana del inicio; el fin no puede ir antes del inicio', () => {
  const r = sanearRecurrencia({ frecuencia: 'semanal', dias: [3] }, leerFecha('2026-10-12')!);
  assert.ok(r.ok && r.recurrencia);
  assert.deepEqual(r.recurrencia.dias, [1, 3], 'el lunes 12 entra solo');
  assert.equal(sanearRecurrencia({ frecuencia: 'diaria', fin: { tipo: 'fecha', fecha: '2026-10-01' } }, leerFecha('2026-10-12')!).ok, false);
  assert.equal(sanearRecurrencia({ frecuencia: 'anual' }, leerFecha('2026-10-12')!).ok, false);
  assert.deepEqual(sanearRecurrencia(null, leerFecha('2026-10-12')!), { ok: true, recurrencia: null });
  assert.deepEqual(excepcionesGuardadas(['2026-10-12', 'x', '2026-02-30', '2026-10-12']), ['2026-10-12']);
});

// ── El acceso ────────────────────────────────────────────────────────────────────

test('acceso: todos, desde un nivel, con un módulo; el equipo entra siempre; uno roto deja afuera al alumno', () => {
  const alumno = (nivel: number, modulos: string[] = []) => ({ equipo: false, nivel, tieneModulo: (k: string) => modulos.includes(k) });
  const equipo = { equipo: true, nivel: 1, tieneModulo: () => false };
  assert.equal(accesoPermite({ tipo: 'todos' }, alumno(1)), true);
  assert.equal(accesoPermite({ tipo: 'nivel', nivel: 3 }, alumno(2)), false);
  assert.equal(accesoPermite({ tipo: 'nivel', nivel: 3 }, alumno(3)), true);
  assert.equal(accesoPermite({ tipo: 'modulo', clave: 'arranque' }, alumno(9)), false, 'el nivel no abre un módulo');
  assert.equal(accesoPermite({ tipo: 'modulo', clave: 'arranque' }, alumno(1, ['arranque'])), true);
  assert.equal(accesoPermite({ tipo: 'nivel', nivel: 9 }, equipo), true);
  assert.equal(accesoGuardado({ tipo: 'nivel' }), null, 'un nivel sin número no se lee como «todos»');
  assert.equal(accesoPermite(null, alumno(9, ['x'])), false);
  assert.equal(accesoPermite(null, equipo), true);
  assert.deepEqual(sanearAcceso({ tipo: 'nivel', nivel: 1 }), { ok: true, acceso: { tipo: 'todos' } }, 'el nivel 1 es todos');
  assert.equal(motivoBloqueo({ tipo: 'nivel', nivel: 3 }), 'Desde el nivel 3');
  assert.equal(motivoBloqueo({ tipo: 'modulo', clave: 'k' }, 'Arranque'), 'Con el módulo «Arranque»');
});

test('el texto de la serie es corto y dice el fin', () => {
  const r: Recurrencia = { frecuencia: 'semanal', cada: 1, dias: [1, 3], fin: { tipo: 'veces', veces: 10 } };
  assert.equal(textoRecurrencia(r, leerFecha('2026-10-12')), 'Cada semana: lun, mié · 10 veces');
  assert.equal(textoRecurrencia({ ...r, frecuencia: 'mensual', cada: 2, fin: { tipo: 'fecha', fecha: '2026-12-15' } }, leerFecha('2026-10-15')), 'Cada 2 meses, el día 15 · hasta el 15 dic 2026');
  assert.equal(textoRecurrencia(null, null), null);
});

// ── El .ics ──────────────────────────────────────────────────────────────────────

const lineas = (ics: string) => ics.split('\r\n');

test('.ics: CRLF, plegado a 75 octetos, texto escapado (la barra primero)', () => {
  assert.equal(escaparIcs('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const larga = `DESCRIPTION:${'ñ'.repeat(80)}`;
  const plegada = plegar(larga);
  for (const l of plegada.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, `una línea de ${new TextEncoder().encode(l).length} octetos`);
  assert.equal(plegada.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), larga, 'desplegar devuelve lo mismo');
  const ics = icsDeOcurrencia({ uid: 'u@x', titulo: 'Clase, en vivo', descripcion: 'Trae\npreguntas', lugarTipo: 'link', lugar: 'https://meet.google.com/abc', ahoraMs: Date.UTC(2026, 9, 1), inicioMs: Date.UTC(2026, 9, 15, 23), finMs: Date.UTC(2026, 9, 16, 0) });
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'ningún salto sin su CR');
  const l = lineas(ics);
  assert.ok(l.includes('DTSTART:20261015T230000Z') && l.includes('DTEND:20261016T000000Z'), 'una ocurrencia va en UTC');
  assert.ok(l.includes('SUMMARY:Clase\\, en vivo'));
});

test('.ics de la serie: DTSTART con su zona, RRULE, EXDATE y un VTIMEZONE con los cambios reales', () => {
  const s = serie({ fecha: '2026-03-02', hora: '09:00', zona: 'America/Tijuana', recurrencia: { frecuencia: 'semanal', dias: [1, 3], fin: { tipo: 'fecha', fecha: '2026-11-30' } } }, ['2026-03-16']);
  const l = lineas(icsDeSerie({ uid: 'u@x', titulo: 'Clase', descripcion: '', lugarTipo: 'direccion', lugar: 'Av. Siempreviva 742', ahoraMs: Date.UTC(2026, 0, 1), serie: s }));
  assert.ok(l.includes('DTSTART;TZID=America/Tijuana:20260302T090000'));
  assert.ok(l.includes('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;WKST=MO;UNTIL=20261130T170000Z'), 'el UNTIL en UTC: 9:00 de Tijuana el 30/11 son las 17:00 Z');
  assert.ok(l.includes('EXDATE;TZID=America/Tijuana:20260316T090000'));
  const i = l.indexOf('BEGIN:DAYLIGHT');
  assert.deepEqual(l.slice(i, i + 5), ['BEGIN:DAYLIGHT', 'DTSTART:20260308T020000', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'END:DAYLIGHT']);
  const j = l.lastIndexOf('BEGIN:STANDARD');
  assert.deepEqual(l.slice(j, j + 5), ['BEGIN:STANDARD', 'DTSTART:20261101T020000', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'END:STANDARD']);
  assert.ok(!l.some((x) => x.startsWith('URL:')), 'una dirección no es un link');
});

test('los cambios de horario se encuentran al minuto (Santiago, hemisferio sur)', () => {
  const c = cambiosDeHorario('America/Santiago', Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1));
  assert.deepEqual(c.map((x) => [iso(x.ms), x.de, x.a]), [['2026-04-05T03:00:00.000Z', -180, -240], ['2026-09-06T04:00:00.000Z', -240, -180]]);
});

// ── El rango que pide el navegador (la revisión del 08/10/2026) ─────────────────

test('el rango del calendario se acota: ±10 años de hoy y 130 días como mucho (lo pide el navegador del alumno)', () => {
  const hoy = Date.UTC(2026, 9, 8, 12);
  // Lo normal pasa tal cual.
  assert.deepEqual(rangoDeCalendario(hoy - 8 * DIA, hoy + 30 * DIA, hoy), { desde: hoy - 8 * DIA, hasta: hoy + 30 * DIA });
  // El año 2200 (o uno fuera del rango de `Date`): `desde` vuelve al horizonte, y nada tira.
  const lejos = rangoDeCalendario(Date.UTC(2200, 0, 1), Date.UTC(2200, 1, 1), hoy);
  assert.equal(lejos.desde, hoy + HORIZONTE_MS);
  assert.ok(lejos.hasta > lejos.desde && lejos.hasta - lejos.desde <= RANGO_MAX_MS);
  assert.doesNotThrow(() => new Date(rangoDeCalendario(8.64e15 * 10, 9e15 * 10, hoy).hasta).toISOString());
  assert.equal(rangoDeCalendario(-1e15, 0, hoy).desde, hoy - HORIZONTE_MS);
  // Basura: la semana pasada y seis semanas.
  assert.deepEqual(rangoDeCalendario('x', null, hoy), { desde: hoy - 7 * DIA, hasta: hoy - 7 * DIA + 42 * DIA });
  assert.deepEqual(rangoDeCalendario({}, [], hoy), { desde: hoy - 7 * DIA, hasta: hoy - 7 * DIA + 42 * DIA });
  // Más de 130 días se recorta; `hasta` antes que `desde`, seis semanas.
  assert.equal(rangoDeCalendario(hoy, hoy + 400 * DIA, hoy).hasta, hoy + RANGO_MAX_MS);
  assert.equal(rangoDeCalendario(hoy, hoy - DIA, hoy).hasta, hoy + 42 * DIA);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/comunidad-2/romper.mjs, restaura de memoria), contra este archivo de
// 19 tests. Cada rotura, sola, en lib/comunidad-eventos.ts:
//   · la serie suma días EN MILISEGUNDOS (la deriva del cambio de horario): 4 fallos, 15 pases;
//   · la hora de pared con UNA sola pasada: 1 fallo, 18 pases (el 8/3 de Tijuana, justo el del salto);
//   · el mensual del 31 corrido al 30 en vez de saltear el mes: 1 / 18;
//   · «tras N veces» con una de más: 7 / 12 · la fecha de fin exclusiva: 1 / 18;
//   · una semanal sin el día de la semana del inicio: 1 / 18;
//   · «este y los siguientes»: la serie nueva vuelve a tener N: 2 / 17 · la vieja incluye el día del
//     corte (la ocurrencia sale dos veces): 1 / 18;
//   · un acceso roto que abre a todos: 1 / 18 · el nivel abre un evento «con un módulo»: 1 / 18;
//   · el .ics con LF: 2 / 17 · sin escapar la barra: 1 / 18 · plegado a 80: 1 / 18 · el UNTIL en hora
//     local: 1 / 18 · el VTIMEZONE con el desvío de después: 1 / 18 · la búsqueda del cambio de
//     horario al revés: 2 / 17.
// La REVISIÓN (08/10/2026, scratchpad/revision-comunidad/romper.mjs), con 20 tests: `rangoDeCalendario`
// sin el tope de ±10 años · el link de la llamada sin el tope sobre lo normalizado: 1 fallo, 19 pases
// cada una. Las dieciséis de arriba, re-medidas: los mismos fallos y un pase más cada una.
