// =============================================================================
// Ticket #110 (Marcela, ws 23, 18/11/2026): «agendar llamar en dos semanas» se delegaba teniendo con qué hacerlo
// =============================================================================
// «Mako agrega una nota al lead valery que quede agendada en su ficha del CRM, la nota dice: agendar llamar en dos semanas para
// coordinar reunión (…)». MaKo propuso la nota y la parte de «agendar» la DELEGÓ como pedido #110 («Lo que faltó de…»), cuando
// `crear_evento_calendario` agenda una llamada de venta en el Calendario de MaKo.
//
// ⚠️ NO FUE HAIKU (el diagnóstico obvio). Medido con el turno real: el pedido sólo nombraba el área `crm` y `crear_evento_calendario`
// no viajaba. Lo que fija, por el mismo camino del turno del grupo (clasificador + clase de la IA + `herramientasDelTurno`):
//   1. el pedido TAL CUAL trae la nota y el evento, con la instrucción de proponer las dos y la fecha calculada por el código;
//   2. qué es un seguimiento y qué no («agéndame una reunión con Juan» sigue siendo una reunión con su invitación);
//   3. la fecha y la hora («en dos semanas» = hoy + 14, a las 10 si no dijo hora);
//   4. un solo «sí» confirma las dos, por `confirmar_accion` REAL sobre una base de mentira (tests/_seguimiento-lead-110-hijo.ts):
//      las de OTRO turno siguen pidiendo «aclara cuál», en el mismo turno no se confirman solas, y con un id, ésa sola;
//   5. las piezas del doer y de la base que lo sostienen.
//
// Probado rompiéndolo (18/11/2026), una rotura por vez y con los 7 en verde antes:
//   · `seguimiento = false` en herramientasDelTurno (ni el área ni las forzadas ni la instrucción) → fallan 1 y 1-bis
//   · sacar la tanda del runner de `confirmar_accion` (lib/api-mako/areas/mako.run.ts) → falla 4
//   · `conSuTurno` sin el turno en crearPendiente → fallan 4 y 5
//   · `tandaDeUnSi` sin mirar el turno (todas las vigentes) → fallan 4 (dos turnos) y 4-bis
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { veredictoDeClase } from '../lib/mako-intencion-ia';
import { faltaAlgunaParte } from '../lib/despacho-grupo';
import { pideSeguimiento, fechaDelSeguimiento, horaDelSeguimiento, instruccionDelSeguimiento, HORA_DEL_SEGUIMIENTO } from '../lib/seguimiento-lead';
import { tandaDeUnSi, conSuTurno, sinSuTurno } from '../lib/confirmacion-pura';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)))`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const GRUPO: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 23, rol: 'admin', tabs: null };
const APP: Vista = { canal: 'app', alcance: 'ejecutar', ws: 23, rol: 'admin', tabs: null };

/** El pedido de Marcela, TAL CUAL llegó al grupo. */
const PEDIDO = 'Mako agrega una nota al lead valery que quede agendada en su ficha del CRM, la nota dice : agendar llamar en dos semanas para coordinar reunión (estaban terminando de hacer unos arreglos en la casa de Villa del Parque)';
/** El día del pedido, en la zona del negocio (Argentina, 18/11/2026 04:24). */
const HOY = '2026-11-18';

/** El turno del grupo: las reglas, la clase de la IA (ACCION con las dos partes que listó el 18/11) y la selección de herramientas. */
function turnoDelGrupo(texto: string, o: { hoy?: string | null; vista?: Vista } = {}) {
  const reglas = clasificarIntencion(texto, {});
  const veredicto = veredictoDeClase(
    { clase: 'ACCION', resumen: 'Agregar una nota al lead de Valery y agendar la llamada', reenviado: false, partes: ['Agregar nota al lead de Valery', 'Especificar que es para agendar llamada en dos semanas para coordinar reunión'] },
    reglas, { esSuperAdmin: false, escribeElDueno: false, texto },
  );
  return herramientasDelTurno({
    veredicto, texto, contextoDelSi: null, hilo: null, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: o.vista ?? GRUPO,
    hayPendientes: false, resumenesPendientes: [], sinCalendly: true, hoy: o.hoy === undefined ? HOY : o.hoy,
  });
}

test('1. el pedido de Marcela TAL CUAL trae la nota Y el evento del Calendario, con la instrucción y la fecha', () => {
  const t = turnoDelGrupo(PEDIDO);
  const nombres = t.tools.map((x) => x.name);
  assert.ok(nombres.includes('crear_evento_calendario'), `no viajó crear_evento_calendario (áreas: ${t.areas.join(', ')})`);
  assert.ok(nombres.includes('agregar_nota_lead'), 'no viajó agregar_nota_lead');
  assert.ok(nombres.includes('buscar_leads'), 'sin buscar_leads no hay id del lead');
  assert.ok(t.areas.includes('calendario'));
  const i = t.instruccion ?? '';
  assert.match(i, /agregar_nota_lead/);
  assert.match(i, /crear_evento_calendario con tipo «llamada», título «Llamar a /);
  assert.match(i, /fecha 2026-12-02 \(miércoles 2 de diciembre/, 'en dos semanas desde el 18/11 es el 2/12, calculado por el código');
  assert.match(i, new RegExp(`hora ${HORA_DEL_SEGUIMIENTO} \\(no dijo hora`));
  assert.match(i, /no lo delegues/);
  assert.match(i, /un solo «sí» confirma las dos/);
  assert.match(i, /no queda atado a la ficha del lead: por eso su nombre va en el título y en las notas/);
  // Con las dos propuestas, el pedido compuesto ya no delega «lo que faltó» (lib/despacho-grupo.ts).
  assert.equal(faltaAlgunaParte(['Agregar nota', 'Agendar la llamada'], 2), false);
  assert.equal(faltaAlgunaParte(['Agregar nota', 'Agendar la llamada'], 1), true, 'con la nota sola, sí: era el #110');
});

test('1-bis. sin la fecha de hoy la calcula el modelo; en la app se confirma con la tarjeta; sin la nota, sólo el evento', () => {
  const sinHoy = turnoDelGrupo(PEDIDO, { hoy: null }).instruccion ?? '';
  assert.match(sinHoy, /calculada desde «HOY ES»/);
  assert.doesNotMatch(sinHoy, /2026-12-02/);
  const app = turnoDelGrupo(PEDIDO, { vista: APP });
  assert.ok(app.tools.some((x) => x.name === 'crear_evento_calendario'), 'en el chat de la app también viaja');
  assert.match(app.instruccion ?? '', /cada una en su tarjeta/);
  assert.doesNotMatch(app.instruccion ?? '', /un solo «sí»/, 'en la app no hay «sí» escrito');
  const sinNota = instruccionDelSeguimiento({ texto: 'recuérdame llamar al contador el lunes', hoy: HOY, hayNota: false });
  assert.doesNotMatch(sinNota, /agregar_nota_lead/, 'un prompt no nombra una herramienta que no viajó');
  assert.match(sinNota, /fecha 2026-11-23 \(lunes 23 de noviembre/);
});

test('2. qué es un seguimiento: contactar a alguien MÁS ADELANTE; una reunión con el lead, no', () => {
  for (const si of [
    PEDIDO,
    'recuérdame llamar a Juan el lunes',
    'llamar a Valery en 2 semanas',
    'agéndame hacerle seguimiento a Pedro la semana que viene',
    'agenda contactar a la señora Gómez en 10 días',
    'acordarme de volver a llamarlo pasado mañana a las 11',
    'ponme un recordatorio para escribirle a Ana el 5 de diciembre',
  ]) assert.equal(pideSeguimiento(si), true, `«${si}» es un seguimiento`);
  for (const no of [
    'agéndame una reunión con Juan el jueves a las 10',
    'agenda una llamada con Juan mañana a las 9',
    'llamé a Juan hace dos semanas',
    '¿cuántos leads entraron en dos semanas?',
    'escríbele a Ana en dos días', // podría ser un WhatsApp programado: sin agendar/recordar, no
    'agrega una nota al lead Juan: no contestó',
    'llamar a Juan',  // sin cuándo no hay nada para el Calendario
    'agrega una tarea: llamar a Juan el lunes', // una tarea del Plan (tests/crm-pedidos-whatsapp.test.ts)
    'Che, agregá al plan que hay que llamar a Juan el jueves.',
  ]) assert.equal(pideSeguimiento(no), false, `«${no}» no es un seguimiento`);
  // Y el turno de una reunión con el lead no recibe la instrucción.
  assert.equal(turnoDelGrupo('agéndame una reunión con Juan el jueves a las 10').instruccion?.includes('SEGUIMIENTO') ?? false, false);
});

test('3. la fecha la calcula el código desde hoy; la hora, la que dijo o las 10', () => {
  const casos: Array<[string, string | null]> = [
    ['agendar llamar en dos semanas', '2026-12-02'],
    ['llamarlo en 10 días', '2026-11-28'],
    ['en un par de semanas llamarlo', '2026-12-02'],
    ['llamarla en un mes', '2026-12-18'],
    ['llamarla la semana que viene', '2026-11-25'],
    ['llamarlo mañana', '2026-11-19'],
    ['llamarlo pasado mañana', '2026-11-20'],
    ['recuérdame llamarlo el lunes', '2026-11-23'],
    ['recuérdame llamarlo el miércoles', '2026-11-25'], // hoy es miércoles: el que viene
    ['llamarla el 5 de diciembre', '2026-12-05'],
    ['llamarla el 3/1', '2027-01-03'],
    ['llamarla en unos días', null],
  ];
  for (const [texto, fecha] of casos) assert.equal(fechaDelSeguimiento(texto, HOY), fecha, texto);
  assert.equal(fechaDelSeguimiento('llamarla en un mes', '2026-01-31'), '2026-02-28', 'el 31 de un mes corto cae en su último día');
  assert.equal(fechaDelSeguimiento('llamarla por la mañana', HOY), null, '«por la mañana» no es mañana');
  assert.equal(horaDelSeguimiento('llamarla el lunes a las 5 de la tarde'), '17:00');
  assert.equal(horaDelSeguimiento('llamarla el lunes a las 16:30'), '16:30');
  assert.equal(horaDelSeguimiento('llamarla el lunes 10hs'), '10:00');
  assert.equal(horaDelSeguimiento(PEDIDO), null);
});

type Escena = Record<string, unknown> & { nombre: string };
let escenas: Map<string, Escena> | null = null;
function delHijo(): Map<string, Escena> {
  if (escenas) return escenas;
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_seguimiento-lead-110-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000,
  });
  if (r.status !== 0) throw new Error(`el hijo salió con ${r.status}: ${(r.stderr || '').slice(-3000)}`);
  escenas = new Map((r.stdout || '').split('\n').filter((l) => l.startsWith('@@SEG@@')).map((l) => {
    const e = JSON.parse(l.slice(7)) as Escena;
    return [e.nombre, e];
  }));
  return escenas;
}
type Res = { estados: Array<{ tipo: string; estado: string }>; notas: unknown[]; eventos: Array<{ titulo: string; tipo: string; inicio: string; dia_completo: boolean }>; si: { resultado?: string } };

test('4. un solo «sí» confirma la nota y el evento del mismo turno (confirmar_accion real, base de mentira)', () => {
  const e = delHijo();
  const tanda = e.get('tanda') as unknown as Res & { payloads: Array<Record<string, unknown>> };
  assert.ok(tanda, 'sin la escena de la tanda');
  assert.ok(tanda.payloads.every((p) => typeof p.__turno === 'number' && p.__turno === tanda.payloads[0].__turno), 'las dos nacieron con la marca del MISMO turno');
  assert.deepEqual(tanda.estados.map((p) => p.estado), ['ejecutada', 'ejecutada'], `el «sí» dejó: ${JSON.stringify(tanda.estados)}`);
  assert.equal(tanda.notas.length, 1, 'la nota quedó en el historial del lead');
  assert.equal(tanda.eventos.length, 1);
  assert.equal(tanda.eventos[0].titulo, 'Llamar a Valery Prueba');
  assert.equal(tanda.eventos[0].tipo, 'llamada');
  assert.equal(tanda.eventos[0].dia_completo, false);
  assert.equal(tanda.eventos[0].inicio.slice(0, 10), '2026-12-02');
  assert.match(tanda.si.resultado ?? '', /Nota agregada.*Agendado en el Calendario/);

  const dos = e.get('dos-turnos') as unknown as Res;
  assert.match(dos.si.resultado ?? '', /aclara cuál/, 'de dos turnos distintos, el «sí» sin id sigue siendo ambiguo');
  assert.deepEqual(dos.estados.map((p) => p.estado), ['pendiente', 'pendiente']);
  assert.equal(dos.eventos.length + dos.notas.length, 0);

  const mismo = e.get('mismo-turno') as unknown as Res;
  assert.match(mismo.si.resultado ?? '', /Recién propuse esa acción/, 'el modelo no las confirma en el turno que las propuso');
  assert.deepEqual(mismo.estados.map((p) => p.estado), ['pendiente', 'pendiente']);

  const conId = e.get('con-id') as unknown as Res;
  assert.deepEqual(conId.estados.map((p) => `${p.tipo}:${p.estado}`), ['agregar_nota_lead:pendiente', 'crear_evento_calendario:ejecutada'], 'con un id, ésa sola');
  assert.deepEqual((e.get('red') as unknown as { red: string[] }).red, [], 'nada sale a la red');
});

test('4-bis. la tanda: todas del mismo turno, en el orden en que se propusieron; si no, null', () => {
  const p = (id: number, turno: number | undefined, seg: number) => ({ id, turno, createdAt: new Date(Date.UTC(2026, 10, 18, 7, 24, seg)).toISOString() });
  assert.deepEqual(tandaDeUnSi([p(2, 100, 20), p(1, 100, 10)])?.map((x) => x.id), [1, 2]);
  assert.equal(tandaDeUnSi([p(2, 100, 20), p(1, 99, 10)]), null);
  assert.equal(tandaDeUnSi([p(2, undefined, 20), p(1, undefined, 10)]), null, 'sin la marca no se sabe: se pregunta');
  assert.equal(tandaDeUnSi([p(1, 100, 10)]), null, 'una sola ya la confirma el «sí» de siempre');
  const con = conSuTurno({ leadId: 1, __pidio: 'x' }, 123);
  assert.deepEqual(sinSuTurno(con), { payload: { leadId: 1, __pidio: 'x' }, turno: 123 });
  assert.deepEqual(conSuTurno({ a: 1 }, 0), { a: 1 });
});

test('5. las piezas: el doer pasa hoy y una sola marca de turno; la base la guarda y la saca al leer', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /hoy: hoyDelSeguimiento,/);
  assert.match(doer, /crearRunnerAcciones\(wsData, jid, ctxApi\.turnStart \?\? Date\.now\(\), texto, enElGrupo\)/, 'las propuestas viejas y las del registro, con el mismo turno');
  assert.match(leer('lib/mako-turno-app.ts'), /sinCalendly, propias: entrada\.propias, hoy,/);
  const pend = leer('lib/mako-pendientes.ts');
  assert.match(pend, /const conTurno = conSuTurno\(payloadCrudo, dataCruda\.mismoTurnoDesde\);/);
  assert.match(pend, /payload: conTurno,/);
  assert.match(pend, /= sinSuTurno\(/);
  assert.match(leer('lib/api-mako/acciones.ts'), /return tandaDeUnSi\(await vigentesPara\(ctx\)\);/);
  // Cada una por SU id: `confirmarPendiente` y todas sus guardas, sin un camino nuevo que ejecute.
  assert.match(leer('lib/api-mako/areas/mako.run.ts'), /for \(const p of tanda\) \{\n\s+const r = await confirmarPendiente\(ctx, p\.id\);/);
});
