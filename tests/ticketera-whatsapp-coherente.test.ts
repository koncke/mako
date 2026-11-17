// =============================================================================
// Lo que dice WhatsApp de un ticket sale del MISMO estado que ve la Ticketera (16/11/2026)
// =============================================================================
// Un cliente, en un audio a Martín: «no existe una constante entre lo que se dice por WhatsApp y lo que dice la Ticketera… en uno
// me dice que el problema está abierto o que ya se envió, y por otro lado en WhatsApp me dice que ya se resolvió». Medido en la base
// ese día (docs/hallazgos-ticketera.md, «WhatsApp y la Ticketera decían cosas distintas»), con los casos de verdad:
//   1. un «ya quedó» que no pasa por el ticket: el aviso de arreglo de un chat con su clave (#30 y #75 de Leandro, 4 h antes del
//      cierre) y un mensaje libre del equipo («el ticket #63 quedó resuelto», dos días antes) → se frenan si el ticket está abierto,
//      y el aviso de arreglo de un ticket del MISMO negocio no sale nunca (su aviso es el del cierre);
//   2. un ticket resuelto sin su aviso: el tope de 3 avisos de arreglo por día dejó sin una línea seis de Leila y dos de Leandro, y
//      los clientes sin la vía libre no recibían nada en su grupo → el aviso del cambio de estado va a SU grupo, sin tope, con el
//      texto de la Ticketera, y el ticket no queda «avisado» si no salió.
// Lo puro se EJECUTA; el cableado (dónde se llama cada freno, en qué orden) se lee del código, sin comentarios.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  avisaEnSuGrupo, daPorResuelto, destinoDelAvisoAlGrupo, frenoDelAvisoDeArreglo, frenoDelMensajeDelEquipo, HORAS_REINTENTO_GRUPO,
  textoDelAviso, ticketsDeLaClave, ticketsDelTexto, type TicketNombrado,
} from '../lib/tickets-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PLATAFORMA = 9;

test('1. qué tickets nombra un texto y la clave de un aviso (con las claves que había en producción)', () => {
  assert.deepEqual(ticketsDelTexto('Leandro, el ticket #63 quedó resuelto.'), [63]);
  assert.deepEqual(ticketsDelTexto('«Borrar silencios» busca en todo el video (tickets #31 y #32).'), [31, 32]);
  assert.deepEqual(ticketsDelTexto('Mauricio, sobre el ajuste de Sprint correos (ticket 78).'), [78]);
  assert.deepEqual(ticketsDelTexto('Lo pasé al equipo de MaKo (pedido #102).'), [102]);
  assert.deepEqual(ticketsDelTexto('Ya quedó arreglado: Chats tardaba mucho en abrir.'), []);
  assert.deepEqual(ticketsDeLaClave('ticket:30'), [30]);
  assert.deepEqual(ticketsDeLaClave('ticket:5-6'), [5, 6]);
  assert.deepEqual(ticketsDeLaClave('ticket-27-hoja-crm-movil'), [27]);
  for (const otra of ['commit:85249b975', 'conv:1456', 'arreglo:calendario-pablo-17oct', 'montaje:run189']) assert.deepEqual(ticketsDeLaClave(otra), [], otra);
});

test('2. qué da algo por resuelto (los textos que salieron a los grupos)', () => {
  for (const si of [
    'Leandro, el ticket #63 quedó resuelto. Confirmado contra los datos',
    'Leandro, cuando cargaste las variantes, la API te dio error. Ya está corregido: el cambio se guarda.',
    'Sí, quedó en la documentación… Ya quedó lo del comentario en Instagram',
    'Arreglamos un error que viste en MaKo: la pantalla «Web Generator» se rompió. Ya anda.',
    'Listo: tu ticket #105 («MaKo no pudo hacer lo que le pidieron») está resuelto.',
  ]) assert.equal(daPorResuelto(si), true, si);
  for (const no of [
    'Tu pedido #78 («Pide enviar hoy el primer correo…») todavía no lo tomó nadie del equipo: sigue en la fila. Cuando esté, te aviso por aquí.',
    'Mauricio, sobre Resend Pro (ticket #87): desde MaKo no se ve el plan de tu cuenta de Resend.',
    'Abrí el ticket #98: Reporta que no puede deshacer un cobro. Lo toma el equipo y te aviso por aquí cuando esté.',
  ]) assert.equal(daPorResuelto(no), false, no);
});

test('3. un mensaje libre del equipo no da por resuelto un ticket que la Ticketera tiene abierto (el #63 de Leandro, 8/11)', () => {
  const texto = 'Leandro, el ticket #63 quedó resuelto. Confirmado contra los datos.';
  const abierto: TicketNombrado[] = [{ id: 63, ws: 10, estado: 'en_curso' }];
  const freno = frenoDelMensajeDelEquipo(texto, 10, abierto);
  assert.ok(freno, 'salió «quedó resuelto» con el ticket en curso: es lo que el cliente reportó');
  assert.match(freno!, /#63 \(«En curso» en la Ticketera\)/, 'el freno no dice qué ticket ni qué dice la Ticketera');
  assert.match(freno!, /tickets-cerrar-resueltos\.mjs/, 'el freno no dice qué hacer');
  assert.equal(frenoDelMensajeDelEquipo(texto, 10, [{ id: 63, ws: 10, estado: 'resuelto' }]), null, 'frena un «resuelto» que es verdad');
  // Lo que no da nada por resuelto sale aunque el ticket esté abierto: el avance de Sprint correos (#78), en curso.
  assert.equal(frenoDelMensajeDelEquipo('Mauricio, cómo salió hoy Sprint correos (ticket #78): 97 enviados.', 1, [{ id: 78, ws: 1, estado: 'esperando_decision' }]), null);
  // Un número de OTRO negocio no es de este grupo: no frena (y `frenoDelEquipoPorTickets` ni lo lee).
  assert.equal(frenoDelMensajeDelEquipo(texto, 10, [{ id: 63, ws: 11, estado: 'en_curso' }]), null);
});

test('4. el aviso de arreglo de un ticket del MISMO negocio no sale nunca: su aviso es el del cierre (#30 y #75 de Leandro)', () => {
  // #30, 30/10: «Sí, quedó en la documentación» por `ticket:30` a las 13:35; el ticket se cerró a las 17:30.
  assert.ok(frenoDelAvisoDeArreglo(10, [30], [{ id: 30, ws: 10, estado: 'en_curso' }]), 'el «ya quedó» del #30 sale con el ticket abierto');
  // Y aunque esté resuelto: sería el SEGUNDO aviso (el cierre ya le mandó el suyo, con lo que dice /tickets).
  assert.match(frenoDelAvisoDeArreglo(10, [30], [{ id: 30, ws: 10, estado: 'resuelto' }]) ?? '', /su aviso sale solo al cerrarlo/);
  // #75, 10/11: «Ya está corregido» con la clave de un commit; el texto nombraba el ticket → frena igual.
  assert.ok(frenoDelAvisoDeArreglo(10, [], [{ id: 75, ws: 10, estado: 'en_curso' }]));
  // El cron, a los OTROS negocios que vieron el mismo error: sale si está resuelto, no si está abierto.
  assert.equal(frenoDelAvisoDeArreglo(10, [7], [{ id: 7, ws: 13, estado: 'resuelto' }]), null, 'frena el aviso a un negocio afectado');
  assert.ok(frenoDelAvisoDeArreglo(10, [7], [{ id: 7, ws: 13, estado: 'en_curso' }]), 'a un negocio afectado le llega «ya anda» de algo abierto');
  assert.match(frenoDelAvisoDeArreglo(10, [999], []) ?? '', /#999, que no existe/);
  assert.equal(frenoDelAvisoDeArreglo(10, [], []), null, 'frena un aviso que no nombra tickets');
});

test('5. el cambio de estado le debe el aviso a SU grupo: todo cliente, por donde lo haya levantado; la plataforma, sólo por WhatsApp', () => {
  // Los ocho que se tragó el tope (Leila ws11 y Leandro ws10, del 29/10 al 4/11), y los clientes sin la vía libre.
  for (const [ws, canal] of [[11, 'chat_app'], [11, 'formulario'], [11, 'sistema'], [10, 'chat_app'], [13, 'chat_app'], [15, 'chat_app'], [24, 'formulario'], [1, 'chat_movil']] as const) {
    assert.equal(avisaEnSuGrupo({ workspace_id: ws, canal }, PLATAFORMA), true, `ws${ws} por ${canal}: «Resuelto» en la Ticketera y nada en su grupo`);
  }
  assert.equal(avisaEnSuGrupo({ workspace_id: PLATAFORMA, canal: 'chat_app' }, PLATAFORMA), false, 'Martín recibe en su grupo los avisos de sus propios tickets');
  assert.equal(avisaEnSuGrupo({ workspace_id: PLATAFORMA, canal: 'whatsapp' }, PLATAFORMA), true);
  assert.equal(avisaEnSuGrupo({ workspace_id: 11, canal: 'chat_app' }, null), true, 'sin saber la plataforma, un cliente se queda sin aviso');
});

test('6. si el grupo no lo recibió, el ticket NO queda avisado (salvo que no tenga grupo, o pasadas las horas de reintento)', () => {
  const t0 = Date.parse('2026-10-29T17:30:00Z');
  assert.equal(destinoDelAvisoAlGrupo({ ok: true }, t0, t0), 'salio');
  assert.equal(destinoDelAvisoAlGrupo({ ok: false, sinGrupo: true }, t0, t0), 'sin_grupo');
  assert.equal(destinoDelAvisoAlGrupo({ ok: false }, t0, t0 + 3600_000), 'reintentar', 'un WhatsApp caído deja el ticket «avisado»');
  assert.equal(destinoDelAvisoAlGrupo({ ok: false }, t0, t0 + (HORAS_REINTENTO_GRUPO + 1) * 3600_000), 'perdido');
  assert.equal(destinoDelAvisoAlGrupo({ ok: false }, Number.NaN, t0), 'reintentar');
});

test('7. el texto del grupo es el de la Ticketera: estado y respuesta del equipo', () => {
  const t = { id: 21, titulo: 'MaKo no pudo hacer lo que le pidieron, en el Ops Center', estado: 'resuelto', respuesta: 'Ya puedes pasar una columna entera a otro funnel.', duplicado_de: null };
  assert.equal(textoDelAviso(t), 'Listo: tu ticket #21 («MaKo no pudo hacer lo que le pidieron, en el Ops Center») está resuelto. Ya puedes pasar una columna entera a otro funnel.');
});

test('8. el cierre: SU grupo primero, sin el tope del aviso de arreglo, y sin marcar «avisado» lo que no salió', () => {
  const c = sinComentarios(leer('lib/tickets-cierre.ts'));
  const fn = c.slice(c.indexOf('async function avisarUno('));
  const grupo = fn.indexOf('if (avisaEnSuGrupo(f, plataforma))');
  const manda = fn.indexOf("enviarAlGrupoMaKo(ws, sanearSalida(texto, { corrioHerramientas: true }).texto, { de: 'equipo', ticket: Number(f.id) })");
  const reintenta = fn.indexOf("if (destino === 'reintentar')");
  const push = fn.indexOf('enviarPushAUsuario(');
  const marca = fn.indexOf('avisado_at: ahora');
  assert.ok(grupo > 0 && manda > grupo, 'el aviso al grupo de su negocio no depende de `avisaEnSuGrupo`');
  assert.ok(reintenta > manda && reintenta < push, 'el reintento no va antes del push: cada vuelta repetiría el push y el chat');
  assert.match(fn.slice(reintenta, reintenta + 200), /return false;/, 'un grupo que falló deja el ticket «avisado»');
  assert.ok(marca > push, 'marca «avisado» antes de intentar');
  assert.equal((fn.match(/enviarAlGrupoMaKo\(/g) ?? []).length, 1, 'hay otro envío al grupo de su ticket por fuera del cambio de estado');
  // El de SU ticket nunca por el aviso de arreglo (el tope de 3 por día): sólo los OTROS negocios de un error del sistema.
  assert.doesNotMatch(fn, /avisarArregloAlGrupo\(\{ ws, /, 'el aviso de SU ticket va por el aviso de arreglo, con su tope');
  assert.match(fn, /const negocios = new Set\(await negociosAfectados\(f\.id\)\);\s*negocios\.delete\(ws\);/, 'su negocio recibe además el «Arreglamos…»');
  assert.match(c, /select\('id, titulo, estado, respuesta, duplicado_de, workspace_id, usuario_id, canal, contexto, updated_at'\)/, 'sin `updated_at` no se sabe cuánto se reintentó');
});

test('9. las puertas del «ya quedó»: el aviso de arreglo, el mensaje libre del equipo y el script de los chats', () => {
  const av = sinComentarios(leer('lib/aviso-arreglo.ts'));
  const fn = av.slice(av.indexOf('export async function avisarArregloAlGrupo'));
  const freno = fn.indexOf('frenoPorTickets(p.ws, clave, t.texto)');
  assert.ok(freno > 0 && freno < fn.indexOf('avisosDelDia(') && freno < fn.indexOf('cambiarSettingSi(key, null,'), 'el aviso de arreglo no mira los tickets antes de reservar');
  assert.match(fn, /if \(freno\) return \{ ok: false, motivo: 'ticket', detalle: freno \};/);
  assert.match(fn, /catch \(e\) \{ return \{ ok: false, motivo: 'base'/, 'sin poder leer los tickets, el aviso sale igual');

  const mg = sinComentarios(leer('lib/mako-grupo.ts'));
  const env = mg.slice(mg.indexOf('export async function enviarAlGrupoMaKo('));
  const fr = env.indexOf('frenoDelEquipoPorTickets(ws, texto)');
  assert.ok(fr > 0 && fr < env.indexOf('copiarAlGrupo(') && fr < env.indexOf('enviarPorWhatsApp('), 'el mensaje del equipo sale antes de mirar sus tickets');
  assert.match(env, /const atadoASuTicket = memoria !== null && typeof memoria === 'object';\s*if \(!atadoASuTicket && \(memoria === 'equipo' \|\| esFirmaDelEquipo\(texto\)\)\)/, 'el freno no cubre lo firmado por el equipo, o frena el aviso del propio ticket');
  assert.match(env, /\.catch\(\(e: unknown\) => \(e instanceof Error \? e\.message : String\(e\)\)\);\s*if \(freno\)/, 'sin poder leer los tickets, el mensaje sale igual');

  const sc = sinComentarios(leer('scripts/avisar-arreglo-al-grupo.mts'));
  const prueba = sc.indexOf('const prueba = pruebaDeProduccion();');
  assert.ok(sc.indexOf('await frenoPorTickets(ws, clave, vista.texto)') > 0 && sc.indexOf('await frenoPorTickets(ws, clave, vista.texto)') < prueba);
  assert.ok(sc.indexOf("!flag('--no-es-de-un-ticket')") > 0 && sc.indexOf("!flag('--no-es-de-un-ticket')") < prueba, 'el script avisa un arreglo sin mirar los tickets abiertos del negocio (el #75)');

  // Cerrar a mano deja el aviso pendiente: el cron lo manda con lo mismo que dice /tickets.
  assert.match(sinComentarios(leer('scripts/tickets-cerrar-resueltos.mjs')), /\{ estado: 'resuelto', resuelto_at: ahora, respuesta: t\.respuesta\.slice\(0, 2000\), avisado_at: null, updated_at: ahora \}/);
});

// PROBADO ROMPIÉNDOLO (16/11/2026, 9 de 9 en verde antes; una rotura por vez, un archivo por rotura, restaurado de una copia). Nueve
// roturas, 1 fallo cada una: el freno del mensaje del equipo que nunca frena (3) · el aviso de arreglo de un ticket propio que sale
// (4) · sólo los de WhatsApp avisan en su grupo, lo de antes (5) · un grupo que falló cuenta como avisado, lo del tope (6) · el cierre
// que marca avisado aunque el grupo falló (8) · su negocio que recibe además el «Arreglamos…» (8) · el aviso de arreglo sin mirar los
// tickets (9) · lo firmado por el equipo sin memoria, sin freno (9) · el script sin mirar los tickets abiertos (9). Restaurado: 9 de 9.
