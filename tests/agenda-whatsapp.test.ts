// =============================================================================
// Agendar, mover, cambiar y cancelar reuniones en Google Calendar desde el grupo de MaKo
// =============================================================================
// El pedido (07/10/2026): un cliente inmobiliario quiere escribirle al grupo de
// WhatsApp de MaKo «agendá una visita con X» o «movela» y que pase. Ya existía
// agendar por CALENDLY; este cliente agenda en Google (y por Cal.com, no Calendly),
// y mover no existía por ningún lado.
//
// ⚠️ EL 08/10/2026 ESTE TEST DABA VERDE SOBRE EL BUG. Armaba el turno a mano —áreas del
// mensaje + `incluirAcciones: true`— y se salteaba el clasificador y el filtro de «en una
// pregunta MaKo ofrece». El mismo día el cliente escribió «Mako, agenda me una reunión
// mañana 12hs de 1hs que se llame PRUEBA»: se clasificó como material para anotar, el turno
// llegó con dos herramientas del plan y MaKo contestó «por aquí no puedo agendarte». Con el
// código de ese día, 3 de las 5 frases de escritura de abajo tampoco traían la herramienta.
//
// Ahora el turno se arma con lo MISMO que corre: `clasificarIntencion` + la selección de
// lib/doer-herramientas.ts, con los nombres reales de las herramientas de siempre.
//
// Lo que fija:
//   1. que cada pedido llegue con su herramienta, pasando por el clasificador;
//   2. que el «sí» a un ofrecimiento, la corrección de una pendiente y un lote también;
//   3. que a un negocio sin Calendly no le viajen las de Calendly;
//   4. que mover NUNCA cree una reunión nueva si no encuentra la que se nombró;
//   5. que nada de la agenda salga por HTTP sin que alguien lo decida;
//   6. «movela al viernes» sin decir qué, y «Agendar reunión con…» dentro de una lista (09/10).
//
// Probado rompiéndolo (08/10/2026), una rotura por vez y con todo en verde antes, junto
// con tests/agenda-sin-ia.test.ts: 15 roturas, todas con su fallo. Sacar la regla del
// pedido de agenda tumba 3 (la escritura, la pendiente y el de Calendly); la pendiente que
// se queda con el pedido, las formas con modal, la corrección de una propuesta, el
// encabezado del lote, «qué tengo hoy», el «sí» sin el ofrecimiento, la relevancia de
// agenda, Calendly sin filtro y las escrituras en una pregunta: 1 cada una.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, areasDelMensaje, CONTRATO } from '../lib/mako-intencion';
import { herramientasDelTurno, DE_CALENDLY, PREGUNTA_REUNION_O_TAREA, preguntoReunionOTarea, SIN_FECHA_DE_TAREA } from '../lib/doer-herramientas';
import { porId, visible, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Los NOMBRES de las herramientas de siempre. Viven en módulos con `server-only`, así que
 *  se los pide a un node aparte con la condición del server: una lista escrita a mano se
 *  queda vieja, y el presupuesto del registro (que las excluye) mediría otra cosa. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));

// El doer de WhatsApp corre como admin del grupo, con alcance ejecutar.
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

type Ctx = { hayPendientes?: boolean; hayPendienteDeAgenda?: boolean; makoPregunto?: boolean; hayAgendaAbierta?: boolean; preguntoReunionOTarea?: boolean };
/** El turno como lo arma el doer (lib/mako-doer-in.ts), con las mismas dos funciones. */
function turno(mensaje: string, ctx: Ctx = {}, extra: { contextoDelSi?: string; resumenesPendientes?: string[]; sinCalendly?: boolean } = {}) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  const t = herramientasDelTurno({
    veredicto, texto: mensaje, agendaAbierta: !!ctx.hayAgendaAbierta, deSiempre: DE_SIEMPRE, vista,
    hayPendientes: !!ctx.hayPendientes, contextoDelSi: veredicto.sigueOfrecimiento ? extra.contextoDelSi ?? null : null,
    resumenesPendientes: extra.resumenesPendientes, sinCalendly: extra.sinCalendly,
  });
  return { veredicto, nombres: t.tools.map((x) => x.name), areas: t.areas, instruccion: t.instruccion };
}

const trae = (mensaje: string, id: string, r: ReturnType<typeof turno>) =>
  assert.ok(r.nombres.includes(id), `«${mensaje}» → ${r.veredicto.intencion}${r.veredicto.dudosa ? ' (dudosa)' : ''}: no trae ${id} (llegaron ${r.nombres.length}: ${r.nombres.slice(0, 10).join(', ')}…)`);

// --- 1. Cada pedido con su herramienta, pasando por el clasificador -----------------

const ESCRITURAS: Array<{ mensaje: string; espera: string }> = [
  // El literal del cliente (ws13, 08/10/2026): «agenda» sin tilde, el pronombre suelto.
  { mensaje: 'Mako, agenda me una reunión mañana 12hs de 1hs que se llame PRUEBA', espera: 'proponer_agendar_agenda' },
  { mensaje: 'Mako, me puedes agendar una reunión mañana a las 12 de una hora que se llame PRUEBA', espera: 'proponer_agendar_agenda' },
  { mensaje: 'agendá una visita con Juan Pérez el jueves a las 10', espera: 'proponer_agendar_agenda' },
  { mensaje: 'agendame una reunión con Ana mañana a las 15', espera: 'proponer_agendar_agenda' },
  { mensaje: 'creá un evento mañana a las 10 que se llame Firma', espera: 'proponer_agendar_agenda' },
  { mensaje: 'pasá la visita de Juan al viernes a las 11', espera: 'proponer_mover_reunion' },
  { mensaje: 'reagendá a Juan para el lunes', espera: 'proponer_mover_reunion' },
  { mensaje: 'moveme la cita con Ana al martes 9:30', espera: 'proponer_mover_reunion' },
  { mensaje: 'cancelá la reunión de mañana a las 12', espera: 'proponer_cancelar_reunion' },
  { mensaje: 'cambiale el nombre a la reunión de mañana a las 12', espera: 'proponer_cambiar_reunion' },
];

test('cada pedido de escritura llega como acción y con su herramienta en el turno', () => {
  for (const { mensaje, espera } of ESCRITURAS) {
    const r = turno(mensaje);
    assert.equal(r.veredicto.intencion, 'actuar', `«${mensaje}» no es una acción: ${r.veredicto.porque}`);
    trae(mensaje, espera, r);
  }
});

const LECTURAS: Array<{ mensaje: string; espera: string }> = [
  { mensaje: '¿qué reuniones tiene Juan en la agenda?', espera: 'reuniones_agenda_lead' },
  { mensaje: '¿qué horarios tengo libres el jueves?', espera: 'horarios_libres_dia' },
  { mensaje: '¿tengo hueco el jueves para una visita?', espera: 'horarios_libres_dia' },
  // Las dos preguntas que siguieron en el grupo del cliente (#1252 y #1254).
  { mensaje: '¿qué tengo hoy?', espera: 'agenda_del_dia' },
  { mensaje: 'Y a las 12hs que tengo?', espera: 'agenda_del_dia' },
];

test('las preguntas por la agenda traen su lectura, y en una pregunta no viaja ninguna escritura', () => {
  for (const { mensaje, espera } of LECTURAS) {
    const r = turno(mensaje);
    assert.ok(areasDelMensaje(mensaje).includes('crm'), `«${mensaje}» no se reconoce como CRM`);
    trae(mensaje, espera, r);
    const escrituras = r.nombres.filter((n) => /^proponer_(agendar|mover|cambiar|cancelar)_/.test(n));
    assert.deepEqual(escrituras, [], `«${mensaje}» es una pregunta y trae escrituras: MaKo las OFRECE`);
  }
});

// --- 2. El «sí», la corrección y el lote ------------------------------------------------

test('el «sí» a un ofrecimiento trae la acción ofrecida, aunque «sí, dale» no nombre nada', () => {
  const contextoDelSi = 'Tengo una reunión con el contador mañana a las 12, ¿la ves?\n¿Querés que te la agende mañana a las 12 en tu Google Calendar?';
  for (const si of ['sí, dale', 'si', 'sí, hacelo']) {
    const r = turno(si, { makoPregunto: true }, { contextoDelSi });
    assert.equal(r.veredicto.intencion, 'actuar');
    assert.ok(r.veredicto.sigueOfrecimiento, `«${si}» no se marca como respuesta a un ofrecimiento`);
    trae(si, 'proponer_agendar_agenda', r);
  }
});

test('con una pendiente abierta, cancelar o corregir no se confunde con un «sí» o un «no»', () => {
  const r1 = turno('cancelá la reunión de mañana a las 12', { hayPendientes: true });
  assert.equal(r1.veredicto.intencion, 'actuar', 'una pendiente secuestra el pedido de cancelar');
  trae('cancelá la reunión de mañana a las 12', 'proponer_cancelar_reunion', r1);

  const resumenesPendientes = ['Agendar «PRUEBA» el vie 9 oct, 12:00 (60 min) en tu Google Calendar, sin invitados.'];
  const r2 = turno('no, mejor a las 13', { hayPendientes: true, hayPendienteDeAgenda: true }, { resumenesPendientes });
  assert.equal(r2.veredicto.intencion, 'actuar', 'corregir la hora de una propuesta sólo la cancelaba');
  trae('no, mejor a las 13', 'proponer_agendar_agenda', r2);
  trae('no, mejor a las 13', 'cancelar_accion', r2);

  const r3 = turno('no, movela al viernes a las 10', { hayPendientes: true });
  assert.equal(r3.veredicto.intencion, 'actuar');
  trae('no, movela al viernes a las 10', 'proponer_mover_reunion', r3);

  // Y un «sí» o un «no» pelados siguen siendo la confirmación de siempre.
  assert.equal(clasificarIntencion('sí', { hayPendientes: true }).intencion, 'confirmar');
  assert.equal(clasificarIntencion('no', { hayPendientes: true, hayPendienteDeAgenda: true }).intencion, 'confirmar');
});

test('un lote de mensajes se lee por lo que escribió la persona, no por nuestro encabezado', () => {
  // El formato de `unirMensajes` (lib/mako-doer-buffer.ts).
  const lote = '[Te mandó 2 mensajes seguidos. Son UNA sola cosa: léelos todos antes de contestar, responde UNA vez por el conjunto y carga TODAS las tareas juntas, no de a una. Si un mensaje posterior corrige o amplía a uno anterior, gana el posterior.]\n\n(1) Mako\n\n(2) agendá una reunión mañana a las 12 que se llame PRUEBA';
  const r = turno(lote);
  assert.equal(r.veredicto.intencion, 'actuar');
  assert.deepEqual(r.areas, ['crm'], 'el encabezado del lote suma áreas que la persona no nombró');
  trae('lote', 'proponer_agendar_agenda', r);
});

// --- 3. Sin Calendly, no viaja Calendly --------------------------------------------------

test('a un negocio sin Calendly no le viajan sus herramientas (ni su receta)', () => {
  const m = 'agendame una reunión mañana a las 12 que se llame PRUEBA';
  const con = turno(m);
  assert.ok(DE_CALENDLY.some((n) => con.nombres.includes(n)), 'con Calendly tienen que viajar: si no, este test no distingue nada');
  const sin = turno(m, {}, { sinCalendly: true });
  assert.deepEqual(sin.nombres.filter((n) => DE_CALENDLY.includes(n)), [], 'sin Calendly viajan igual, y su receta empuja a pedir un lead y un email');
  trae(m, 'proponer_agendar_agenda', sin);
  // El doer lo decide por la credencial, y una lectura fallida no cuenta como «no tiene».
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /credWs\('CALENDLY_API_TOKEN', wsData\)\.catch\(\(\) => 'no se pudo leer'\)\) == null/);
});

// --- 4 y 5. Lo que no se ve leyendo el código ---------------------------------------------

test('mover desde WhatsApp NUNCA crea una reunión nueva si no encuentra la nombrada', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const ini = run.indexOf('proponer_mover_reunion: {');
  const fin = run.indexOf('proponer_cambiar_reunion: {', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el runner de proponer_mover_reunion: cambió la forma y este test ya no mira nada');
  const bloque = run.slice(ini, fin);
  assert.match(bloque, /crearSiNoExiste:\s*false/, 'el runner de mover tiene que pasar crearSiNoExiste: false');

  // Y la librería tiene que honrarlo ANTES de crear: un chequeo después del POST no protege nada.
  const lib = sinComentarios(leer('lib/google-calendar.ts'));
  const iMover = lib.indexOf('export async function moverEventoDeReunion');
  const iFin = lib.indexOf('async function crearEnAgenda', iMover);
  assert.ok(iMover > 0 && iFin > iMover, 'no encontré moverEventoDeReunion / crearEnAgenda');
  const cuerpo = lib.slice(iMover, iFin);
  const iChequeo = cuerpo.indexOf('crearSiNoExiste === false');
  const iCrea = cuerpo.indexOf('crearEnAgenda(');
  assert.ok(iChequeo > 0, 'moverEventoDeReunion no mira crearSiNoExiste');
  assert.ok(iCrea > 0 && iChequeo < iCrea, 'el chequeo de crearSiNoExiste tiene que ir ANTES de crear');
});

test('nada de la agenda de Google sale por HTTP sin decidirlo', () => {
  for (const id of ['horarios_libres_dia', 'reuniones_agenda_lead', 'agenda_del_dia', 'proponer_agendar_agenda', 'proponer_mover_reunion', 'proponer_cambiar_reunion', 'proponer_cancelar_reunion']) {
    const d = porId(id);
    assert.ok(d, `${id} no está en el registro`);
    assert.ok(!d.canales.includes('http'), `${id} sale por HTTP: exponer la agenda de Google a un bearer es una decisión (snapshot), no un default`);
    assert.ok(d.canales.includes('whatsapp'), `${id} tiene que salir por WhatsApp: es para eso`);
  }
});

// --- 6. Los dos casos que quedaron abiertos el 08/10 (cerrados el 09/10/2026) ---------------
// Decisión de Martín («terminalo todo», 09/10/2026), escrita por quien integra:
//   a) «movela al viernes» SIN pendiente ni agenda abierta: viajan la agenda Y el plan, y si el
//      modelo no puede saber cuál es, pregunta UNA vez «¿La reunión o la tarea?».
//   b) «Agendar reunión con…» al principio de una línea DENTRO de un mensaje de varias líneas
//      es material para el plan (cargar tareas no pregunta nada); SOLO, es una orden de agenda.
//
// Medido ANTES del arreglo, con este mismo turno: «movela al viernes» se clasificaba como
// mover a un lead DE ETAPA («al viernes» leído como una columna), sin agenda_del_dia y sin
// nada del plan; «cambiala para el jueves», «reprogramala…» y «movela para mañana» caían al
// default (material, dudosa) con dos herramientas; y «Agendar reunión con Ana mañana a las
// 15» SOLO también era material (dudosa): la premisa de que suelto ya era una orden era falsa.
//
// Probado rompiéndolo (09/10/2026, el implementador), una rotura por vez, restaurando de memoria
// y con los 15 en verde antes: siete roturas, 1 fallo y 14 pases cada una, y cada fallo es el suyo:
//   · sin la regla de mover sin objeto (3-ter-ter) → el de la agenda Y el plan (con la
//     pendiente de agenda vuelve a caer en «lead de etapa», que trae la reunión: ése no cae);
//   · sin la rama de la pendiente de agenda → el de «no se pregunta»;
//   · sin la instrucción en el turno → el de la agenda Y el plan;
//   · sin la regla de la respuesta (3-ter-bis) → el de la respuesta;
//   · sin el chequeo de UNA línea del infinitivo → el de varias líneas (las de sin viñetas);
//   · sin la rama del infinitivo → el del pedido solo;
//   · sin la instrucción en el system del doer → el del system.
//
// LA REVISIÓN (09/10/2026) encontró cuatro agujeros con el turno real, todos sin error:
//   · «pasalo a agendado para el lunes», «movelo a contactado mañana» y «pasala a no show hoy»
//     eran un lead a una ETAPA y pasaron a preguntar «¿La reunión o la tarea?» (bastaba un día
//     en cualquier lado del mensaje). Ahora el día tiene que ser el DESTINO del verbo.
//   · la respuesta se reconocía después de CUALQUIER pregunta de MaKo: «la agenda de mañana?»
//     y «el plan de esta semana cómo va?» dejaban de ser consultas y llegaban con escrituras.
//   · «Buen día, movela al viernes» llegaba con las dos áreas y sin la pregunta: el turno
//     volvía a leer el texto con un preludio que no pela «buen día». Ahora lo dice el veredicto.
//   · un audio dictado («Agendar reunión…, llamar a…, subir…») llega en UNA línea y se volvía
//     una orden de agenda.
//   Y uno que no se ve hoy: el `if (porId(...))` de abajo iba a romper este archivo el día que se
//   integre wip/api-acciones-0910, donde esa acción existe y es sólo HTTP. Por WhatsApp NO hay
//   con qué cambiarle la fecha a una tarea, y el modelo ahora lo sabe (SIN_FECHA_DE_TAREA).
// Probado rompiéndolo, mismo método, con los 16 en verde antes: ocho roturas, cada una con su
// fallo — el destino pegado al verbo (1: el del objeto nombrado), la respuesta sólo tras ESA
// pregunta (1: el de otra pregunta), la marca a través del saludo (1: el de la agenda Y el plan),
// el otro infinitivo en la línea (1: el de varias líneas), el aviso sin fecha (2: el de la agenda
// Y el plan y el de la respuesta), el doer pasando ESA pregunta (1: el del system), «no, la
// tarea» (1: el de la respuesta) y el detector de las dos palabras (1: el de otra pregunta). Y
// re-hechas dos del implementador: sin 3-ter-ter y sin el chequeo de una línea, 1 fallo cada una.

const MOVER_SIN_OBJETO = [
  'movela al viernes',
  'Mako, movela al viernes a las 10',
  'pasala al lunes',
  'cambiala para el jueves a las 11',
  'reprogramala para mañana',
  'mové eso al viernes',
  // El saludo lo pela el clasificador, no el preludio del CRM: con la pregunta decidida
  // re-leyendo el texto, éste llegaba con las dos áreas y SIN la pregunta (revisor, 09/10).
  'Buen día, movela al viernes',
];

test('«movela al viernes» sin decir qué: viajan la agenda Y el plan, y MaKo pregunta UNA vez', () => {
  for (const m of MOVER_SIN_OBJETO) {
    const r = turno(m);
    assert.equal(r.veredicto.intencion, 'actuar', `«${m}» no es una acción: ${r.veredicto.porque}`);
    assert.ok(!r.veredicto.dudosa, `«${m}» quedó dudosa`);
    assert.ok(r.areas.includes('crm') && r.areas.includes('plan'), `«${m}» no trae las dos áreas: ${r.areas.join(', ')}`);
    trae(m, 'proponer_mover_reunion', r);   // reagendar
    trae(m, 'agenda_del_dia', r);           // leer el día
    trae(m, 'listar_tareas_plan', r);       // la tarea, con su deadline
    // La acción de cambiarle la fecha a una tarea vive en otra rama (wip/api-acciones-0910), y
    // ahí es sólo HTTP. Si algún día sale por WhatsApp, tiene que entrar al presupuesto igual que
    // la de la reunión; mientras no salga, el modelo tiene que saber que no la tiene.
    // ⚠️ Preguntar sólo `porId` (como estaba) rompía este test el día que esa rama se integre:
    // la def existe y NO viaja por este canal (`visible` mira `canales`).
    const fecha = porId('cambiar_fecha_tarea_plan');
    if (fecha && visible(fecha, vista)) trae(m, 'cambiar_fecha_tarea_plan', r);
    else assert.ok(r.instruccion?.includes(SIN_FECHA_DE_TAREA), `«${m}»: no viaja con qué cambiarle la fecha a una tarea y el modelo no lo sabe (va a cargar una tarea nueva)`);
    assert.ok(r.instruccion?.includes(PREGUNTA_REUNION_O_TAREA), `«${m}» no lleva la pregunta: si el modelo no sabe cuál es, no tiene cómo preguntarlo`);
  }
});

test('con una propuesta de agenda abierta, «movela al viernes» es la reunión: no se pregunta', () => {
  const r = turno('movela al viernes', { hayPendientes: true, hayPendienteDeAgenda: true },
    { resumenesPendientes: ['Agendar «PRUEBA» el jue 8 oct, 12:00 (60 min) en tu Google Calendar, sin invitados.'] });
  assert.equal(r.veredicto.intencion, 'actuar');
  trae('movela al viernes', 'proponer_mover_reunion', r);
  assert.equal(r.instruccion, null, 'pregunta «¿La reunión o la tarea?» con una propuesta de agenda abierta: es fricción');
  assert.ok(!r.areas.includes('plan'), 'con la propuesta abierta no hay tarea que mover');
});

test('la respuesta a «¿La reunión o la tarea?» llega con lo que eligió, no como material', () => {
  const contextoDelSi = `movela al viernes\n${PREGUNTA_REUNION_O_TAREA}`;
  // El ctx sale como en el doer: de lo que MaKo acaba de decir, con la función que usa el doer.
  const ctx: Ctx = { makoPregunto: true, preguntoReunionOTarea: preguntoReunionOTarea(PREGUNTA_REUNION_O_TAREA) };
  const reunion = turno('la reunión', ctx, { contextoDelSi });
  assert.equal(reunion.veredicto.intencion, 'actuar', `«la reunión» → ${reunion.veredicto.intencion}: ${reunion.veredicto.porque}`);
  trae('la reunión', 'proponer_mover_reunion', reunion);
  for (const m of ['la tarea', 'no, la tarea']) {
    const tarea = turno(m, ctx, { contextoDelSi });
    assert.equal(tarea.veredicto.intencion, 'actuar', `«${m}» → ${tarea.veredicto.intencion}: ${tarea.veredicto.porque}`);
    trae(m, 'listar_tareas_plan', tarea);
    // No se vuelve a preguntar (la pregunta es UNA); lo único que puede viajar es el aviso de que
    // no hay con qué cambiarle la fecha a una tarea por aquí.
    assert.ok(!tarea.instruccion?.includes(PREGUNTA_REUNION_O_TAREA), `«${m}» vuelve a preguntar`);
    if (!tarea.nombres.includes('cambiar_fecha_tarea_plan')) assert.equal(tarea.instruccion, SIN_FECHA_DE_TAREA, `«${m}»: el modelo no sabe que no puede cambiarle la fecha`);
  }
  assert.equal(reunion.instruccion, null);
});

test('después de OTRA pregunta de MaKo, «la agenda de mañana?» sigue siendo una consulta', () => {
  // El detector mira la última pregunta, y acepta que el modelo la diga con sus palabras.
  assert.ok(preguntoReunionOTarea(`Tienes las dos ese día. ${PREGUNTA_REUNION_O_TAREA}`));
  assert.ok(preguntoReunionOTarea('¿Te refieres a la reunión o a la tarea?'));
  assert.ok(!preguntoReunionOTarea('Tienes 3 reuniones mañana. ¿Quieres que te pase el detalle?'));
  assert.ok(!preguntoReunionOTarea('Listo, la tarea quedó cargada.'));
  // Y con otra pregunta, estas frases son lo que eran antes: no una respuesta.
  const ctx: Ctx = { makoPregunto: true, preguntoReunionOTarea: preguntoReunionOTarea('Tienes 3 reuniones mañana. ¿Quieres que te pase el detalle?') };
  for (const m of ['la agenda de mañana?', 'la reunión de mañana sigue en pie?', 'el plan de esta semana cómo va?']) {
    const r = turno(m, ctx);
    assert.equal(r.veredicto.intencion, 'consultar', `«${m}» después de otra pregunta → ${r.veredicto.intencion}: ${r.veredicto.porque}`);
  }
  assert.notEqual(turno('la llamada con Pedro salió bien', ctx).veredicto.intencion, 'actuar');
});

test('con un objeto nombrado no es «mover sin decir qué»', () => {
  // Un lead a una etapa sigue siendo del CRM, y sin pregunta.
  const etapa = turno('movelo a calificado');
  assert.equal(etapa.instruccion, null);
  assert.ok(!etapa.areas.includes('plan'), '«movelo a calificado» trae el plan');
  // Y con un día detrás también: las etapas son de cada negocio («Agendado», «No show») y no
  // están en ninguna lista. Lo que decide es que el destino del verbo NO es el día.
  for (const m of ['pasalo a agendado para el lunes', 'movelo a contactado mañana', 'pasala a no show hoy']) {
    const r = turno(m);
    assert.match(r.veredicto.porque, /pedido sobre un lead del CRM \(etapa\)/, `«${m}» no es mover un lead de etapa: ${r.veredicto.porque}`);
    assert.equal(r.instruccion, null, `«${m}»: MaKo pregunta «¿La reunión o la tarea?» por un lead`);
    assert.ok(!r.areas.includes('plan'), `«${m}» trae el plan`);
  }
  // La reunión nombrada la toma la regla de agenda.
  const reunion = turno('mové la reunión de mañana al viernes a las 10');
  assert.equal(reunion.instruccion, null);
  trae('mové la reunión de mañana al viernes a las 10', 'proponer_mover_reunion', reunion);
});

// Una lista dictada al grupo: cada línea es una tarea para el plan, «Agendar…» incluida.
const LISTA_CON_AGENDAR = '- Llamar a la inmobiliaria por la tasación\n- Agendar reunión con Ana mañana a las 15\n- Subir las fotos de la casa del centro';
// Las mismas líneas sin viñetas y con «Agendar…» PRIMERO, como sale de un dictado por audio:
// es el caso que distingue «una línea» de «el principio del mensaje». Sin viñetas ni un
// infinitivo de la lista del dictado queda dudosa (MaKo ofrece anotarlo): eso es de antes.
const LINEAS_CON_AGENDAR = 'Agendar reunión con Ana mañana a las 15\nLlamar a la inmobiliaria por la tasación\nPagar el hosting';
// Y la misma tanda DICTADA POR AUDIO: la transcripción llega en UNA línea, con comas. Es la
// lista sin saltos, y con sólo el chequeo de «una línea» se volvía una orden de agenda.
const AUDIO_CON_AGENDAR = 'Agendar reunión con Ana mañana a las 15, llamar a la inmobiliaria por la tasación y subir las fotos de la casa del centro';

test('«Agendar reunión con…» dentro de un mensaje de varias líneas es material para el plan', () => {
  for (const m of [LISTA_CON_AGENDAR, LINEAS_CON_AGENDAR, AUDIO_CON_AGENDAR]) {
    const r = turno(m);
    assert.equal(r.veredicto.intencion, 'capturar', `una línea de una lista se volvió una orden de agenda: ${r.veredicto.porque}`);
    assert.deepEqual(r.nombres.filter((n) => /^proponer_(agendar|mover|cambiar|cancelar)_/.test(n)), [], 'viaja una escritura de agenda sobre una lista de tareas');
    assert.ok(r.nombres.every((n) => (CONTRATO.capturar.tools ?? []).includes(n)), `el turno de una lista trae algo que no es del plan: ${r.nombres.join(', ')}`);
  }
  // La lista con viñetas, además, es una carga de tareas sin duda: el borrador va obligatorio.
  const lista = turno(LISTA_CON_AGENDAR);
  assert.ok(!lista.veredicto.dudosa);
  trae('lista', 'proponer_tareas_plan', lista);
});

test('el mismo «Agendar reunión con…» SOLO es una orden de agenda', () => {
  for (const m of ['Agendar reunión con Ana mañana a las 15', 'Mako, agendar visita con Juan Pérez el jueves a las 10']) {
    const r = turno(m);
    assert.equal(r.veredicto.intencion, 'actuar', `«${m}» suelto no es una orden: ${r.veredicto.porque}`);
    trae(m, 'proponer_agendar_agenda', r);
  }
});

test('la pregunta de mover sin objeto llega al system del doer', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const ini = doer.indexOf('const bloqueTools = tools.length');
  const fin = doer.indexOf("'\\n\\nEN ESTE TURNO NO TIENES HERRAMIENTAS", ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el bloque de herramientas del system: cambió la forma y este test ya no mira nada');
  assert.match(doer.slice(ini, fin), /turno\.instruccion/, 'la instrucción del turno no llega al system: el modelo nunca pregunta');
  // Y la respuesta sólo se reconoce si el doer le dice al clasificador que MaKo hizo ESA
  // pregunta, leída de su último mensaje con la misma función que usa este test.
  const cls = doer.slice(doer.indexOf('clasificarIntencion(texto, {'), doer.indexOf('});', doer.indexOf('clasificarIntencion(texto, {')));
  assert.match(cls, /preguntoReunionOTarea:\s*preguntoReunionOTarea\(\s*typeof ultimoDeMako === 'string' \? ultimoDeMako : null\s*\)/,
    'el doer no le pasa al clasificador si MaKo preguntó «¿La reunión o la tarea?»: «la reunión» cae a material');
});
