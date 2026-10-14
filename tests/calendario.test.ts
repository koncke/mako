// Tests del Calendario (la tab nueva, 13/10/2026). Martín: «debería ser "CALENDARIO" y listo... que sea simple de
// usar, que sirva para todos los casos, que tenga IA que te ayude o "templates" y que no sea restrictivo».
// Lo que se prueba es lo PURO (lib/calendario-modelo.ts) y los cableados que lo hacen verdad:
//
//   · una hora de PARED se convierte con la zona del negocio y en dos pasadas (el día del salto de horario incluido);
//   · un texto de más se RECHAZA, no se recorta;
//   · la semana arranca el lunes y el mes dibuja semanas enteras;
//   · cada renglón cae en SU día en la zona del negocio, lo de todo el día primero;
//   · una reunión del CRM y el mismo evento de Google no salen dos veces;
//   · las plantillas sólo traen eventos que se pueden agendar;
//   · (14/10/2026) «¿Qué vas a crear hoy?» no vuelve; sin Google, la tab abre el modal de conectarlo AHÍ; lo que se
//     repite se dibuja hacia adelante con la cuenta del generador; los cobros que vencen; una reunión cancelada no se
//     dibuja.
//
// Probado rompiéndolo (14/10/2026), cada rotura contra la base en verde (16 de 16), restaurando de memoria:
//   · la hora como UTC pelada, sin `instanteDe` → 1 fallo, 15 pases;
//   · el título recortado en vez de rechazado → 1 fallo, 15 pases;
//   · la semana arrancando el domingo → 2 fallos, 14 pases;
//   · agrupar por el día en UTC (no en la zona del negocio) → 1 fallo, 15 pases;
//   · sin deduplicar Google contra el CRM → 1 fallo, 15 pases;
//   · `marcarEventoAction` sin `await guard()` → 1 fallo, 15 pases.
//
// Correr: npx tsx --test tests/calendario.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  filaDeEntrada, rangoDeVista, moverFecha, lunesDe, sumarDias, diaDeLaSemana, itemsPorDia, sinDuplicarLlamadas,
  quartersDelRango, PLANTILLAS_CALENDARIO, entradasDePlantilla, rotuloDeRango, horaDe, diaDe, proximasVeces, itemDeCuota,
  filtrarPlantillasCalendario, capaDeTipo, TOPE_TITULO, type ItemCalendario,
  horaGoogle, fechaLarga, semanasDelMes, columnasDelDia, barrasDeLaFila,
} from '../lib/calendario-modelo';
import { eventoDeGoogle, calendarioDeGoogle, cuerpoEventoGoogle, ordenarCalendarios } from '../lib/calendario-google-modelo';

const leer = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const TJ = 'America/Tijuana';

test('una hora de pared se convierte con la zona del negocio, también el día del salto de horario', () => {
  // 7/3/2026 todavía es PST (UTC-8); el 8/3/2026 a las 9:00 ya es PDT (UTC-7).
  const antes = filaDeEntrada({ titulo: 'Reel', tipo: 'publicacion', formato: 'reel', fecha: '2026-03-07', hora: '09:00' }, TJ);
  const dia = filaDeEntrada({ titulo: 'Reel', tipo: 'publicacion', formato: 'reel', fecha: '2026-03-08', hora: '09:00' }, TJ);
  assert.ok(antes.ok && dia.ok);
  if (antes.ok) assert.equal(antes.fila.inicio, '2026-03-07T17:00:00.000Z');
  if (dia.ok) assert.equal(dia.fila.inicio, '2026-03-08T16:00:00.000Z');
});

test('sin hora es de todo el día; con duración tiene fin', () => {
  const todo = filaDeEntrada({ titulo: 'Lanzamiento', tipo: 'otro', fecha: '2026-10-15', hora: null }, TJ);
  assert.ok(todo.ok && todo.fila.dia_completo && todo.fila.fin === null);
  const bloque = filaDeEntrada({ titulo: 'Guiones', tipo: 'bloque', fecha: '2026-10-15', hora: '10:00', duracionMin: 90 }, TJ);
  assert.ok(bloque.ok);
  if (bloque.ok) assert.equal(Date.parse(bloque.fila.fin!) - Date.parse(bloque.fila.inicio), 90 * 60_000);
});

test('un título de más se RECHAZA (no se recorta), y una fecha o una hora rota también', () => {
  assert.equal(filaDeEntrada({ titulo: 'x'.repeat(TOPE_TITULO + 1), tipo: 'bloque', fecha: '2026-10-15' }, TJ).ok, false);
  assert.equal(filaDeEntrada({ titulo: 'a', tipo: 'bloque', fecha: '2026-02-30' }, TJ).ok, false);
  assert.equal(filaDeEntrada({ titulo: 'a', tipo: 'bloque', fecha: '2026-10-15', hora: '25:00' }, TJ).ok, false);
  assert.equal(filaDeEntrada({ titulo: '   ', tipo: 'bloque', fecha: '2026-10-15' }, TJ).ok, false);
});

test('una publicación sin formato es un post; lo que no es publicación no lleva formato', () => {
  const p = filaDeEntrada({ titulo: 'a', tipo: 'publicacion', fecha: '2026-10-15' }, TJ);
  const b = filaDeEntrada({ titulo: 'a', tipo: 'bloque', formato: 'reel', fecha: '2026-10-15' }, TJ);
  assert.ok(p.ok && p.fila.formato === 'post');
  assert.ok(b.ok && b.fila.formato === null);
});

test('la semana arranca el lunes y el mes dibuja semanas enteras', () => {
  assert.equal(lunesDe('2026-10-14'), '2026-10-12');
  assert.equal(lunesDe('2026-10-18'), '2026-10-12');
  assert.equal(diaDeLaSemana('2026-10-12'), 0);
  const s = rangoDeVista('semana', '2026-10-14');
  assert.deepEqual([s.desde, s.hasta, s.dias.length], ['2026-10-12', '2026-10-19', 7]);
  const m = rangoDeVista('mes', '2026-10-14');
  assert.equal(m.dias.length % 7, 0);
  assert.equal(m.dias[0], '2026-09-28');
  assert.ok(m.dias.includes('2026-10-01') && m.dias.includes('2026-10-31'));
  assert.equal(moverFecha('semana', '2026-10-14', 1), '2026-10-19');
  assert.equal(moverFecha('mes', '2026-01-31', 1), '2026-02-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
});

// 14/10/2026: el título de la barra es el de Google Calendar en español (la copia fiel que pidió Martín).
test('el rótulo del rango, como lo escribe Google', () => {
  assert.equal(rotuloDeRango('semana', '2026-10-14'), 'octubre de 2026');
  assert.equal(rotuloDeRango('semana', '2026-09-30'), 'sep – oct de 2026');
  assert.equal(rotuloDeRango('semana', '2026-12-30'), 'dic de 2026 – ene de 2027');
  assert.equal(rotuloDeRango('mes', '2026-10-14'), 'octubre de 2026');
  assert.equal(rotuloDeRango('dia', '2026-10-14'), '14 de octubre de 2026');
  assert.equal(rotuloDeRango('anio', '2026-10-14'), '2026');
});

test('las seis vistas de Google: qué días dibuja cada una y a dónde llevan las flechas', () => {
  assert.deepEqual(rangoDeVista('dia', '2026-10-14').dias, ['2026-10-14']);
  assert.deepEqual(rangoDeVista('4dias', '2026-10-14').dias, ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  assert.equal(rangoDeVista('agenda', '2026-10-14').dias.length, 30);
  const a = rangoDeVista('anio', '2026-10-14');
  assert.deepEqual([a.desde, a.hasta, a.dias.length], ['2026-01-01', '2027-01-01', 0]);
  assert.equal(moverFecha('dia', '2026-10-14', -1), '2026-10-13');
  assert.equal(moverFecha('4dias', '2026-10-14', 1), '2026-10-18');
  assert.equal(moverFecha('anio', '2026-10-14', 1), '2027-01-01');
  assert.equal(horaGoogle('00:00'), '12 a.m.');
  assert.equal(horaGoogle('13:30'), '1:30 p.m.');
  assert.equal(fechaLarga('2026-10-14'), 'miércoles, 14 de octubre');
  assert.equal(semanasDelMes('2026-10-14').length, 6);
  assert.equal(semanasDelMes('2026-10-14')[0][0], '2026-09-28');
});

// Rotura (14/10/2026, base en verde): sin cerrar el grupo cuando un evento empieza después del fin del grupo, el de
// las 12 quedaba en una columna de 3 (1 fallo).
test('los eventos que se pisan comparten el ancho, como en Google', () => {
  const c = columnasDelDia([
    { id: 'a', ini: 9 * 60, fin: 10 * 60 },
    { id: 'b', ini: 9 * 60 + 30, fin: 11 * 60 },
    { id: 'c', ini: 10 * 60, fin: 10 * 60 + 30 },
    { id: 'd', ini: 12 * 60, fin: 13 * 60 },
  ]);
  assert.deepEqual(c.get('a'), { col: 0, cols: 2 });
  assert.deepEqual(c.get('b'), { col: 1, cols: 2 });
  // «c» empieza cuando «a» termina: reusa su columna.
  assert.deepEqual(c.get('c'), { col: 0, cols: 2 });
  assert.deepEqual(c.get('d'), { col: 0, cols: 1 });
});

// Rotura (14/10/2026, base en verde): sin el último día de un evento de Google (`fechaFin`), la barra del 13 al 15 se
// cortaba en el 13 (1 fallo).
test('un evento de varios días de Google es UNA barra, y el fin de Google es exclusivo', () => {
  const dias = rangoDeVista('semana', '2026-10-14').dias;
  const varios = item('viaje', '2026-10-13T07:00:00.000Z', {
    fuente: 'google', diaCompleto: true,
    google: { id: 'g1', calendarioId: 'c', titulo: 'viaje', inicio: '2026-10-13T07:00:00.000Z', fin: null, diaCompleto: true, fecha: '2026-10-13', fechaFin: '2026-10-15', color: '#039be5', colorId: null, ubicacion: '', descripcion: '', enlace: null, videollamada: null, invitados: 0, organizador: null, recurrente: false, rechazado: false, editable: true },
  });
  const uno = item('feriado', '2026-10-12T07:00:00.000Z', { diaCompleto: true });
  const r = barrasDeLaFila([varios, uno], dias, TJ);
  const b = r.barras.find((x) => x.item.id === 'viaje')!;
  assert.deepEqual([b.desde, b.hasta, b.carril], [1, 3, 0]);
  assert.equal(r.carriles, 1);
  assert.deepEqual(itemsPorDia([varios], dias, TJ).get('2026-10-15')!.map((i) => i.id), ['viaje']);
  assert.equal(itemsPorDia([varios], dias, TJ).get('2026-10-16')!.length, 0);
});

const item = (id: string, inicio: string, extra: Partial<ItemCalendario> = {}): ItemCalendario => ({
  id, fuente: 'propio', capa: 'bloques', titulo: id, inicio, fin: null, diaCompleto: false, href: null, ...extra,
});

test('cada renglón cae en SU día en la zona del negocio, lo de todo el día primero', () => {
  // 2026-10-14T05:00Z en Tijuana es el 13/10 a las 22:00: va al martes 13, no al miércoles 14.
  const dias = rangoDeVista('semana', '2026-10-14').dias;
  const m = itemsPorDia([
    item('noche', '2026-10-14T05:00:00.000Z'),
    item('tarde', '2026-10-13T22:00:00.000Z'),
    item('todo', '2026-10-13T07:00:00.000Z', { diaCompleto: true }),
  ], dias, TJ);
  assert.deepEqual(m.get('2026-10-13')!.map((i) => i.id), ['todo', 'tarde', 'noche']);
  assert.equal(m.get('2026-10-14')!.length, 0);
  assert.equal(horaDe('2026-10-14T05:00:00.000Z', TJ), '22:00');
  assert.equal(diaDe('2026-10-14T05:00:00.000Z', TJ), '2026-10-13');
});

test('una reunión del CRM y el mismo evento de Google no salen dos veces', () => {
  const crm = [item('crm', '2026-10-13T17:00:00.000Z', { fuente: 'crm', capa: 'llamadas' })];
  const google = [
    item('mismo', '2026-10-13T17:01:00.000Z', { fuente: 'google', capa: 'llamadas' }),
    item('otro', '2026-10-13T19:00:00.000Z', { fuente: 'google', capa: 'llamadas' }),
  ];
  assert.deepEqual(sinDuplicarLlamadas(crm, google).map((i) => i.id), ['otro']);
});

test('los Quarters del rango', () => {
  assert.deepEqual(quartersDelRango('2026-09-28', '2026-11-02').map((q) => `${q.anio}Q${q.q}`), ['2026Q3', '2026Q4']);
  const q4 = quartersDelRango('2026-12-28', '2027-01-04');
  assert.deepEqual(q4.map((q) => `${q.anio}Q${q.q}:${q.fin}`), ['2026Q4:2026-12-31', '2027Q1:2027-03-31']);
});

test('cada plantilla trae sólo eventos que se pueden agendar, dentro de su semana', () => {
  const lunes = '2026-10-12';
  for (const p of PLANTILLAS_CALENDARIO) {
    const es = entradasDePlantilla(p, lunes);
    assert.ok(es.length > 0, p.id);
    for (const e of es) {
      const r = filaDeEntrada(e, TJ);
      assert.ok(r.ok, `${p.id}: ${e.titulo} — ${r.ok ? '' : r.error}`);
      assert.ok(e.fecha >= lunes && e.fecha < sumarDias(lunes, 7), `${p.id}: ${e.fecha} fuera de la semana`);
    }
  }
  assert.ok(filtrarPlantillasCalendario(PLANTILLAS_CALENDARIO, 'guion').some((p) => p.id === 'guiones'));
});

test('cada tipo va a su capa', () => {
  assert.equal(capaDeTipo('publicacion'), 'publicaciones');
  assert.equal(capaDeTipo('llamada'), 'llamadas');
  assert.equal(capaDeTipo('bloque'), 'bloques');
  assert.equal(capaDeTipo('otro'), 'bloques');
});

// ── 14/10/2026: lo que se repite, los cobros, las reuniones canceladas y «¿Qué vas a crear hoy?» ──────────────────
// Probado rompiéndolo (14/10/2026) con el arnés que restaura de memoria, contra la base en verde (27 / 0): cada rotura
// de los encabezados de abajo dio 26 / 1, en el test que la cuida. Restaurado: 27 / 0.

const SIN = new Set<string>();
const SEMANA = { desde: '2026-10-12', hasta: '2026-10-19' };

// Rotura: `primero = p.desde` (sin el piso de HOY) → 1 fallo (el lunes 12 y el 13 salían); `cursor = antes` (sin el
// ancla) → 1 fallo (el día del ancla salía); sin el filtro de `conInstancia` → 1 fallo.
test('lo que se repite: las próximas veces, de hoy en adelante, sin el día del ancla ni el que ya tiene su tarea', () => {
  // 14/10/2026 es miércoles. «Lunes y miércoles», arrancada el 01/10.
  const lyx = { rrule: 'FREQ=WEEKLY;BYDAY=MO,WE', ancla: '2026-10-01', hoy: '2026-10-14' };
  assert.deepEqual(proximasVeces({ ...lyx, ...SEMANA, conInstancia: SIN }), ['2026-10-14']);
  // El mes de octubre (la grilla llega al 01/11): de hoy en adelante, nada hacia atrás.
  const mes = rangoDeVista('mes', '2026-10-14');
  assert.deepEqual(proximasVeces({ ...lyx, desde: mes.desde, hasta: mes.hasta, conInstancia: SIN }),
    ['2026-10-14', '2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']);
  // El día que ya tiene su tarea creada (se ve como deadline en «Plan») no se dibuja dos veces.
  assert.deepEqual(proximasVeces({ ...lyx, ...SEMANA, conInstancia: new Set(['2026-10-14']) }), []);
  // Una semana pasada: nada (lo que pasó son las tareas que nacieron, no el ritmo).
  assert.deepEqual(proximasVeces({ ...lyx, desde: '2026-10-05', hasta: '2026-10-12', conInstancia: SIN }), []);
  // El día del ANCLA no cuenta, como en el generador: «todos los días» arrancada el viernes 16 empieza el 17.
  assert.deepEqual(proximasVeces({ rrule: 'FREQ=DAILY', ancla: '2026-10-16', hoy: '2026-10-14', ...SEMANA, conInstancia: SIN }), ['2026-10-17', '2026-10-18']);
  // Cada 2 semanas cuenta desde el ancla (el lunes 05 es la semana 0: el 12 no, el 19 sí).
  assert.deepEqual(proximasVeces({ rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', ancla: '2026-10-05', hoy: '2026-10-12', desde: mes.desde, hasta: mes.hasta, conInstancia: SIN }), ['2026-10-19']);
  // «Se repite y nadie dijo cada cuánto»: sin regla no hay fecha.
  assert.deepEqual(proximasVeces({ rrule: null, ancla: null, hoy: '2026-10-14', ...SEMANA, conInstancia: SIN }), []);
});

// Rotura: `numero === 0` → `numero === 1` (la inicial como «Cuota 0») → 1 fallo.
test('un cobro que vence: a quién, cuál y cuánto, y lleva a la ficha', () => {
  const ini = '2026-10-20T07:00:00.000Z';
  const a = itemDeCuota({ id: 7, leadId: 42, numero: 0, montoUsd: 1500, vence: '2026-10-20' }, 'Ana', ini);
  assert.deepEqual([a.id, a.fuente, a.capa, a.titulo, a.detalle, a.href, a.diaCompleto], ['cobro:7', 'cobro', 'cobros', 'Cobrar a Ana', 'Pago inicial · US$1,500', '/crm/42', true]);
  const b = itemDeCuota({ id: 8, leadId: 42, numero: 2, montoUsd: 499.6, vence: '2026-10-20' }, null, ini);
  assert.deepEqual([b.titulo, b.detalle], ['Cobrar a Lead #42', 'Cuota 2 · US$500']);
});

/** El cuerpo de una función de lib/calendario.ts, de su firma a la siguiente. */
const funcion = (src: string, nombre: string) => {
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i > 0, `no encontré ${nombre}`);
  const j = src.indexOf('\nasync function ', i + 10);
  const k = src.indexOf('\nexport async function ', i + 10);
  const fin = [j, k].filter((x) => x > 0).sort((x, y) => x - y)[0] ?? src.length;
  return src.slice(i, fin);
};

// Rotura: sacar el `.not('fecha_junta_1', 'is', null)` → 1 fallo.
test('una reunión CANCELADA no se dibuja: conserva su hora y pierde la fecha (cancelarJuntaEnLead)', () => {
  const crm = funcion(sinComentarios(leer('../lib/calendario.ts')), 'leerCrm');
  assert.match(crm, /q\.gte\('junta_1_at', desdeIso\)\.lt\('junta_1_at', hastaIso\)\.not\('fecha_junta_1', 'is', null\)/);
  assert.match(crm, /q\.gte\('junta_2_at', desdeIso\)\.lt\('junta_2_at', hastaIso\)\.not\('fecha_junta_2', 'is', null\)/);
  // Y la definición de «cancelada» es la del CRM automático: la fecha vacía con la hora puesta.
  assert.match(leer('../lib/crm-auto-plan.ts'), /const r1Cancelada = l\.fecha_junta_1 == null && !!l\.junta_1_at;/);
});

// Rotura: `forzado ?? await tableroActual()` → `await tableroActual()` (la API leería por cookie) → 1 fallo.
test('lo que se repite sale de UNA cuenta para la pantalla y la API, y la API elige el tablero por CAPA', () => {
  const lib = sinComentarios(leer('../lib/calendario.ts'));
  assert.match(funcion(lib, 'leerRecurrentes'), /await recurrentesDelRango\(desde, hasta\)/);
  assert.match(funcion(lib, 'recurrentesDelRango'), /const que = forzado \?\? await tableroActual\(\);/);
  assert.match(funcion(lib, 'recurrentesDelRango'), /proximasVeces\(\{ rrule, ancla, desde, hasta, hoy, conInstancia:/);
  const run = sinComentarios(leer('../lib/api-mako/areas/calendario.run.ts'));
  const op = run.slice(run.indexOf('ver_proximas_recurrentes: {'), run.indexOf('crear_evento_google: {'));
  assert.match(op, /const que = tableroDeCapa\(/);
  assert.match(op, /recurrentesDelRango\(rango\.desde, sumarDias\(rango\.hasta, 1\), que\)/);
});

// Rotura: devolver la `CajaPedido` a app/calendario/PlantillasSemana.tsx → 1 fallo.
test('«¿Qué vas a crear hoy?» se fue del Calendario entero, con su IA', () => {
  assert.equal(existsSync(resolve(__dirname, '../lib/calendario-ia.ts')), false);
  assert.equal(existsSync(resolve(__dirname, '../app/api/calendario')), false);
  for (const f of ['CalendarioApp.tsx', 'PlantillasSemana.tsx', 'AgendarLlamada.tsx', 'page.tsx', 'actions.ts']) {
    const src = sinComentarios(leer(`../app/calendario/${f}`));
    assert.doesNotMatch(src, /CajaPedido|TITULO_CAJA|\/api\/calendario\/ia|calendario-ia|onConfirmarIA/, `${f} volvió a tener la caja`);
  }
  assert.doesNotMatch(sinComentarios(leer('../lib/model-catalogo.ts')), /'calendario-ia'/);
});

// Rotura: el «Conectar» del aviso de vuelta a `href: '/integraciones'` → 1 fallo; el efecto sin el chequeo de
// `sinGoogle` (abriría el modal con Google conectado) → 1 fallo.
test('sin Google Calendar, la tab abre EL modal de conectarlo ahí, y nunca navega a /integraciones', () => {
  const app = sinComentarios(leer('../app/calendario/CalendarioApp.tsx'));
  assert.doesNotMatch(app, /\/integraciones/);
  assert.match(app, /const integracion = useConectarIntegracion\(/);
  assert.match(app, /const sinGoogle = fallos\.google === 'sin-conexion';/);
  const efecto = app.slice(app.indexOf('useEffect(() => {\n    if (!sinGoogle || vueltaGoogle) return;'));
  assert.ok(efecto.length > 0 && app.includes('if (!sinGoogle || vueltaGoogle) return;'), 'el efecto que abre el modal al entrar');
  assert.match(efecto.slice(0, 500), /window\.sessionStorage\.getItem\(llave\)\) return;[\s\S]*abrirIntegracion\('google'\);/);
  assert.match(app, /servicio: 'google', link: 'Conectar'/);
  assert.match(app, /servicio: 'google', link: 'Reconectar'/);
  assert.match(app, /onClick=\{\(\) => abrirIntegracion\(a\.servicio!\)\}/);
  assert.match(app, /\{integracion\.modal\}/);
  // Y el OAuth vuelve a ESTA tab: el modal de Google lleva la pantalla a la que volver.
  assert.match(app, /useVueltaDeGoogle\(abrirIntegracion, googleOk\)/);
});

// 14/10/2026: desde que lo creado en MaKo se escribe en Google, el área ESCRIBE en la agenda (`crear_evento_google`) pero
// sigue sin LEERLA. Rotura (base en verde): llamar a leerAgendaGoogle desde el runner: 1 fallo.
test('la API de MaKo del Calendario escribe en Google pero no lee la agenda', () => {
  const run = sinComentarios(leer('../lib/api-mako/areas/calendario.run.ts'));
  assert.doesNotMatch(run, /google-calendar'|leerAgendaGoogle|leerCalendario/);
  assert.match(run, /crearEventoGoogle\('primary', /);
  const def = sinComentarios(leer('../lib/api-mako/areas/calendario.def.ts'));
  assert.match(def, /tab: 'calendario', rolMinimo: 'admin'/);
  const op = def.slice(def.indexOf("id: 'crear_evento_google'"));
  assert.match(op, /canales: SIN_HTTP, costo: 'externo', gating: GATING, datosDeGoogle: true,/);
  assert.match(def, /const SIN_HTTP = \['whatsapp', 'app'\] as const;/);
});

test('la tabla del Calendario está en las dos listas de inquilino', () => {
  const ws = leer('../lib/workspace.ts');
  const tablas = leer('../lib/tablas-de-inquilino.ts');
  assert.match(sinComentarios(ws), /'calendario_eventos'/);
  assert.match(sinComentarios(tablas), /'calendario_eventos'/);
});

test('las acciones del Calendario empiezan con el guard de la página', () => {
  const src = sinComentarios(leer('../app/calendario/actions.ts'));
  const exportadas = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.ok(exportadas.length >= 5);
  for (const nombre of exportadas) {
    const ini = src.indexOf(`export async function ${nombre}`);
    const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
    assert.match(cuerpo, /await guard\(\);/, `${nombre} sin guard`);
  }
  assert.match(src, /requireRolWs\(\[\], \{ nav: 'calendario' \}\)/);
});

// ── Google (14/10/2026: la copia fiel; todos los calendarios y escribir en ellos) ─────────────────────────────────

const CAL = calendarioDeGoogle({ id: 'c1', summary: 'Trabajo', backgroundColor: '#9FE1E7', accessRole: 'owner', selected: true })!;
const inicioTJ = (f: string) => `${f}T07:00:00.000Z`;

// Rotura (14/10/2026, base en verde): sin restar un día al fin exclusivo, `fechaFin` daba '2026-10-16' (1 fallo).
test('un evento de Google se lee como lo dibuja Google', () => {
  const todo = eventoDeGoogle({ id: 'e1', summary: ' Viaje ', start: { date: '2026-10-14' }, end: { date: '2026-10-16' }, colorId: '11' }, CAL, inicioTJ)!;
  assert.deepEqual([todo.fecha, todo.fechaFin, todo.diaCompleto, todo.titulo, todo.color], ['2026-10-14', '2026-10-15', true, 'Viaje', '#d50000']);
  const conHora = eventoDeGoogle({
    id: 'e2', start: { dateTime: '2026-10-14T10:00:00-07:00' }, end: { dateTime: '2026-10-14T11:00:00-07:00' },
    attendees: [{ email: 'yo@x.com', self: true, responseStatus: 'declined' }, { email: 'sala@x.com', resource: true }, { email: 'otra@x.com' }],
    organizer: { email: 'jefa@x.com', self: false }, hangoutLink: 'https://meet.google.com/abc', recurringEventId: 'r1',
  }, CAL, inicioTJ)!;
  assert.equal(conHora.inicio, '2026-10-14T17:00:00.000Z');
  assert.equal(conHora.titulo, '(Sin título)');
  assert.equal(conHora.color, '#9fe1e7');
  assert.deepEqual([conHora.invitados, conHora.rechazado, conHora.recurrente, conHora.videollamada], [2, true, true, 'https://meet.google.com/abc']);
  // Lo organiza otra cuenta: no se mueve desde acá.
  assert.equal(conHora.editable, false);
  assert.equal(eventoDeGoogle({ id: 'x', status: 'cancelled', start: { date: '2026-10-14' } }, CAL, inicioTJ), null);
});

test('la lista de calendarios: sin los ocultos, el principal primero, y quién se puede editar', () => {
  const lista = [
    calendarioDeGoogle({ id: 'f', summary: 'Feriados', accessRole: 'reader' }),
    calendarioDeGoogle({ id: 'o', summary: 'Oculto', hidden: true }),
    calendarioDeGoogle({ id: 'p', summary: 'yo@x.com', primary: true, accessRole: 'owner', selected: false }),
    calendarioDeGoogle({ id: 'a', summary: 'Agencia', accessRole: 'writer' }),
  ].filter((c) => c != null);
  const orden = ordenarCalendarios(lista);
  assert.deepEqual(orden.map((c) => c.id), ['p', 'a', 'f']);
  assert.deepEqual(orden.map((c) => c.editable), [true, true, false]);
  assert.equal(orden[0].seleccionado, false);
});

// Rotura (14/10/2026, base en verde): con el fin de un día completo igual a la fecha (sin el +1 de Google), el evento
// quedaba de cero días (1 fallo).
test('el cuerpo para Google: la hora de pared con su zona, y el fin exclusivo de un día completo', () => {
  const h = cuerpoEventoGoogle({ titulo: 'Grabar', fecha: '2026-10-14', hora: '23:30', duracionMin: 60 }, 'America/Tijuana');
  assert.ok(h.ok);
  assert.deepEqual(h.ok && h.cuerpo.start, { dateTime: '2026-10-14T23:30:00', timeZone: 'America/Tijuana' });
  assert.deepEqual(h.ok && h.cuerpo.end, { dateTime: '2026-10-15T00:30:00', timeZone: 'America/Tijuana' });
  const d = cuerpoEventoGoogle({ titulo: 'Viaje', fecha: '2026-10-14', hora: null, fechaFin: '2026-10-15' }, 'America/Tijuana');
  assert.deepEqual(d.ok && [d.cuerpo.start, d.cuerpo.end], [{ date: '2026-10-14' }, { date: '2026-10-16' }]);
  const largo = cuerpoEventoGoogle({ titulo: 'x'.repeat(301), fecha: '2026-10-14', hora: null }, 'America/Tijuana');
  assert.equal(largo.ok, false);
  assert.equal(cuerpoEventoGoogle({ titulo: 'a', fecha: '14/10', hora: null }, 'America/Tijuana').ok, false);
});

// Rotura (14/10/2026, base en verde): restaurar con otro campo que `status` (o sea, recrear en vez de devolver el
// mismo evento): 1 fallo.
test('la tab lee Google con UN token y escribe sólo con permiso', () => {
  const g = sinComentarios(leer('../lib/calendario-google.ts'));
  assert.match(g, /import \{ tokenDelCalendario \} from '\.\/google-calendar';/);
  assert.doesNotMatch(g, /oauth2\.googleapis\.com/);
  // Toda escritura pasa por conToken (permiso de escritura) y por calendarioEditable (el calendario es de la cuenta y editable).
  for (const fn of ['crearEventoGoogle', 'cambiarEventoGoogle', 'borrarEventoGoogle', 'restaurarEventoGoogle']) {
    const ini = g.indexOf(`export async function ${fn}(`);
    const cuerpo = g.slice(ini, g.indexOf('\n}\n', ini));
    assert.match(cuerpo, /conToken\(/, fn);
    assert.match(cuerpo, /calendarioEditable\(access, /, fn);
  }
  // Deshacer un borrado devuelve el MISMO evento (PATCH a confirmed), no uno nuevo.
  const rest = g.slice(g.indexOf('export async function restaurarEventoGoogle('));
  assert.match(rest, /method: 'PATCH', body: JSON\.stringify\(\{ status: 'confirmed' \}\)/);
});
