// =============================================================================
// MaKo Mobile — el Calendario del teléfono (app/m/calendario) y lo que comparte con escritorio (app/calendario/comun.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · lee lo MISMO que escritorio (`leerCalendario`, lo visible por defecto, sin la llamada repetida) y en un rango que
//     cubre la tira de la semana Y la Agenda entera (si no, cambiar de vista mentiría «no hay nada»);
//   · la Agenda son los treinta días de la de escritorio desde `fecha`, sólo los días con algo, con la banda del mes;
//   · el Día: lo que dura poco se dibuja de 44 px y las columnas se cuentan con ESE alto (si no, uno de 15 minutos
//     tapa al de las 10:30); la ventana de horas se estira para que entre todo y la línea de ahora;
//   · «no pude leer» no es «no hay»; Google sin conectar no es un fallo;
//   · las vistas tienen el nombre y el orden de escritorio; lo que se mudó a comun.ts sigue diciendo lo mismo y vive en
//     UN lugar;
//   · «Evento borrado» sale sólo con su Deshacer (un borrado vacío no pisa el toast del bueno). Que la hoja no reciba
//     el segundo toque mientras se cierra lo fija tests/m-sheet-cierre.test.ts.
//
// Verificado ROMPIÉNDOLO (15/10/2026), cada rotura contra la base en verde (11/11) y restaurando el archivo después:
//   · `diaEnGrilla` contando las columnas con el fin real (sin el alto mínimo): 10 / 1 («se pisan»).
//   · `gruposDeAgenda` arrancando en el lunes de lo leído (no en `fecha`): 10 / 1.
//   · `rangoDeLectura` hasta el domingo de la semana (no hasta el fin de la Agenda): 10 / 1.
//   · CalendarioM sin `sinLlamadasRepetidas` (dibujando la llamada dos veces): 10 / 1 (el estructural).
//   · `fraseDeFallos` contando 'sin-conexion' como fallo: 10 / 1.
//   · (base 12 / 0) el borrado propio con `toast('Evento borrado', b ? {…} : undefined)` de vuelta: 11 / 1; un
//     `if (!b) { toast('Evento borrado'); return; }` antes del bueno: 11 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ItemCalendario } from '../lib/calendario-modelo';
import type { CalendarioGoogle } from '../lib/calendario-google-modelo';
import {
  ALTO_MIN_PX, VISTAS_M, borradorNuevo, diaEnGrilla, diasConAlgo, enRango, fechaDeParam, fechaParaCrear, fraseDeFallos,
  gruposDeAgenda, lineaDelEvento, queEnLaComputadora, rangoDeLectura, rotuloDelMes, semanaDe, sumarMeses, vistaDeParam,
} from '../app/m/calendario/modelo';
import {
  entradaGoogle, entradaPropia, lineaDeFecha, rangoGoogle, sinLlamadasRepetidas, tituloDe, vaAGoogle, visiblesPorDefecto,
} from '../app/calendario/comun';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Tijuana en octubre: UTC-7 (el horario de verano termina el 1/11/2026).
const TZ = 'America/Tijuana';
const HOY = '2026-10-15'; // jueves
const it = (p: Partial<ItemCalendario>): ItemCalendario => ({
  id: 'x', fuente: 'propio', capa: 'bloques', titulo: 'Algo', inicio: '2026-10-15T17:00:00.000Z', fin: null,
  diaCompleto: false, href: null, ...p,
});
const cal = (p: Partial<CalendarioGoogle>): CalendarioGoogle => ({
  id: 'c', nombre: 'Trabajo', color: '#039be5', primario: false, editable: true, seleccionado: true, ...p,
});

test('las vistas: Día y Agenda, con el nombre y el orden de escritorio; la URL de la computadora abre lo más parecido', () => {
  assert.deepEqual(VISTAS_M.map((v) => v.label), ['Día', 'Agenda']);
  assert.equal(vistaDeParam(undefined), 'agenda', 'la portada es la Agenda');
  for (const v of ['dia', 'semana', '4dias']) assert.equal(vistaDeParam(v), 'dia', v);
  for (const v of ['mes', 'anio', 'agenda', 'x']) assert.equal(vistaDeParam(v), 'agenda', v);
  assert.equal(vistaDeParam(['dia', 'agenda']), 'dia');
  assert.equal(fechaDeParam('2026-11-03', HOY), '2026-11-03');
  for (const f of ['2026-02-30', '2026-13-01', 'mañana', '', undefined, ['x']]) assert.equal(fechaDeParam(f, HOY), HOY, String(f));
});

test('se lee desde el lunes de la semana hasta el fin de la Agenda de escritorio (30 días desde la fecha)', () => {
  const r = rangoDeLectura(HOY);
  assert.deepEqual(r, { desde: '2026-10-12', hasta: '2026-11-14' });
  // La tira entera de la semana cae en lo leído (sus puntos dicen la verdad).
  for (const d of semanaDe(HOY)) assert.ok(enRango(d, r), d);
  assert.deepEqual(semanaDe(HOY), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.ok(!enRango('2026-11-14', r), '`hasta` es exclusivo');
  const puntos = diasConAlgo([it({ id: 'a' }), it({ id: 'b', inicio: '2026-10-20T16:00:00.000Z' })], r, TZ);
  assert.deepEqual([...puntos].sort(), ['2026-10-15', '2026-10-20']);
});

test('el mes se dibuja como en la app de Google: sin el año si es el de hoy', () => {
  assert.equal(rotuloDelMes('2026-10-15', HOY), 'Octubre');
  assert.equal(rotuloDelMes('2027-01-04', HOY), 'Enero de 2027');
  assert.equal(sumarMeses('2026-12-20', 1), '2027-01-01');
  assert.equal(sumarMeses('2026-01-31', -1), '2025-12-01');
});

test('la Agenda: los días con algo desde la fecha (lo de antes, aunque se haya leído, no), con la banda del mes', () => {
  const items = [
    it({ id: 'antes', inicio: '2026-10-13T17:00:00.000Z' }),
    it({ id: 'hoy', inicio: '2026-10-15T17:00:00.000Z' }),
    it({ id: 'nov', inicio: '2026-11-02T20:00:00.000Z' }),
  ];
  const g = gruposDeAgenda(items, HOY, HOY, TZ);
  assert.deepEqual(g.map((x) => [x.dia, x.mes, x.items.map((i) => i.id)]), [
    ['2026-10-15', null, ['hoy']],
    ['2026-11-02', 'Noviembre', ['nov']],
  ]);
  assert.deepEqual(gruposDeAgenda([], HOY, HOY, TZ), []);
});

test('el Día: lo corto se dibuja de 44 px y las columnas se cuentan con ese alto', () => {
  const corto = it({ id: 'corto', inicio: '2026-10-15T17:00:00.000Z', fin: '2026-10-15T17:15:00.000Z' }); // 10:00-10:15
  const despues = it({ id: 'despues', inicio: '2026-10-15T17:30:00.000Z', fin: '2026-10-15T18:00:00.000Z' }); // 10:30-11:00
  const todo = it({ id: 'todo', inicio: '2026-10-15T07:00:00.000Z', diaCompleto: true });
  const g = diaEnGrilla([corto, despues, todo], HOY, TZ, null);
  assert.deepEqual(g.arriba.map((x) => x.id), ['todo']);
  assert.deepEqual([g.desde, g.hasta], [8, 20], 'la ventana de siempre');
  const a = g.bloques.find((b) => b.item.id === 'corto')!;
  const b = g.bloques.find((b) => b.item.id === 'despues')!;
  assert.equal(a.alto, ALTO_MIN_PX);
  assert.equal(a.top, 120, 'las 10 son 2 horas después de las 8');
  assert.equal(a.rango, '10 – 10:15 a.m.', 'el texto dice la hora REAL, no la dibujada');
  // Dibujado, el de las 10:00 llega a las 10:44 y pisa al de las 10:30: van lado a lado.
  assert.deepEqual([a.col, a.cols, b.col, b.cols], [0, 2, 1, 2], 'se pisan');
});

test('el Día: la ventana se estira para lo de temprano, lo de la noche y la línea de ahora', () => {
  const temprano = it({ id: 't', inicio: '2026-10-15T13:30:00.000Z' }); // 6:30
  const tarde = it({ id: 'n', inicio: '2026-10-16T06:50:00.000Z' }); // 23:50 del 15
  const g = diaEnGrilla([temprano, tarde], HOY, TZ, null);
  assert.deepEqual([g.desde, g.hasta], [6, 24]);
  const n = g.bloques.find((x) => x.item.id === 'n')!;
  assert.equal(n.top + n.alto, (24 - 6) * 60, 'el de las 23:50 no se sale de la grilla');
  assert.deepEqual(((x) => [x.desde, x.hasta])(diaEnGrilla([], HOY, TZ, 22 * 60 + 10)), [8, 23]);
});

test('la segunda línea de un evento: la hora y qué es, sin repetir el R1 del título', () => {
  const crm = it({ fuente: 'crm', capa: 'llamadas', titulo: 'Ana Pérez', detalle: 'R1 · closer Ana', inicio: '2026-10-15T17:30:00.000Z' });
  assert.equal(tituloDe(crm, TZ), 'Ana Pérez · R1');
  assert.equal(lineaDelEvento(crm, TZ), '10:30 a.m. · closer Ana');
  const cobro = it({ fuente: 'cobro', capa: 'cobros', diaCompleto: true, inicio: '2026-10-15T07:00:00.000Z', detalle: 'Cuota 2 · US$750' });
  assert.equal(lineaDelEvento(cobro, TZ), 'Todo el día · Cuota 2 · US$750');
  const reel = it({ tipo: 'publicacion', formato: 'reel', capa: 'publicaciones' });
  assert.equal(lineaDelEvento(reel, TZ), '10 a.m. · Reel');
  const g = it({ fuente: 'google', capa: 'llamadas', fin: '2026-10-15T18:00:00.000Z' });
  assert.equal(lineaDelEvento(g, TZ), '10 – 11 a.m.');
});

test('«no pude leer» se dice en una frase; Google sin conectar no es un fallo, es lo que se hace en la computadora', () => {
  assert.equal(fraseDeFallos({}, null), null);
  assert.equal(fraseDeFallos({ google: 'sin-conexion' }, null), null);
  assert.equal(fraseDeFallos({ plan: true, cobros: true }, null), 'No pude leer los deadlines del Plan y los cobros.');
  assert.equal(
    fraseDeFallos({ crm: true }, { calendarios: [], puedeEscribir: true, fallaron: ['Feriados'], recortado: false, cuenta: null }),
    'No pude leer las reuniones del CRM y Feriados.',
  );
  assert.equal(queEnLaComputadora({ google: 'sin-conexion' }), 'Conectar Google Calendar');
  assert.equal(queEnLaComputadora({}), 'Semana, Mes y plantillas');
});

test('crear: el borrador de escritorio (una hora, al Google principal si hay dónde) y el día en el que nace', () => {
  const editables = [cal({ id: 'otro' }), cal({ id: 'yo', primario: true })];
  const b = borradorNuevo('2026-10-16', 10 * 60, editables);
  assert.deepEqual(b, { tipo: 'evento', titulo: '', fecha: '2026-10-16', hora: '10:00', horaFin: '11:00', formato: 'reel', calendarioId: 'yo' });
  assert.equal(borradorNuevo(HOY, 23 * 60, []).horaFin, '23:59');
  assert.equal(borradorNuevo(HOY, 600, []).calendarioId, null);
  assert.ok(vaAGoogle(b, editables));
  assert.ok(!vaAGoogle({ tipo: 'publicacion' }, editables), 'una publicación es de MaKo');
  assert.ok(!vaAGoogle(b, []), 'sin dónde escribir en Google, a MaKo');
  assert.deepEqual(entradaPropia({ ...b, tipo: 'llamada' }), { titulo: 'Llamada', tipo: 'llamada', formato: null, fecha: '2026-10-16', hora: '10:00', duracionMin: 60 });
  assert.deepEqual(entradaGoogle({ ...b, horaFin: null }), { titulo: '', fecha: '2026-10-16', hora: '10:00', duracionMin: 60, fechaFin: null });
  assert.equal(fechaParaCrear('dia', '2026-10-20', HOY, HOY), '2026-10-20');
  assert.equal(fechaParaCrear('agenda', '2026-10-20', '2026-10-01', HOY), HOY, 'hoy, si está en la Agenda');
  assert.equal(fechaParaCrear('agenda', HOY, '2026-12-01', HOY), '2026-12-01');
});

test('lo que se mudó a comun.ts dice lo mismo que decía en escritorio', () => {
  assert.equal(rangoGoogle('10:00', '11:00'), '10 – 11 a.m.');
  assert.equal(rangoGoogle('10:30', '13:00'), '10:30 a.m. – 1 p.m.');
  assert.equal(rangoGoogle('09:00', null), '9 a.m.');
  assert.equal(lineaDeFecha(it({ fin: '2026-10-15T18:00:00.000Z' }), TZ), 'jueves, 15 de octubre · 10 – 11 a.m.');
  // La reunión del CRM y su evento de Google (el mismo minuto): queda la del CRM.
  const crm = it({ id: 'crm:1:R1', fuente: 'crm', capa: 'llamadas' });
  const gcal = it({ id: 'google:c:1', fuente: 'google', capa: 'llamadas', inicio: '2026-10-15T17:01:00.000Z' });
  assert.deepEqual(sinLlamadasRepetidas([crm, gcal]).map((x) => x.id), ['crm:1:R1']);
  assert.deepEqual(sinLlamadasRepetidas([gcal]).map((x) => x.id), ['google:c:1'], 'sin la del CRM a la vista, la de Google se ve');
  const vis = visiblesPorDefecto([cal({ id: 'si' }), cal({ id: 'no', seleccionado: false })]);
  assert.ok(vis.has('mk:plan') && vis.has('g:si') && !vis.has('g:no'));
});

test('el teléfono y escritorio leen y filtran con LO MISMO, y cada regla vive en UN lugar', () => {
  const pagina = leer('app/m/calendario/page.tsx');
  assert.match(pagina, /await requireMovil\(\{ navKey: 'calendario' \}\)/);
  assert.match(pagina, /leerCalendario\(rango\.desde, rango\.hasta, tz\)/);
  assert.doesNotMatch(pagina, /\bws\b\s*[:=?]|searchParams\.ws|sp\.ws/, 'el workspace nunca sale de la URL');
  const movil = leer('app/m/calendario/CalendarioM.tsx');
  const escritorio = leer('app/calendario/CalendarioApp.tsx');
  for (const src of [movil, escritorio]) {
    assert.match(src, /visiblesPorDefecto\(calendarios\)/);
    assert.match(src, /sinLlamadasRepetidas\(/);
  }
  // Las escrituras son las server actions de escritorio (con su guard), y revalidan solas: sin un segundo refresh.
  assert.match(movil, /from '@\/app\/calendario\/actions'/);
  assert.doesNotMatch(movil, /router\.refresh\(\)/);
  const carpeta = readdirSync(join(RAIZ, 'app/m/calendario'));
  for (const f of carpeta.filter((x) => /\.tsx?$/.test(x))) assert.doesNotMatch(leer(`app/m/calendario/${f}`), /^'use server'/m, f);
  // Lo mudado a comun.ts (puro) ya no se define en los 'use client' de escritorio.
  assert.doesNotMatch(leer('app/calendario/comun.ts'), /'use client'/);
  for (const f of ['VistaTiempo.tsx', 'Tarjetas.tsx', 'CalendarioApp.tsx']) {
    assert.doesNotMatch(leer(`app/calendario/${f}`), /function (rangoGoogle|tituloDe|lineaDeFecha)\b|const (duracionEntre|entradaPropia|entradaGoogle|TIPOS_RAPIDO) =/, f);
  }
});

test('«Evento borrado» va siempre con su Deshacer: un borrado que no borró nada no pisa el toast del que sí', () => {
  // `borrarEventoAction` da null si la fila ya no estaba; el toast nuevo REEMPLAZA al anterior (ShellM), así que un
  // «Evento borrado» sin Deshacer después del bueno dejaba sin vuelta atrás un evento que sí se borró.
  const movil = leer('app/m/calendario/CalendarioM.tsx');
  const dichos = [...movil.matchAll(/toast\('Evento borrado'/g)].map((m) => movil.slice(m.index, m.index + 80));
  assert.ok(dichos.length > 0, 'no encontré el toast del borrado');
  for (const d of dichos) assert.match(d, /^toast\('Evento borrado', \{\s*deshacer:/, d);
});
