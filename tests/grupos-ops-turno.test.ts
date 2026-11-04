// =============================================================================
// MaKo contesta sobre un mensaje de la app, con el mismo despachante, y un invitado no le saca datos del negocio (3/11/2026)
// =============================================================================
// Requisito 4 de Martín: MaKo participa igual que en el grupo de WhatsApp. Requisito 2: quien entra ve el grupo, no el resto del negocio. El hijo corre el POST real, el cron real y el turno real, con los modelos de
// mentira: tests/_grupos-ops-turno-hijo.ts.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
let fallo: unknown = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  // Una sola vez aunque falle: cada test volvería a correr el hijo, y el archivo pasaría el tope del vigía de tandas.
  if (fallo) throw fallo;
  try { return correrElHijo(); } catch (e) { fallo = e; throw e; }
}
function correrElHijo(): Record<string, any> {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_grupos-ops-turno-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}
// 'GOOGLE CALENDAR:' es el bloque de `ctxGoogle` (lib/agenda-sin-ia.ts → hechoGoogleCalendar): el pedido lo nombra, y si el negocio lo tiene conectado no es cosa de un invitado.
const SEMILLAS = ['SEMILLA-PERFIL', 'SEMILLA-OBJETIVO', 'SEMILLA-TICKET', 'SEMILLA-PENDIENTE', 'SEMILLA-CHARLA-RECIENTE', 'SEMILLA-RESPUESTA-RECIENTE', 'SEMILLA-CHARLA-VIEJA', 'SEMILLA-EQUIPO', 'GOOGLE CALENDAR:'];

test('de punta a punta: el POST guarda y vuelve, el turno corre aparte, y a Evolution no le llega NADA', () => {
  const e = R().e2e;
  assert.equal(e.status, 200);
  assert.deepEqual(e.filas.map((f: { autor: string }) => f.autor), ['persona', 'mako']);
  assert.equal(e.filas[0].canal, 'app');
  assert.equal(e.filas[0].usuario, 101);
  assert.equal(e.filas[0].reaccion, '👍', 'el acuse de la app sale después del clasificador');
  assert.equal(e.filas[1].texto, 'Hoy no entró ningún lead.');
  assert.deepEqual(e.evolution, [], 'lo que se escribe en la app NO sale por WhatsApp: ni el texto, ni la reacción, ni el «escribiendo»');
  assert.deepEqual(e.cola.map((c: { estado: string }) => c.estado), ['procesado']);
  assert.match(e.cola[0].id, /^app:\d+$/);
  assert.equal(e.cola[0].ws, 10);
  assert.equal(e.cola[0].jid, '120363000000000010@g.us', 'con grupo de WhatsApp la clave es su jid: el «sí» de un lado ve lo del otro');
  assert.deepEqual(e.conv.map((c: { role: string }) => c.role), ['user', 'assistant']);
  assert.equal(e.modelo.length, 1);
  assert.ok(e.modelo[0].tools > 0, 'quien administra corre con herramientas');
  assert.equal(e.modelo[0].voz, true);
  assert.equal(e.modelo[0].whatsapp, false, 'le hablaría de WhatsApp a quien escribe en la app');
});

test('el turno no corre en el pedido: sin sesión, y la ruta no importa el doer', () => {
  assert.equal(R().e2e.sesiones, 1, `el turno vio una sesión: el POST la pidió ${R().e2e.sesiones} vez o más`);
  const ruta = readFileSync(join(RAIZ, 'app/api/grupos/[ws]/mensajes/route.ts'), 'utf8');
  const sinComentarios = ruta.replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/from '@\/lib\/mako-doer-in'/.test(sinComentarios), 'corriendo el turno en el pedido, `cobros.run` lo trataría como del Super Admin');
  assert.ok(!/manejarEntranteDeLaApp/.test(sinComentarios));
  assert.ok(/runWithWorkspace\(ws, \(\) => encolar\(/.test(sinComentarios), 'encolar usa getTenantDb: la cola caería en el negocio del invitado');
  assert.ok(!/from '@\/lib\/mako-turno-app'/.test(sinComentarios), 'el mismo despachante: `turnoApp` no tiene el clasificador ni las confirmaciones del grupo');
});

test('el cron del turno pide el secreto, y no corre un mensaje que no es de ese negocio', () => {
  const c = R().cron;
  assert.equal(c.sinAuth, 401);
  assert.equal(c.filaQueNoExiste, 404);
  assert.equal(c.deOtroNegocio, 404);
});

test('la cola de lo que escribe un invitado es del negocio del GRUPO, no del suyo', () => {
  const [c] = R().colaDelInvitado;
  assert.equal(c.ws, 10, 'en su ws, el turno no vería la fila y el cron la correría con los datos de SU negocio');
  assert.equal(c.jid, '120363000000000010@g.us');
  assert.equal(c.participante, 'joan@ajeno.test#i@app.mako');
});

test('⛔ el control: con quien administra, las semillas SÍ llegan al modelo', () => {
  const [m] = R().datos.control;
  const todo = m.sys + m.mensajes;
  for (const s of SEMILLAS) assert.ok(todo.includes(s), `${s} no llegó: el control no prueba nada`);
  assert.ok(m.tools > 0);
});

test('⛔⛔ UN INVITADO NO LE SACA DATOS DEL NEGOCIO A MaKo: ni perfil, ni plata, ni tickets, ni pendientes, ni lo hablado antes de entrar', () => {
  const d = R().datos;
  assert.equal(d.invitado.length, 1, 'MaKo le tiene que contestar');
  const [m] = d.invitado;
  assert.equal(m.tools, 0, `viajaron herramientas: ${m.nombres}`);
  const todo = m.sys + m.mensajes;
  for (const s of SEMILLAS) assert.ok(!todo.includes(s), `⛔ ${s} le llegó al turno del invitado`);
  assert.equal(d.reaccion, '👍');
  assert.deepEqual(d.respuesta, ['No tengo ese dato aquí.'], 'adentro del grupo, MaKo le contesta');
});

test('⛔ lo que escribe un invitado no entra a la memoria', () => {
  assert.ok(!R().datos.convTrasInvitado.some((c: string) => /pensá cómo vamos/.test(c)));
  const m = R().memoria;
  assert.ok(!m.conv.some((c: string) => c.includes('SEMILLA-DEL-INVITADO')), `quedó en la memoria: ${m.conv}`);
  for (const t of m.alModeloDelDueno) assert.ok(!t.includes('SEMILLA-DEL-INVITADO'), 'el «dale» del dueño ejecutaría lo que pidió otra persona');
});

test('⛔ el pedido de un invitado no se delega y lo decide Martín, aunque administre otro negocio', () => {
  const t = R().tickets;
  assert.deepEqual(t.tDelegado.filter((x: { contexto?: { delegado?: boolean } }) => x.contexto?.delegado), [], 'el Cerebro recibiría «hazlo por la API de ese negocio»');
  assert.equal(t.tInvitado.length, 1, 'adentro del grupo, MaKo le abre el ticket');
  assert.equal(t.tInvitado[0].auto, false, 'en los ws 1, 10 y 11 entraba por la vía libre del negocio');
  assert.equal(t.tInvitado[0].despacho, null);
  assert.equal(t.tInvitado[0].rol, 'invitado');
  assert.equal(t.tInvitado[0].email, 'joan@ajeno.test');
  assert.equal(t.tInvitado[0].canal, 'whatsapp');
  assert.equal(t.tAdmin[0].auto, true, 'el control: la regla del negocio sigue para quien lo administra');
  assert.equal(t.tAdmin[0].despacho, 'runner');
  assert.equal(t.tAdmin[0].email, 'ana@fiesta.test', 'sin `actorDeWhatsApp` local quedaba `whatsapp:<nombre>`');
  assert.equal(t.tAdmin[0].canal, 'whatsapp', 'de `canal` cuelgan las mismas confirmaciones y el aviso de vuelta');
  assert.match(t.dichoAdmin[0], /#\d+/);
});

test('⛔ un invitado no escribe en el negocio por detrás: ni el Plan con la IA caída, ni la guía de una oferta abierta', () => {
  const p = R().porDetras;
  assert.equal(p.planAdmin, 1, 'el control: con quien administra, el texto se guarda crudo');
  assert.equal(p.planInvitado, 0, 'su «anotá» crearía un borrador en el Plan de ese negocio');
  assert.ok(p.ayudaAdmin.length > 0, `el control: la guía arranca con quien administra: ${JSON.stringify(p.ayudaAdmin)}`);
  assert.deepEqual(p.ayudaInvitado, [], `su «sí» arrancó la guía: ${JSON.stringify(p.ayudaInvitado)}`);
});

test('el tope del día de un invitado: el mensaje queda, sin gastar la IA del negocio; quien administra no lo tiene', () => {
  assert.deepEqual(R().topeDelDia, { status: 200, colaConTope: 0, colaDeQuienAdministra: 1 });
});

test('sin poder leer la clave, la fila queda y no se encola; el grupo de la plataforma usa su jid', () => {
  const c = R().clave;
  assert.equal(c.sinClave, 200);
  assert.equal(c.filasSinClave, 1, 'el mensaje no se pierde');
  assert.equal(c.colaSinClave, 0, 'otra clave sería otra cola, otro candado y otras pendientes');
  assert.deepEqual(c.plataforma, ['120363000000000009@g.us'], 'con otra clave, Martín no encuentra desde la app lo propuesto por WhatsApp');
  assert.deepEqual(c.evolution, []);
});

test('⛔ las letras no se creen lo que dice el mensaje', () => {
  const l = R().letras;
  assert.deepEqual(l.sacado, [0], `el sacado entre el POST y el turno corrió con ${l.sacado} herramientas`);
  assert.deepEqual(l.lecturaRota, [0], 'una lectura que falla da sin herramientas');
  assert.equal(l.numeralStatus, 200);
  assert.deepEqual(l.conNumeral, [0], 'un email con `#m`, leído por el primer `#`, correría con todo');
});

test('⚠️ las mismas confirmaciones de WhatsApp', () => {
  const c = R().confirmaciones;
  assert.equal(c.okEspera.estado, 'pendiente', '«ok, esperá» ejecutaría lo que mueve plata');
  assert.ok(c.okEspera.salida.some((s: string) => /mueve plata/.test(s)), JSON.stringify(c.okEspera.salida));
  assert.equal(c.siDeOtro.estado, 'pendiente', 'el «sí» de otra persona');
  assert.ok(c.siDeOtro.salida.some((s: string) => /no es de quien la pidió/.test(s)), JSON.stringify(c.siDeOtro.salida));
  assert.notEqual(c.siDeQuienPidio, 'pendiente', 'el «sí» de quien pidió');
  assert.notEqual(c.siAMaKo, 'pendiente', '«@MaKo sí» es una confirmación');
  assert.notEqual(c.nacioEnWhatsApp, 'pendiente', 'lo propuesto en WhatsApp se confirma desde la app');
});

test('⛔ un «dale» en WhatsApp no ejecuta lo que se propuso sólo en la app', () => {
  const { daleEnWhatsApp, propuestaSoloApp, salidaPropuesta } = R().confirmaciones;
  assert.equal(daleEnWhatsApp.estado, 'pendiente', 'saldría algo que no se deshace, confirmado por alguien que nunca vio la pregunta');
  assert.ok(daleEnWhatsApp.salida.some((s: string) => /se pidió en el grupo de la app/.test(s)), JSON.stringify(daleEnWhatsApp.salida));
  assert.equal(propuestaSoloApp.length, 1, JSON.stringify(salidaPropuesta));
  assert.equal(propuestaSoloApp[0].soloApp, true, 'lo que se propone en un turno sólo de la app queda marcado');
  assert.equal(propuestaSoloApp[0].pidio, 'ana@fiesta.test#m@app.mako');
});

test('sin grupo de WhatsApp: la clave es de la app, la regla de plata sigue, y a Evolution nada', () => {
  const s = R().sinGrupo;
  assert.equal(s.otro.estado, 'pendiente', 'con otra clave, `enElGrupo` se apagaría callado');
  assert.ok(s.otro.salida.some((x: string) => /no es de quien la pidió/.test(x)), JSON.stringify(s.otro.salida));
  assert.notEqual(s.quienPidio, 'pendiente');
  assert.deepEqual(s.clave, ['app12@g.us']);
  assert.deepEqual(s.evolution, []);
});

test('con dos líneas de MaKo en el grupo, MaKo no se contesta a sí misma (4/11/2026, ws13)', () => {
  const e = R().ecoDeOtraLinea;
  assert.equal(e.tarde.encolado, true, 'la escena reproduce el caso: el eco entró a la cola antes de que su id llegara al anillo');
  assert.equal(e.tarde.pedidoAlModelo, true, 'el pedido de Joan sí llega al turno');
  assert.equal(e.tarde.ecoAlModelo, false, 'lo que mandó MaKo no entra al lote: armaba la ficha de otra persona');
  assert.equal(e.tarde.procesado, true, 'el eco queda procesado: el cron no lo vuelve a tomar');
  assert.equal(e.conId.encolado, false, 'con el id ya en el anillo, ni entra a la cola');
  assert.equal(e.conId.llamadasAlTurno, 0);
  assert.equal(e.conId.textosPorWhatsApp, 0);
});

test('una pregunta a MaKo no se queda en el 👍, en la app y en WhatsApp (4/11/2026)', () => {
  const q = R().preguntaAMaKo;
  assert.deepEqual(q.vivo.deMaKo, ['Sí, aquí estoy.'], '«mako estas vivo?» se contesta aunque la IA diga charla');
  assert.deepEqual(q.noReplyConPregunta.deMaKo, ['Sí, te escucho.'], 'lo mismo si la IA dice que no es para MaKo y lo nombra preguntando');
  assert.deepEqual(q.gracias.deMaKo, [], '«MaKo, gracias» no pregunta: el 👍 alcanza');
  assert.equal(q.gracias.reaccion, '👍');
  assert.equal(q.gracias.llamadasAlTurno, 0);
  assert.deepEqual(q.bienAhi.deMaKo, []);
  assert.equal(q.bienAhi.reaccion, '👍');
  assert.deepEqual(q.aJuan.deMaKo, [], '«Juan, ¿venís?» pregunta, pero no a MaKo: silencio');
  assert.equal(q.aJuan.reaccion, null);
  assert.equal(q.aJuan.llamadasAlTurno, 0);
  assert.equal(q.vivoPorWhatsApp.textosPorWhatsApp, 1, 'en WhatsApp sale la respuesta');
  assert.ok(q.vivoPorWhatsApp.deMaKo.includes('Acá estoy, por WhatsApp.'));
  assert.equal(q.graciasPorWhatsApp.textosPorWhatsApp, 0);
  assert.equal(q.graciasPorWhatsApp.llamadasAlTurno, 0);
});

test('personas hablando entre ellas: MaKo no aparece', () => {
  const p = R().personas;
  assert.deepEqual(p.noReply.deMaKo, []);
  assert.equal(p.noReply.reaccion, null, 'el pulgar y después silencio');
  assert.equal(p.noReply.llamadasAlTurno, 0);
  assert.deepEqual(p.noReply.evolution, []);
  assert.deepEqual(p.charla.deMaKo, []);
  assert.equal(p.charla.reaccion, '👍', 'una charla: el 👍 es la respuesta');
  assert.deepEqual(p.sinClase.deMaKo, [], 'sin quien clasifique, «Juan, mirá esto» iba a turno completo');
  assert.equal(p.sinClase.llamadasAlTurno, 0);
  assert.equal(p.sinClase.tickets, 0);
  assert.deepEqual(p.unaSola.deMaKo, ['Sí, hola.'], 'con una sola persona en el grupo, le habla a MaKo');
  assert.deepEqual(p.unaSola.clave, ['app12@g.us']);
  assert.deepEqual(p.unaSola.evolution, []);
});

test('lotes: dos mensajes, una respuesta; con un invitado, dos turnos; huérfanas, sin Evolution; con WhatsApp, a los dos', () => {
  const r = R();
  assert.deepEqual(r.dosMensajes.deMaKo, ['Una sola respuesta.']);
  assert.equal(r.dosMensajes.llamadas, 1);
  assert.deepEqual(r.dosMensajes.evolution, []);
  assert.ok(r.dosMensajes.mensajes[0].includes('cuántos cerraron') && r.dosMensajes.mensajes[0].includes('cuántos leads hay'));
  assert.deepEqual(r.loteMixto, [{ tools: r.loteMixto[0].tools, conInvitado: false, conAna: true }, { tools: 0, conInvitado: true, conAna: false }], 'el saludo del invitado le apagaba las herramientas al dueño');
  assert.ok(r.loteMixto[0].tools > 0);
  assert.deepEqual(r.huerfana.deMaKo, ['Te contesto tarde.']);
  assert.deepEqual(r.huerfana.evolution, [], 'el cron tiene que abrir el contexto');
  assert.deepEqual(r.huerfana.cola, ['procesado']);
  assert.deepEqual(r.huerfanaInvitado, [0], 'el cron vuelve a mirar la letra');
  assert.deepEqual(r.conWhatsApp.deMaKo, ['A los dos.']);
  assert.equal(r.conWhatsApp.envios, 1);
  assert.equal(r.conWhatsApp.llamadas, 1);
});

test('un turno que murió a la mitad no se pierde callado, ni se repite', () => {
  const m = R().turnoMuerto;
  assert.deepEqual(m.deMaKo, ['Se me cortó mientras hacía esto. Pídemelo de nuevo.']);
  assert.equal(m.llamadas, 0);
  assert.deepEqual(m.cola, ['procesado']);
});

test('⚠️ el candado se renueva y lo que se escribe mientras MaKo piensa se contesta sin el cron, sin repetir lo anterior', () => {
  const c = R().candado;
  assert.match(c.turnoBob.skip, /ya hay alguien juntando/, 'sin renovar, Bob ganaba el candado vencido y la cola traía el pedido de Ana');
  assert.deepEqual(c.deMaKo, ['Te contesto.', 'Te contesto.'], 'Bob quedaba 2 o 3 minutos sin respuesta');
  assert.equal(c.llamadas.length, 2);
  assert.ok(c.llamadas[0].includes('cuántos leads hay'));
  assert.ok(c.llamadas[1].includes('los de ayer') && !c.llamadas[1].includes('cuántos leads hay'), `repitió lo de Ana: ${c.llamadas[1]}`);
  assert.deepEqual(c.cola, ['procesado', 'procesado']);
});

test('⛔ un «ok» de un invitado no cierra las insistencias ni cambia las automatizaciones; el de quien administra, sí', () => {
  assert.deepEqual(R().acuse.invitado, { cerrada: false, marcada: false });
  assert.deepEqual(R().acuse.admin, { cerrada: true, marcada: true });
});

test('el archivo y la nota de voz, del bucket; sin IA, la nota queda y MaKo lo dice', () => {
  const r = R();
  assert.equal(r.notaSinIA.filas[0].autor, 'persona');
  assert.ok(r.notaSinIA.filas.some((f: { autor: string }) => f.autor === 'mako'), `sin aviso: ${JSON.stringify(r.notaSinIA.filas)}`);
  assert.deepEqual(r.notaSinIA.evolution, []);
  assert.deepEqual(r.foto.evolution, [], 'la foto de la app no se pide a Evolution');
  assert.deepEqual(r.foto.deMaKo, ['Es una captura.']);
  assert.deepEqual(r.citaAudio.evolution, [], 'sin línea, se escucha por su fila');
  assert.deepEqual(r.citaAudio.alModelo, [true], 'el modelo no recibió lo que dice el audio citado');
});

test('⚠️ la respuesta al equipo, desde la app: queda para el equipo, y MaKo no la contesta ni al rato, por el cron', () => {
  const a = R().alEquipo;
  assert.deepEqual(a.cola, ['procesado'], 'la ruta ya la encoló: sin sacarla, el cron corre un turno sobre ella (en WhatsApp nunca entra a la cola)');
  assert.deepEqual(a.deMaKo, [], 'es lo que Martín reclamó el 28/10: «Leila respondió al desarrollador y MaKo saltó a decirle cualquier cosa»');
  assert.equal(a.llamadas, 0);
  assert.equal(a.alEquipo, 1, 'la respuesta le tiene que llegar al equipo');
  assert.deepEqual(a.conPedido.deMaKo, ['Te respondo.'], 'si además le pide algo a MaKo, va a los dos');
  assert.deepEqual(a.conPedido.cola, ['procesado']);
  // Sin el autollamado, la fila queda y la levanta el cron: tampoco a MaKo (`sinLasDelEquipo`).
  assert.deepEqual(a.sinAutollamado.cola, ['pendiente'], 'el control: sin el autollamado, la fila sigue en la cola');
  assert.deepEqual(a.sinAutollamado.colaDespues, ['procesado']);
  assert.deepEqual(a.sinAutollamado.deMaKo, [], 'el cron le hacía contestar a MaKo lo que era para el equipo');
  assert.equal(a.sinAutollamado.llamadas, 0);
  assert.equal(a.sinAutollamado.alEquipo, 1, 'la respuesta le tiene que llegar al equipo, una vez');
  assert.deepEqual(a.enLoteAjeno.deMaKo, ['Hay 3.'], 'MaKo le contesta a Bob, una vez');
  assert.equal(a.enLoteAjeno.alModelo, false, 'la respuesta al equipo de Ana entró al lote de Bob');
  assert.deepEqual(a.enLoteAjeno.cola, ['procesado', 'procesado']);
  assert.equal(a.enLoteAjeno.alEquipo, 1);
});

test('⛔ «Hola Martín» de un invitado: el ticket automático tampoco entra por la vía libre', () => {
  const n = R().noPude;
  assert.equal(n.admin.length, 1);
  assert.equal(n.admin[0].auto, true, 'el control: de quien administra, un bug evidente va directo al arreglo');
  assert.equal(n.invitado.length, 1, 'el ticket se abre igual: adentro del grupo, MaKo se lo pasa al equipo');
  assert.equal(n.invitado[0].auto, false, 'el texto de alguien de otro negocio le llegaría al Runner como un arreglo');
  assert.equal(n.invitado[0].despacho, null);
});

test('⛔ un invitado no suma nada a un ticket del negocio con [[ya-pedido]], y la marca no se le muestra', () => {
  const y = R().yaPedido;
  assert.equal(y.admin, 1, 'el control: de quien administra, se suma');
  assert.equal(y.invitado.eventos, 0, 'lo que escribe alguien de otro negocio entraría al ticket');
  assert.ok(y.invitado.deMaKo.every((t: string) => !t.includes('[[')), `la marca llegó al hilo: ${y.invitado.deMaKo}`);
});

test('⚠️ varias fotos de un envío: la respuesta es por todas y no espera al cron; una foto suelta sigue sin despertarla', () => {
  const f = R().fotos;
  assert.deepEqual(f.estados, [200, 200, 200, 200], 'un 429 del tope por minuto haría pasar esto sin probar nada');
  assert.deepEqual(f.tresFotos.cola, ['procesado', 'procesado', 'procesado'], 'sólo la primera nombra a MaKo y sólo la última dispara: quedaba hasta 3 min sin respuesta y mirando una foto');
  assert.deepEqual(f.tresFotos.deMaKo, ['Veo las tres.']);
  assert.equal(f.fotoDeOtra, 0, 'lo que otra persona tiene en la cola no convierte la foto de Ana en un pedido a MaKo');
});

test('la computadora de quien escribe: sólo si es quien la conectó', () => {
  assert.deepEqual(R().pc, { conOtro: 'SinLaPersona', conEl: 'encoló' });
  const doer = readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8');
  assert.match(doer, /if \(deLaApp\?\.letra === 'i'\) return null;/, 'un invitado nunca va a la computadora de nadie');
});

test('la API de MaKo: escribir no toca Evolution; leer no sale por WhatsApp ni HTTP; invitar se confirma en pantalla', () => {
  const a = R().api;
  assert.equal(a.filasAlProponer, 0, 'con confirmación por chat: queda pendiente hasta el «sí»');
  assert.deepEqual(a.filas, ['Lo manda el agente'], `por HTTP con token ejecutar: ${JSON.stringify(a.confirmado)}`);
  assert.deepEqual(a.evolution, []);
  assert.match(JSON.stringify(a.verPorHttp), /no.*(disponible|existe)|isError/i);
  assert.match(JSON.stringify(a.verPorWa), /no.*(disponible|existe)|isError/i, 'el grupo de WhatsApp le sacaría lo escrito sólo en la app');
  assert.match(a.invitarWa, /revisar/);
  assert.equal(a.invitados, 0, 'por el grupo cualquiera propone: confirma sólo quien administra, en pantalla');
  assert.deepEqual(a.canales.ver_grupo, ['app']);
  assert.deepEqual(a.canales.invitar_al_grupo, ['whatsapp', 'app']);
  assert.deepEqual(a.canales.sacar_del_grupo, ['whatsapp', 'app']);
  assert.deepEqual(a.canales.escribir_en_grupo, ['app', 'http']);
});

// PROBADO ROMPIÉNDOLO (3/11/2026): una rotura por vez sobre el código real, corriendo este archivo, y restaurada. Las 36 dieron rojo:
//   · el invitado con herramientas → 3 en rojo: «⛔⛔ UN INVITADO NO LE SACA DATOS DEL NEGOCIO A MaKo: ni perfi»
//   · el invitado con el system entero → 1 en rojo: «⛔⛔ UN INVITADO NO LE SACA DATOS DEL NEGOCIO A MaKo: ni perfi»
//   · el invitado con historial → 2 en rojo: «⛔⛔ UN INVITADO NO LE SACA DATOS DEL NEGOCIO A MaKo: ni perfi»
//   · el invitado con conMemoria → 1 en rojo: «⛔⛔ UN INVITADO NO LE SACA DATOS DEL NEGOCIO A MaKo: ni perfi»
//   · el invitado ve las pendientes → 1 en rojo: «⛔⛔ UN INVITADO NO LE SACA DATOS DEL NEGOCIO A MaKo: ni perfi»
//   · lo del invitado entra a la memoria → 1 en rojo: «⛔ lo que escribe un invitado no entra a la memoria»
//   · el invitado delega → 1 en rojo: «⛔ el pedido de un invitado no se delega y lo decide Martín,»
//   · su ticket por la vía libre → 1 en rojo: «⛔ el pedido de un invitado no se delega y lo decide Martín,»
//   · no se recalcula la letra → 2 en rojo: «⛔ las letras no se creen lo que dice el mensaje»
//   · una lectura rota da m → 1 en rojo: «⛔ las letras no se creen lo que dice el mensaje»
//   · canal app en el turno → 3 en rojo: «⚠️ las mismas confirmaciones de WhatsApp»
//   · el dale de WhatsApp confirma lo de la app → 1 en rojo: «⛔ un «dale» en WhatsApp no ejecuta lo que se propuso sólo en»
//   · no se marca lo sólo de la app → 1 en rojo: «⛔ un «dale» en WhatsApp no ejecuta lo que se propuso sólo en»
//   · la clave de la app sin @g.us → 2 en rojo: «sin grupo de WhatsApp: la clave es de la app, la regla de pl»
//   · el 👍 al llegar → 1 en rojo: «personas hablando entre ellas: MaKo no aparece»
//   · sin clase, MaKo se mete → 1 en rojo: «personas hablando entre ellas: MaKo no aparece»
//   · el turno en el pedido → 13 en rojo: «de punta a punta: el POST guarda y vuelve, el turno corre ap»
//   · encolar sin runWithWorkspace → 6 en rojo: «el turno no corre en el pedido: sin sesión, y la ruta no imp»
//   · el cron sin contexto → 2 en rojo: «lotes: dos mensajes, una respuesta; con un invitado, dos tur»
//   · soloApp no sale de la cola → 1 en rojo: «lotes: dos mensajes, una respuesta; con un invitado, dos tur»
//   · el candado no se renueva → 1 en rojo: «⚠️ el candado se renueva y lo que se escribe mientras MaKo p»
//   · sin otra vuelta → 1 en rojo: «⚠️ el candado se renueva y lo que se escribe mientras MaKo p»
//   · el ok del invitado acusa → 1 en rojo: «⛔ un «ok» de un invitado no cierra las insistencias ni cambi»
//   · la foto se pide a Evolution → 1 en rojo: «el archivo y la nota de voz, del bucket; sin IA, la nota que»
//   · el actor sin el email → 1 en rojo: «⛔ el pedido de un invitado no se delega y lo decide Martín,»
//   · un lote mixto en un turno → 1 en rojo: «lotes: dos mensajes, una respuesta; con un invitado, dos tur»
//   · el turno muerto se calla → 1 en rojo: «un turno que murió a la mitad no se pierde callado, ni se re»
//   · el cron sin secreto → 1 en rojo: «el cron del turno pide el secreto, y no corre un mensaje que»
//   · la PC de cualquiera → 1 en rojo: «la computadora de quien escribe: sólo si es quien la conectó»
//   · el invitado escribe en el Plan → 1 en rojo: «⛔ un invitado no escribe en el negocio por detrás: ni el Pla»
//   · el invitado arranca la guía → 1 en rojo: «⛔ un invitado no escribe en el negocio por detrás: ni el Pla»
//   · sin el tope del día → 1 en rojo: «el tope del día de un invitado: el mensaje queda, sin gastar»
//   · sin poder leer la clave, app<ws> → 1 en rojo: «sin poder leer la clave, la fila queda y no se encola; el gr»
//   · la plataforma con su clave de app → 1 en rojo: «sin poder leer la clave, la fila queda y no se encola; el gr»
//   · ver_grupo por WhatsApp → 1 en rojo: «la API de MaKo: escribir no toca Evolution; leer no sale por»
//   · escribir por la API va a WhatsApp → 1 en rojo: «la API de MaKo: escribir no toca Evolution; leer no sale por»
// PROBADO ROMPIÉNDOLO (4/11/2026, la revisión): una por vez, sobre el código real y restaurada, y las 7 en rojo:
//   · `sacarDeLaCola` no saca nada → 1 en rojo: «la respuesta al equipo, desde la app»
//   · `ticketDeNoPude` sin `invitado` → 1 en rojo: «Hola Martín de un invitado»
//   · el turno del invitado lee los tickets → 1 en rojo: «un invitado no suma nada a un ticket»
//   · la foto no sigue el pedido → 1 en rojo: «varias fotos de un envío»
//   · la foto sigue el pedido de cualquiera → 1 en rojo: «varias fotos de un envío»
//   · el invitado con herramientas → 3 en rojo; con el system entero → 1 en rojo; lo de la app sale por WhatsApp → 5 en rojo
// PROBADO ROMPIÉNDOLO (4/11/2026, al llevarlo a main): `ctxGoogle` sin `hayInvitado`, base 27/0 → 1 en rojo: «UN INVITADO NO LE SACA DATOS DEL NEGOCIO»
// (el bloque «GOOGLE CALENDAR:» de main es una semilla más: el pedido lo nombra, y le llega a quien administra).
// PROBADO ROMPIÉNDOLO (4/11/2026, al llevarlo a main), `sinLasDelEquipo`, base 27/0:
//   · el cron sin apartarla → 1 en rojo: «la respuesta al equipo, desde la app» (el cron le hacía contestar a MaKo)
//   · el lote sin apartarla → 1 en rojo: «la respuesta al equipo de Ana entró al lote de Bob»
// PROBADO ROMPIÉNDOLO (4/11/2026, la pregunta a MaKo), `preguntaAMaKo` en lib/mako-doer-in.ts, base 28/0:
//   · sin el cambio (la charla se queda en el 👍) → 1 en rojo: «mako estas vivo? se contesta aunque la IA diga charla»
//   · las reglas con el respaldo del grupo (`porReglas`) → 2 en rojo: «MaKo, gracias no pregunta» y la charla de «personas hablando»
//   · le habla siempre (sin mirar si lo nombra) → 2 en rojo: «Juan, ¿venís? pregunta, pero no a MaKo» y «personas hablando»
// PROBADO ROMPIÉNDOLO (4/11/2026, dos líneas de MaKo en el grupo), corriendo este archivo y tests/doer-para-quien.test.ts, base 29/0 y 14/0:
//   · `esEcoDeMaKo` sólo con `fromMe` → 2 en rojo (este y el 13 de doer-para-quien) · `esEcoDeMaKoAhora` sólo con `fromMe` → 2 en rojo
//   · el lote sin `sinLosEcos` → 1 en rojo: «MaKo no se contesta a sí misma» (el eco llegaba al turno junto con el pedido de Joan)
