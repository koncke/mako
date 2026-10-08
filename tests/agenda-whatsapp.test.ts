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
//   5. que nada de la agenda salga por HTTP sin que alguien lo decida.
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
import { clasificarIntencion, areasDelMensaje } from '../lib/mako-intencion';
import { herramientasDelTurno, DE_CALENDLY } from '../lib/doer-herramientas';
import { porId, type Vista } from '../lib/api-mako/registro';

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

type Ctx = { hayPendientes?: boolean; hayPendienteDeAgenda?: boolean; makoPregunto?: boolean; hayAgendaAbierta?: boolean };
/** El turno como lo arma el doer (lib/mako-doer-in.ts), con las mismas dos funciones. */
function turno(mensaje: string, ctx: Ctx = {}, extra: { contextoDelSi?: string; resumenesPendientes?: string[]; sinCalendly?: boolean } = {}) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  const t = herramientasDelTurno({
    veredicto, texto: mensaje, agendaAbierta: !!ctx.hayAgendaAbierta, deSiempre: DE_SIEMPRE, vista,
    hayPendientes: !!ctx.hayPendientes, contextoDelSi: veredicto.sigueOfrecimiento ? extra.contextoDelSi ?? null : null,
    resumenesPendientes: extra.resumenesPendientes, sinCalendly: extra.sinCalendly,
  });
  return { veredicto, nombres: t.tools.map((x) => x.name), areas: t.areas };
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
