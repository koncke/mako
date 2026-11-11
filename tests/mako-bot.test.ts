// =============================================================================
// El bot 1 a 1 de MaKo en WhatsApp: nunca escribe primero, y sale por SU línea (3/11/2026)
// =============================================================================
// Martín: «no va a crear ni grupos de WhatsApp y no va a mandar ni mensajes a nadie... si un usuario lo quiere escribir [...] ahí MaKo le puede responder». Corre sobre el código REAL
// (tests/_mako-bot-hijo.ts: la entrada, quién es, la cola y el turno del doer, con un PostgREST de mentira y un Evolution que anota). La voz es `mako_ws9`, el WhatsApp personal de Martín, como en
// producción: lo primero que se mira es por qué línea salió cada cosa.
//
// Probado ROMPIÉNDOLO (3/11/2026), de a una, 25 roturas: la puerta sin la ventana o con el bot apagado, un DM o una reacción por la voz, una línea de negocio o una que no es la del bot, un mensaje viejo,
// otro país viendo un negocio ajeno, el equipo con datos, «no pude leer» tomado como «no tiene cuenta», la cola huérfana corriendo el doer, y los teléfonos en los settings del ws1.
// La primera pasada dejó verdes dos: la escena del bot apagado no tenía línea, así que nunca podía salir nada, y el «escribiendo…» no contaba como salida. Por eso `todoAWhatsApp`. Ahora fallan las 25; restaurado, 29 pasan y 0 fallan.
//
// Correr: node --import tsx --test tests/mako-bot.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lineaDeCambio, TOPE_DEL_DIA } from '../lib/mako-bot-reglas';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_mako-bot-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const LINEA = 'mako_bot', VOZ = 'mako_ws9';

test('el hijo corrió entero', () => {
  assert.equal(R.error, undefined, R.error);
});

test('sin los settings, el bot está apagado: no anota a nadie ni contesta', () => {
  assert.deepEqual(R.apagado.enviados, []);
  assert.equal(R.apagado.filas, 0);
  assert.equal(R.apagado.config.activo, false);
});

test('⛔ con la línea de un negocio (el WhatsApp personal de Martín) queda apagado', () => {
  assert.deepEqual(R.lineaDeNegocio.enviados, []);
  assert.equal(R.lineaDeNegocio.config.activo, false);
  assert.equal(R.lineaDeNegocio.config.instancia, null);
});

test('otra línea, aunque no sea de un negocio, no contesta', () => {
  assert.deepEqual(R.otraLinea.enviados, []);
  assert.equal(R.otraLinea.filas, 0);
});

test('⛔ un mensaje viejo (una línea poniéndose al día) no se contesta ni abre la ventana', () => {
  assert.deepEqual(R.viejo.enviados, []);
  assert.equal(R.viejo.filas, 0);
});

test('sin cuenta: ventas, por la línea del bot, sin herramientas ni el turno de ningún negocio', () => {
  assert.equal(R.ventas.r.caso, 'ventas');
  assert.equal(R.ventas.r.contesto, true);
  assert.deepEqual(R.ventas.enviados.map((e: { linea: string; a: string }) => [e.linea, e.a]), [[LINEA, '5491155500001@s.whatsapp.net']]);
  assert.deepEqual(R.ventas.tools, []);
  assert.equal(R.ventas.turnoDelNegocio, 0);
  assert.match(R.ventas.system, /todavía no tiene cuenta/);
  assert.match(R.ventas.system, /No eres un asistente general/);
  // Los precios salen de la misma fuente que la vitrina.
  assert.match(R.ventas.system, /US\$\d+/);
  assert.ok(R.ventas.conv.every((c: { ws: number }) => c.ws === 9), 'la conversación de quien no tiene cuenta es de la plataforma, nunca del ws1');
});

test('el equipo se entera en la app, una sola vez por persona', () => {
  assert.deepEqual(R.ventas.feed.map((f: { ws: number; tipo: string }) => [f.ws, f.tipo]), [[9, 'bot-contacto-nuevo']]);
  assert.match(R.ventas.feed[0].descripcion, /Ana \(\+5491155500001\): ¿Qué es MaKo\?/);
  assert.equal(R.ventasSegundo.avisos, 0);
});

test('cuando pide una persona: la marca no le llega, y el equipo se entera', () => {
  assert.deepEqual(R.pideHumano.textos, ['Claro, le paso tu mensaje al equipo.']);
  assert.ok(R.pideHumano.tipos.includes('bot-pide-persona'));
});

test('quien administra un negocio: el turno del doer con SUS datos, y todo por la línea del bot', () => {
  assert.equal(R.conocido.r.caso, 'negocio');
  assert.equal(R.conocido.hayTurno, true);
  assert.ok(R.conocido.enviados.length > 0);
  for (const e of R.conocido.enviados) assert.equal(e.linea, LINEA, `salió por ${e.linea}: ${JSON.stringify(e)}`);
  assert.ok(R.conocido.enviados.some((e: { que: string; texto: string }) => e.que === 'sendText' && e.texto === 'Tienes 3 leads nuevos.'));
  assert.ok(R.conocido.conv.every((c: { ws: number; jid: string }) => c.ws === 10 && c.jid === '5491100000010@s.whatsapp.net'));
});

test('el turno sabe que no es un grupo, y de qué puede hablar (la regla de IA de Meta)', () => {
  assert.equal(R.conocido.systemDiceChat, true);
  assert.equal(R.conocido.systemDiceGrupo, false);
  assert.equal(R.conocido.soloMako, true);
});

test('el teléfono de un chat no queda en los settings del ws1, que es un cliente', () => {
  assert.deepEqual(R.conocido.settingsDelChatEnElWs1, []);
});

test('un saludo se contesta: en un chat hay alguien esperando', () => {
  assert.equal(R.soloPrueba.dentro.caso, 'negocio');
  assert.equal(R.soloPrueba.dentro.contesto, true);
});

test('⛔ otro país con los mismos 10 dígitos NO ve los datos de ese negocio: es ventas', () => {
  assert.equal(R.otroPais.r.caso, 'ventas');
  assert.equal(R.otroPais.turnoDelNegocio, 0);
  assert.deepEqual(R.otroPais.tools, []);
});

test('alguien del equipo, sin administrar: sin datos, sin herramientas y sin el turno del negocio', () => {
  assert.equal(R.equipo.r.caso, 'equipo');
  assert.equal(R.equipo.turnoDelNegocio, 0);
  assert.deepEqual(R.equipo.tools, []);
  assert.match(R.equipo.system, /no ves ni das datos de ese negocio/);
});

test('una agencia: pregunta UNA vez, y no contesta nada antes de saber de cuál negocio', () => {
  const a = R.agencia;
  assert.equal(a.a1.caso, 'preguntar');
  assert.equal(a.lista1.length, 1);
  assert.match(a.lista1[0], /1\. Agencia Uno\n2\. Giselle Coaching\n3\. Marcela Bienes/);
  assert.equal(a.turnos1, 0, 'contestó antes de saber de cuál negocio');
  assert.equal(a.lista2.length, 1, 'repitió la pregunta');
  assert.equal(a.espera, 2, 'perdió lo que escribió mientras tanto');
});

test('una agencia: con «2» elige, y contesta lo que había escrito en UN turno, con los datos de ése', () => {
  const a = R.agencia;
  assert.equal(a.elegido, 17);
  assert.equal(a.conv3.length, 1, 'dos preguntas seguidas son una conversación: fueron dos turnos');
  assert.equal(a.conv3[0].ws, 17);
  assert.match(a.conv3[0].content, /¿Cuántos leads tengo hoy\?/);
  assert.match(a.conv3[0].content, /y ayer\?/);
  assert.deepEqual(a.textos3, [lineaDeCambio('Giselle Coaching'), 'Tienes 3 leads nuevos.']);
});

test('una agencia: sigue en el que venía, y cambia sola cuando nombra otro, diciéndolo', () => {
  const a = R.agencia;
  assert.deepEqual(a.textos4, ['Tienes 3 leads nuevos.']);
  assert.deepEqual(a.textos5, [lineaDeCambio('Marcela Bienes'), 'Tienes 3 leads nuevos.']);
  assert.equal(a.elegidoFinal, 23);
  assert.equal(a.ws5[a.ws5.length - 1], 23);
});

test('⛔ sin poder leer de quién es, no le vende nada: podría ser un cliente', () => {
  assert.equal(R.lecturaCaida.claude, 0);
  assert.deepEqual(R.lecturaCaida.textos, ['Se me cortó algo de este lado. ¿Me escribes de nuevo en un rato?']);
});

test('el modo de prueba: los que no están en la lista no reciben nada, ni abren la ventana', () => {
  assert.deepEqual(R.soloPrueba.fueraEnviados, []);
  assert.equal(R.soloPrueba.filasFuera, 0);
});

test('el tope del día: lo dice una vez, sin gastar IA, y después silencio', () => {
  assert.deepEqual(R.tope.tope1Textos, [TOPE_DEL_DIA]);
  assert.deepEqual(R.tope.tope2Textos, [TOPE_DEL_DIA]);
  assert.equal(R.tope.claude, 0);
});

test('⛔ LA PUERTA: sin haber escrito, o hace más de 24 horas, no sale NADA', () => {
  assert.equal(R.puerta.sinFila.ok, false);
  assert.equal(R.puerta.sinFila.fueraDeVentana, true);
  assert.deepEqual(R.puerta.sinFilaEnv, []);
  assert.equal(R.puerta.vieja.ok, false);
  assert.equal(R.puerta.vieja.fueraDeVentana, true);
  assert.equal(R.puerta.reaccionVieja, false);
  assert.deepEqual(R.puerta.viejaEnv, []);
});

test('la puerta: dentro de las 24 horas sale, y por la línea del bot', () => {
  assert.equal(R.puerta.abierta.ok, true);
  assert.deepEqual(R.puerta.abiertaEnv.map((e: { linea: string }) => e.linea), [LINEA]);
});

test('⛔ el doer no puede saltarse la puerta: con la ventana cerrada corre el turno y no sale NADA, por ninguna línea', () => {
  assert.equal(R.doerSinVentana.hayTurno, true, 'la prueba no llegó al turno: no prueba nada');
  assert.deepEqual(R.doerSinVentana.enviados, []);
  assert.deepEqual(R.doerSinVentana.todo, [], 'ni el «escribiendo…»: también es escribirle');
});

test('⛔ el turno del doer no llama a los envíos de la voz con el jid de una persona', () => {
  const doer = readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8').replace(/\r/g, '');
  // Lo que cuida es la CONDICIÓN: sólo un grupo llega a la voz. Desde el 11/11/2026 la llamada va envuelta en `comoRespuesta` (la
  // respuesta pasa el freno de la línea, lib/respuesta-en-curso.ts), que no cambia a quién le escribe.
  assert.match(doer, /if \(jid\.endsWith\('@g\.us'\)\) return (?:comoRespuesta\(\(\) => )?enviarAlGrupoPorJid\(jid, texto, delayMs\)\)?;/);
  assert.match(doer, /\(jid\.endsWith\('@g\.us'\) \? (?:comoRespuesta\(\(\) => )?reaccionarEnElGrupo\(jid, key, emoji\)\)? : reaccionarEnElChat\(jid, key, emoji\)\)/);
  // Los nombres de lib/mako-grupo.ts entran renombrados: un `enviarAGrupoJid` suelto del archivo es la función de acá, la que desvía.
  assert.match(doer, /enviarAGrupoJid as enviarAlGrupoPorJid/);
  assert.match(doer, /reaccionarMensaje as reaccionarEnElGrupo/);
  assert.equal(doer.split('enviarAlGrupoPorJid(').length - 1, 1, 'hay otra llamada directa a la voz');
  assert.equal(doer.split('reaccionarEnElGrupo(').length - 1, 1, 'hay otra reacción directa por la voz');
});

test('un grupo sigue saliendo por la voz, como hoy: no se tocó', () => {
  assert.equal(R.alGrupo.alGrupo.ok, true);
  assert.deepEqual(R.alGrupo.enviados.map((e: { linea: string }) => e.linea), [VOZ]);
});

test('con el bot apagado, ni con la ventana abierta', () => {
  assert.equal(R.puertaApagada.r.ok, false);
  assert.deepEqual(R.puertaApagada.enviados, []);
});

test('⛔ una cola huérfana de un desconocido NUNCA corre el doer con los datos de la plataforma', () => {
  assert.equal(R.huerfano.turnoDelDoer, 0);
  assert.ok(R.huerfano.tools.every((t: unknown[]) => t.length === 0), 'le dio herramientas a un desconocido');
  assert.match(R.huerfano.system, /todavía no tiene cuenta/);
  assert.deepEqual(R.huerfano.enviados.map((e: { linea: string }) => e.linea), [LINEA]);
  assert.deepEqual(R.huerfano.cola, ['procesado']);
});

test('el webhook le pasa los chats al bot ANTES de resolver el workspace, y los grupos no', () => {
  const ruta = readFileSync(join(RAIZ, 'app/api/webhooks/evolution/route.ts'), 'utf8').replace(/\r/g, '');
  const bot = ruta.indexOf('manejarEntranteBot(instance, m)');
  const ws = ruta.indexOf("if (ws == null) return Response.json({ ok: true, ignored: 'instancia sin workspace' });");
  assert.ok(bot > 0 && ws > 0 && bot < ws, 'una línea sin workspace devolvía «ignored» antes de llegar al bot');
  // Lo que cuida: el filtro de los chats del bot deja afuera los grupos. Se mira la sentencia, no la línea copiada: el 4/11/2026 se le sumó
  // que el mensaje de una verificación por WhatsApp no le llegue al bot (`noEsVerificacion`), y la copia literal daba rojo con el código bien.
  const filtro = ruta.slice(ruta.indexOf('const chats = lista.filter('), ruta.indexOf(';', ruta.indexOf('const chats = lista.filter(')));
  assert.ok(filtro.length > 0, 'no encontré el filtro de los chats del bot');
  assert.match(filtro, /!\(\(\(m\?\.key as \{ remoteJid\?: string \} \| undefined\)\?\.remoteJid\) \?\? ''\)\.endsWith\('@g\.us'\)/, 'los grupos le llegan al bot');
  assert.match(ruta, /if \(lineaPuedeSerDelBot\(instance\)\) \{/, 'una línea de negocio no tiene por qué leer los settings en cada mensaje');
});

test('el envío vive en una sola pieza: el bot no llama a Evolution por su cuenta', () => {
  const bot = readFileSync(join(RAIZ, 'lib/mako-bot.ts'), 'utf8');
  assert.doesNotMatch(bot, /\/message\/send|sendText|enviarTexto\(|enviarAGrupoJid/);
});
