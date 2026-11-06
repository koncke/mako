// =============================================================================
// Ops Center 2.1 — lo que le faltaba a Chats: enviar, contestar, agregar al CRM y marcar leído (21/10/2026)
// =============================================================================
// docs/ops-center-principal.md §5, Ola 2, 2.1: «Las operaciones que le faltan a Chats, con confirmación en la tarjeta:
// enviar_borrador_whatsapp, contestar_dm, contestar_email_chat, agregar_contacto_al_crm y marcar_leido_chat». Con la
// D3a (Martín, 21/10/2026): el toque en «Enviar» de la tarjeta ES la aprobación del mensaje al lead. Acá se fija:
//   1. el TURNO REAL de la app (`clasificarIntencion` → `herramientasDelChat`, sin modelo). ⚠️ PENDIENTE de la 1.2
//      (rama `mako-wa`): en main el chat de la app clasifica estos pedidos «capturar» y no trae herramientas. Corre con
//      el clasificador real y queda `todo` hasta que la 1.2 llegue: entonces se saca el `todo` y tiene que dar verde;
//   2. la TARJETA: los tres envíos SÓLO por la app (decisión del 21/10: el «sí» escrito de WhatsApp no alcanza para
//      mandarle algo a un lead), y ningún turno de WhatsApp los recibe; el botón dice lo que hace;
//   3. la RED GRATIS no las recibe: son de clientes;
//   4. el texto: lo que sale es lo que la tarjeta muestra ENTERO; «sí, dale» no es el mensaje, pero «contéstale que sí»
//      manda «Sí»; el canal lo decide la cosa nombrada (mail → email); la clave del DM es estable;
//   5. las puertas: WhatsApp por la cola (el borrador no se saltea, y el bloqueo se mira en la puerta), DM y email por
//      las funciones del compositor de /chats, el alta por el mismo criterio; el resultado no dice «no salió» si salió.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, la segunda versión, tras la revisión), con el archivo en 5 / 0 (+1 todo de la 1.2):
//   · `enviar_borrador_whatsapp` también por el grupo de WhatsApp                       → 3 / 2
//   · el tope de WhatsApp en 4.000 (la tarjeta muestra 2.000)                           → 4 / 1
//   · toda respuesta corta rechazada («contéstale que sí» no podía mandar «Sí»)         → 4 / 1
//   · el canal nombrado sin frenar («respóndele el mail» como WhatsApp)                 → 4 / 1
//   · el borrador por id sin el texto entero en la tarjeta                              → 4 / 1
//   · el bloqueo fuera de la puerta única (`enviarBorradorPorSuCanal`)                   → 4 / 1
//   · la clave del DM al azar (dos tarjetas iguales, dos DMs)                            → 4 / 1
//   · «salió pero no quedó en el hilo» contado como «no salió»                          → 4 / 1
//   · las palabras de mandar en la rueda compartida con WhatsApp                        → 4 / 1
// Y lo que encontró la tercera revisión (21/10/2026), con el archivo en 8 / 0 (+1 todo), una rotura por vez:
//   · reusar CUALQUIER borrador pendiente con el mismo texto (salía la nota de voz)      → 7 / 1
//   · reusar sin mirar la línea (salía por la otra)                                     → 7 / 1
//   · el bloqueo de la puerta por dígitos EXACTOS (542233550684 no frenaba 2233550684)   → 7 / 1
//   · la tarjeta con los dígitos guardados y no el número al que sale                   → 7 / 1
//   · la bandeja del escritorio cortando en 240                                         → 7 / 1
//   · el canal leído en el texto DICTADO («te mandé el link por mail» frenaba WhatsApp)  → 7 / 1
//   · «mándale» / «contéstale» fuera de lo que sólo acepta («Sí, dale» salía de mensaje) → 6 / 2
//   · un corte por tiempo contado como «no salió»                                       → 7 / 1
//   · el «sí» a un ofrecimiento de DM sin `contestar_dm` (el camino que YA llega en main) → 7 / 1
// Y la cuarta revisión (21/10/2026), con el archivo en 8 / 0 (+1 todo), una rotura por vez (la identidad del bloqueo
// está en tests/bloqueo-identidad.test.ts):
//   · «respóndele sí» sin mandar nada (la orden que abre el pedido no dicta)             → 7 / 1
//   · una hora o un link apagando la guarda del canal (corte en el primer «:»)          → 7 / 1
//   · «Facebook» como tema frenando el WhatsApp (las redes sin «por»)                   → 7 / 1
//   · «fetch failed» contado como «no salió»                                            → 7 / 1
//   · una lista de objetos en la bandeja como «2 elementos»                             → 7 / 1
//   · reusar el borrador de otro país con los mismos 10 dígitos                         → 7 / 1
//   · agregar_contacto_al_crm otra vez por WhatsApp                                     → 7 / 1
// Correr: node --import tsx --test tests/chats-mako-envio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno, llevaDatosDeClientes } from '../lib/doer-herramientas';
import { REGISTRO, type Vista } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { textoDeEnvio, identidadParaEnviar, canalDeDm, canalNombradoNoCoincide, claveDeDm, esEnvioIncierto, estadoTrasFallarEnvio, TOPE_TEXTO_ENVIO } from '../lib/chats-envio-reglas';
import { MAX_TEXTO, lineasDelPayload } from '../lib/inbox-movil-reglas';
import type { IdentidadCanal } from '../lib/chats-tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const NUEVAS = ['enviar_borrador_whatsapp', 'contestar_dm', 'contestar_email_chat', 'agregar_contacto_al_crm', 'marcar_leido_chat'] as const;
const ENVIAN = ['enviar_borrador_whatsapp', 'contestar_dm', 'contestar_email_chat'] as const;

function nombresDeSiempre(): Array<{ name: string }> {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  const nombres = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })) as string[];
  return nombres.map((name) => ({ name }));
}
const DE_SIEMPRE = nombresDeSiempre();
const vistaApp: Vista = { canal: 'app', alcance: 'proponer', ws: 9, rol: 'admin', tabs: null };
const vistaWa: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 9, rol: 'admin', tabs: null };
const turnoApp = (mensaje: string) => herramientasDelChat({ veredicto: clasificarIntencion(mensaje, {}), texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false }).tools.map((x) => x.name);
const turnoWa = (mensaje: string, agendaAbierta: boolean) => herramientasDelTurno({ veredicto: clasificarIntencion(mensaje, {}), texto: mensaje, agendaAbierta, deSiempre: DE_SIEMPRE, vista: vistaWa, hayPendientes: false }).tools.map((x) => x.name);

const CASOS: Array<[string, typeof NUEVAS[number]]> = [
  ['mándale el borrador a Juan', 'enviar_borrador_whatsapp'],
  ['mándale por WhatsApp a Ana: mañana te llamo a las 10', 'enviar_borrador_whatsapp'],
  ['contéstale el DM a Pedro: gracias por escribirnos', 'contestar_dm'],
  ['contéstale a Pedro por Instagram: gracias por escribirnos', 'contestar_dm'],
  ['respóndele el mail a Laura: te mando la propuesta hoy', 'contestar_email_chat'],
  ['respóndele el correo a Laura: te mando la propuesta hoy', 'contestar_email_chat'],
  ['agrega al CRM a la persona de este chat', 'agregar_contacto_al_crm'],
  ['marca como leído el chat de Ana', 'marcar_leido_chat'],
];

test('el turno real de la app: cada pedido llega con su operación', { todo: 'depende de la 1.2 (rama mako-wa): en main el chat de la app clasifica estos pedidos «capturar» y no trae herramientas' }, () => {
  for (const [frase, op] of CASOS) {
    const llegan = turnoApp(frase);
    assert.ok(llegan.includes(op), `«${frase}» no trajo ${op} (llegaron: ${llegan.slice(0, 30).join(', ')})`);
  }
});

test('el «sí» a un ofrecimiento: el camino por el que la 2.1 YA llega a la app en main (tercera revisión)', () => {
  // Sin la 1.2, un pedido directo no trae los envíos; el «sí» a lo que MaKo ofreció, sí: las herramientas salen del
  // OFRECIMIENTO (`contextoDelSi`). Clasificador REAL, sin veredicto armado a mano.
  const oferta = 'Pedro te escribió por Instagram hoy. ¿Quieres que le conteste por DM «gracias por escribirnos»?';
  for (const si of ['sí, dale', 'dale', 'sí, contéstale']) {
    const v = clasificarIntencion(si, { makoPregunto: true });
    assert.equal(v.sigueOfrecimiento, true, `«${si}» sigue al ofrecimiento`);
    const llegan = herramientasDelChat({ veredicto: v, texto: si, contextoDelSi: oferta, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false }).tools.map((x) => x.name);
    assert.ok(llegan.includes('contestar_dm'), `«${si}» a «${oferta}» no trajo contestar_dm`);
    // y el «sí» no es el mensaje: lo que sale es lo que MaKo ofreció
    assert.ok('error' in textoDeEnvio(si, 'instagram', si), `«${si}» sólo acepta`);
  }
});

test('WhatsApp: ningún turno del grupo trae un envío al lead (el «sí» escrito no alcanza)', () => {
  for (const [frase] of CASOS) for (const agenda of [false, true]) {
    const llegan = turnoWa(frase, agenda);
    for (const op of ENVIAN) assert.ok(!llegan.includes(op), `«${frase}» (agenda ${agenda ? 'abierta' : 'cerrada'}) trajo ${op} por WhatsApp`);
  }
  // Y por el registro, para cualquier acción futura del área: lo que no se deshace, sólo con el toque.
  for (const d of REGISTRO.filter((x) => x.area === 'chats' && esAccion(x) && x.reversible === false)) {
    assert.ok(!d.canales.includes('whatsapp'), `«${d.id}» no se deshace y viaja por WhatsApp: un envío al lead se aprueba con un toque`);
  }
});

test('la tarjeta: los envíos sólo por la app, y el botón dice lo que hace', () => {
  for (const id of NUEVAS) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d, `${id} no está en el registro`);
    assert.equal(d.area, 'chats', `${id}: área chats`);
    assert.ok(d.tipo === 'accion' && d.confirmacion === 'chat', `${id}: se confirma tocando la tarjeta del hilo`);
    assert.ok(d.canales.includes('app'), `${id}: va por la app`);
    assert.ok(!d.canales.includes('http'), `${id}: conversaciones de personas no salen por HTTP`);
  }
  // agregar_contacto_al_crm también (cuarta revisión): por WhatsApp viajaba en el «sí» a cualquier ofrecimiento de Chats
  // y sacaba del presupuesto lecturas que producción daba.
  for (const id of [...ENVIAN, 'marcar_leido_chat', 'agregar_contacto_al_crm']) assert.deepEqual(REGISTRO.find((x) => x.id === id)?.canales, ['app'], `${id}: sólo por la app`);
  const boton = (id: string) => REGISTRO.find((x) => x.id === id)?.titulo;
  assert.equal(boton('enviar_borrador_whatsapp'), 'Enviar el WhatsApp', 'el botón de la tarjeta es el título: tocarlo es «Enviar»');
  assert.equal(boton('contestar_dm'), 'Enviar el mensaje directo');
  assert.equal(boton('contestar_email_chat'), 'Enviar el email');
  for (const id of ENVIAN) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d?.tipo === 'accion' && d.reversible === false, `${id}: un mensaje mandado no se desmanda`);
    const texto = d?.parametros.find((p) => p.nombre === 'texto');
    assert.ok(texto?.max != null && texto.max <= MAX_TEXTO, `${id}: el registro acepta más de lo que la tarjeta muestra entero`);
  }
});

test('la red gratis no las recibe: son datos de clientes', () => {
  for (const id of NUEVAS) assert.equal(llevaDatosDeClientes(id), true, `${id} tiene que cortar el turno de la red gratis`);
});

test('el texto: lo que se ve es lo que sale; «sí, dale» no es el mensaje; el canal lo decide la cosa nombrada', () => {
  assert.deepEqual(textoDeEnvio('  Hola Ana, ¿te llamo mañana?  ', 'whatsapp'), { texto: 'Hola Ana, ¿te llamo mañana?' });
  for (const nada of ['', 'sí, dale', 'Dale, mándalo', 'ok', '¡Sí! envíalo ya']) assert.ok('error' in textoDeEnvio(nada, 'whatsapp', nada), `«${nada}» sólo aceptaba: no es el mensaje`);
  assert.ok('error' in textoDeEnvio('Sí', 'whatsapp', 'sí, dale'), 'la persona sólo aceptó: «Sí» no es lo que dictó');
  assert.deepEqual(textoDeEnvio('Sí', 'whatsapp', 'contéstale que sí'), { texto: 'Sí' }, 'una respuesta corta DICTADA se manda');
  assert.deepEqual(textoDeEnvio('Ok, perfecto', 'email', 'respóndele «ok, perfecto»'), { texto: 'Ok, perfecto' });
  assert.ok('texto' in textoDeEnvio('Va mañana a las 10, te espero', 'whatsapp'), 'un mensaje que empieza con «va» es un mensaje');
  assert.equal(TOPE_TEXTO_ENVIO.whatsapp, MAX_TEXTO, 'WhatsApp: hasta lo que la tarjeta muestra entero');
  assert.equal(TOPE_TEXTO_ENVIO.email, MAX_TEXTO, 'email: hasta lo que la tarjeta muestra entero');
  assert.ok('error' in textoDeEnvio('x'.repeat(MAX_TEXTO + 1), 'email'), 'más largo que la tarjeta: se dice, no se corta');
  assert.ok('error' in textoDeEnvio('x'.repeat(1001), 'instagram'), 'Instagram corta en 1.000');

  assert.match(canalNombradoNoCoincide('respóndele el mail a Pedro', 'whatsapp') ?? '', /contestar_email_chat/, 'pidió un email: no es un WhatsApp');
  assert.match(canalNombradoNoCoincide('respondele el correo a Laura', 'whatsapp') ?? '', /contestar_email_chat/);
  assert.match(canalNombradoNoCoincide('contéstale el DM a Ana', 'whatsapp') ?? '', /contestar_dm/);
  assert.match(canalNombradoNoCoincide('mándale un WhatsApp a Juan', 'email') ?? '', /enviar_borrador_whatsapp/);
  assert.equal(canalNombradoNoCoincide('respóndele el mail a Pedro', 'email'), null);
  assert.equal(canalNombradoNoCoincide('contéstale a Pedro', 'whatsapp'), null, 'sin canal nombrado, no frena');
  assert.equal(canalNombradoNoCoincide('pásale por mail o por WhatsApp', 'whatsapp'), null, 'dos canales: no decide la palabra');
  // Cuarta revisión: el «:» de una hora o de un link no corta el pedido; una red es canal cuando es el MEDIO.
  assert.match(canalNombradoNoCoincide('mándale a Juan el link https://cal.com/x por mail', 'whatsapp', 'Hola Juan, te paso el link: https://cal.com/x') ?? '', /contestar_email_chat/);
  assert.match(canalNombradoNoCoincide('mañana a las 9:30 contéstale por mail a Ana que la reunión se mueve', 'whatsapp') ?? '', /contestar_email_chat/);
  assert.equal(canalNombradoNoCoincide('mándale a Juan el link de nuestra página de Facebook', 'whatsapp'), null, 'Facebook es el tema, no el canal');
  assert.match(canalNombradoNoCoincide('contéstale a Pedro en Instagram', 'whatsapp') ?? '', /contestar_dm/);
  // El canal es el del PEDIDO, no el del texto dictado (tercera revisión).
  assert.equal(canalNombradoNoCoincide('contéstale a Pedro: te mandé el link por mail', 'whatsapp', 'Te mandé el link por mail'), null, '«mail» es del mensaje');
  assert.equal(canalNombradoNoCoincide('contéstale a Pedro: te mandé el link por mail', 'whatsapp'), null, 'lo de después del «:» es el mensaje');
  assert.equal(canalNombradoNoCoincide('mándale a Juan «pásame tu correo y te envío la propuesta»', 'whatsapp'), null, 'lo de entre comillas es el mensaje');
  assert.equal(canalNombradoNoCoincide('respóndele a Laura te escribo por WhatsApp mañana', 'email', 'Te escribo por WhatsApp mañana'), null);
  assert.match(canalNombradoNoCoincide('contéstale por IG a Pedro: gracias', 'whatsapp', 'gracias') ?? '', /contestar_dm/, 'IG es un DM');
  assert.match(canalNombradoNoCoincide('contéstale por Facebook a Pedro: gracias', 'email', 'gracias') ?? '', /contestar_dm/);
  // «mándale», «contéstale», «dile»: sólo aceptan; «contéstale que sí» sigue dictando.
  for (const [t, u] of [['Sí, dale', 'sí, mándale'], ['Dale', 'dale, contéstale'], ['Sí', 'sí, respóndele'], ['Ok', 'ok, envíale']]) {
    assert.ok('error' in textoDeEnvio(t, 'whatsapp', u), `«${u}» sólo aceptaba: «${t}» no es el mensaje`);
  }
  assert.deepEqual(textoDeEnvio('Sí', 'whatsapp', 'dale, contéstale que sí'), { texto: 'Sí' });
  // La orden que ABRE el pedido dicta lo que sigue (cuarta revisión): «respóndele sí» manda «Sí».
  for (const [t, u] of [['Sí', 'respóndele sí'], ['Ok', 'contéstale ok'], ['Dale', 'dile dale'], ['Listo', 'mándale listo'], ['Sí', 'respóndele: sí']]) {
    assert.deepEqual(textoDeEnvio(t, 'whatsapp', u), { texto: t }, `«${u}» dicta «${t}»`);
  }
  assert.ok('error' in textoDeEnvio('Ya', 'whatsapp', 'mándale ya'), '«mándale ya» dice cuándo, no qué');
  // Un corte por tiempo no es «no salió».
  for (const e of ['The operation was aborted due to timeout', 'Request timed out', 'AbortError: This operation was aborted', 'fetch failed', 'read ECONNRESET', 'socket hang up']) assert.equal(esEnvioIncierto(e), true, e);
  for (const e of ['Ese número no tiene WhatsApp', 'el contacto está bloqueado', 'connect ECONNREFUSED 10.0.0.1:8080', 'getaddrinfo ENOTFOUND evo', null]) assert.equal(esEnvioIncierto(e), false, String(e));
  // Y el BORRADOR que se cortó por tiempo no vuelve a la bandeja (06/11/2026, el «Sin hacer» de la tercera revisión del
  // 21/10): con «pendiente», el próximo «Enviar» o el envío solo de MaKo lo duplicaba. Probado rompiéndolo (la función
  // devolviendo siempre 'pendiente'; y `enviarBorrador` escribiendo 'pendiente' a mano): base 8 / 0 → 7 / 1 cada una.
  assert.equal(estadoTrasFallarEnvio('The operation was aborted due to timeout'), 'incierto');
  assert.equal(estadoTrasFallarEnvio('read ECONNRESET'), 'incierto');
  assert.equal(estadoTrasFallarEnvio('Ese número no tiene WhatsApp'), 'pendiente', 'lo que seguro no salió se puede volver a mandar');
  assert.equal(estadoTrasFallarEnvio(null), 'pendiente');
  const envio = leer('lib/evolution-envio.ts');
  const cuerpo = envio.slice(envio.indexOf('export async function enviarBorrador('), envio.indexOf('async function enviarMediaDelBorrador('));
  assert.ok(cuerpo.length > 200, 'encontré el cuerpo de enviarBorrador');
  assert.match(cuerpo, /const estado = estadoTrasFallarEnvio\(r\.error\);/, 'enviarBorrador decide el estado con la regla, no a mano');
  assert.match(cuerpo, /update\(estado === 'incierto' \? \{ estado, enviado_at: ahoraISO\(\), enviado_por: porEmail \} : \{ estado \}\)/, 'el «incierto» cuenta para los topes (pudo haber salido)');
  assert.doesNotMatch(cuerpo, /update\(\{ estado: 'pendiente' \}\)/, 'ningún camino lo devuelve a «pendiente» sin preguntar');

  const id = (canal: IdentidadCanal['canal'], o: Partial<IdentidadCanal> = {}): IdentidadCanal => ({ canal, cuenta: null, rotulo: canal, destino: null, ref: `${canal}-ref`, telefono: null, ultimaFecha: null, puedeEscribir: true, motivoNoEscribir: null, bloqueado: false, ...o });
  const wa = identidadParaEnviar([id('whatsapp', { cuenta: 'ventas' }), id('whatsapp', { cuenta: 'soporte' })], 'whatsapp', 'soporte');
  assert.ok('identidad' in wa && wa.identidad.cuenta === 'soporte', 'la línea pedida');
  const cerrada = identidadParaEnviar([id('instagram', { puedeEscribir: false, motivoNoEscribir: 'Ventana de 24 h cerrada' })], 'instagram');
  assert.ok('error' in cerrada && /Ventana de 24 h cerrada/.test(cerrada.error), 'si no se puede, el motivo que ve la persona en /chats');
  const dos = canalDeDm([id('instagram'), id('messenger')]);
  assert.ok('error' in dos && dos.faltan?.includes('canal'), 'Instagram Y Messenger: pregunta por cuál');

  assert.equal(claveDeDm(7, 'Hola', 1000), claveDeDm(7, 'Hola', 1000), 'la misma propuesta, la misma clave: un doble toque sale una vez');
  assert.notEqual(claveDeDm(7, 'Hola', 1000), claveDeDm(7, 'Hola', 2000), 'otro turno, otra clave');
});

test('las puertas: el borrador entero y no bloqueado, DM y email por el camino de /chats, y el resultado honesto', () => {
  const run = leer('lib/api-mako/areas/chats.run.ts');
  const cuerpo = (id: string) => run.slice(run.indexOf(`  ${id}: {`), run.indexOf('\n  },\n', run.indexOf(`  ${id}: {`)));
  const wa = cuerpo('enviar_borrador_whatsapp');
  assert.match(wa, /await enviarBorradorPorSuCanal\(id, /, 'la ÚNICA puerta de envío de un borrador');
  assert.doesNotMatch(wa, /enviarYEspejar|enviarBorrador\(/, 'mandar por WhatsApp sin la cola saltearía el borrador (D3a)');
  assert.match(wa, /await crearBorrador\(\{[^\n]*origen: 'mako'/, 'el texto nuevo entra a la cola de borradores');
  assert.match(wa, /\.\.\.\(b\.texto \? \{ texto: b\.texto \} : \{\}\)/, 'el borrador por id lleva el texto ENTERO a la tarjeta');
  assert.match(wa, /if \(!b\.texto && !b\.adjunto\) return \{ error:/, 'sin texto ni adjunto no se propone');
  assert.match(wa, /if \(b\.texto\.length > TOPE_TEXTO_ENVIO\.whatsapp\) return \{ error:/, 'un borrador más largo que la tarjeta se manda desde Chats');
  assert.match(wa, /if \(await estaBloqueadoEstricto\(b\.telefono\)\) return \{ error:/);
  assert.match(wa, /if \(esEnvioIncierto\(r\.error\)\) return \{ ok: false, resumen: `No sé si salió/, 'WhatsApp: un corte no es «no salió»');
  assert.match(wa, /if \(r\.error === 'el borrador ya no está pendiente'\) return \{ ok: false, resumen: `Ese borrador ya salió o se descartó/, '«no salió» sólo cuando no salió');
  for (const op of ENVIAN) assert.match(cuerpo(op), /canalNombradoNoCoincide\(ctx\.mensajeUsuario, /, `${op}: el canal lo decide la cosa nombrada`);
  const camino = leer('lib/borrador-camino.ts');
  assert.match(camino, /if \(await estaBloqueadoEstricto\(b\.telefono\)\) return \{ ok: false, error: 'el contacto está bloqueado' \};/, 'el bloqueo, en la puerta de /chats, /whatsapp y MaKo');
  assert.match(cuerpo('contestar_dm'), /idem: claveDeDm\(Number\(i\.identidad\.ref\), t\.texto, ctx\.turnStart\)/);
  assert.match(cuerpo('contestar_dm'), /await enviarManualSocial\(\{ convId: Number\(payload\.convId\), texto: String\(payload\.texto \?\? ''\), idempotencia:/);
  const email = cuerpo('contestar_email_chat');
  assert.match(email, /await enviarEmailDeChat\(\{/);
  assert.match(email, /if \(\/\^Salió\/\.test\(r\.error\)\) return \{ ok: true,/, 'salió pero no quedó en el hilo: salió');
  assert.match(email, /if \(esEnvioIncierto\(r\.error\)\) return \{ ok: false, resumen: `No sé si salió/, 'email: un corte no es «no salió»');
  const alta = cuerpo('agregar_contacto_al_crm');
  assert.match(alta, /crearLeadDeConversacionSocial\(Number\(payload\.convId\), funnelId\)/);
  assert.match(alta, /origen_lead: ORIGEN_LEAD\.chat_whatsapp\.id, funnel_id: destino\.casa/, 'el mismo origen y la misma casa que «Agregar al CRM» de /chats');
  assert.match(cuerpo('marcar_leido_chat'), /const yo = await usuarioDe\(ctx\);[\s\S]*marcarChatLeido\(String\(payload\.clave \?\? ''\), yo\.id\)/, 'el leído de QUIEN confirma');
  const regex = leer('lib/mako-intencion.ts').match(/^  chats: \/.*$/m)?.[0] ?? '';
  assert.doesNotMatch(regex, /borrador|cont\[e|resp\[o|al crm/, 'las palabras de mandar no van en la rueda compartida con WhatsApp: son de la app (la 1.2)');
});

test('ejecutando (tests/_chats-envio-hijo.ts): qué borrador sale, el bloqueo en cualquier forma, el número con país', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_chats-envio-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 });
  const r = JSON.parse(salida);
  assert.equal(r.error, undefined, r.error);
  // El texto nuevo reusa SÓLO un borrador de texto de su misma línea.
  assert.equal(r.reuso.conTexto.elegido, r.reuso.conTexto.esperado, 'ni la nota de voz, ni el archivo, ni el de otra línea: el de texto');
  assert.deepEqual(r.reuso.conTexto.creados, [], 'había uno igual: no apila otro');
  assert.equal(r.reuso.sinTexto.creados.length, 1, 'sin uno de texto de su línea, crea uno');
  assert.deepEqual(r.reuso.sinTexto.creados[0], { id: r.reuso.sinTexto.elegido, instance_name: null, audio_id: null, origen: 'mako' }, 'y sale ése, sin audio');
  assert.equal(r.reuso.otraLinea.elegido, r.reuso.otraLinea.esperado, 'con la línea 2 pedida, el de la línea 2');
  assert.equal(r.reuso.otroPais.creados.length, 1, 'el borrador de +1 551 234 5678 no es el de +52 1 55 1234 5678: se crea otro');
  assert.equal(r.reuso.mismoMexico.elegido, r.reuso.mismoMexico.esperado, 'el 521 y el 52 son la misma persona: se reusa');
  assert.deepEqual(r.reuso.mismoMexico.creados, []);
  // La puerta única: el bloqueo en las dos formas del número.
  for (const k of ['bloqueoConPais', 'bloqueoCon9', 'bloqueoLocal']) assert.deepEqual(r.puerta[k], { ok: false, error: 'el contacto está bloqueado' }, k);
  assert.notEqual(r.puerta.otroNumero.error, 'el contacto está bloqueado', 'otro número no está bloqueado');
  // La tarjeta: el número al que sale, con el país de la línea.
  for (const k of ['local', 'conPais']) {
    assert.equal(r.tarjeta[k].payload?.numero, '+542233550684', `${k}: el número al que sale`);
    assert.match(r.tarjeta[k].resumen, /\+542233550684/);
  }
  assert.match(r.tarjeta.bloqueado.error ?? '', /bloqueado/, 'bloqueado con 549…: no se propone');
});

test('las otras puertas de confirmación muestran ENTERO lo que sale: la bandeja del escritorio (tercera revisión)', () => {
  const b = leer('app/mako/pendientes/BandejaPendientes.tsx');
  assert.match(b, /const lineas = lineasDelPayload\(payload\);/, 'la bandeja pinta con las mismas líneas que la tarjeta y el teléfono');
  assert.doesNotMatch(b, /MAX_VALOR|\.slice\(0, \d+\)/, 'lo que se aprueba no se recorta');
  // Una lista de objetos: una fila por elemento, legible (cuarta revisión: era «Cambios: 2 elementos» y se confirmaba sin
  // ver qué texto entraba en el diseño).
  assert.deepEqual(lineasDelPayload({ disenoId: 3, cambios: [{ de: 'Oferta 50% OFF', a: 'Oferta 70% OFF' }, { de: 'Hoy', a: 'Mañana' }] }), [
    { rotulo: 'Cambios 1', valor: 'De: Oferta 50% OFF · A: Oferta 70% OFF' },
    { rotulo: 'Cambios 2', valor: 'De: Hoy · A: Mañana' },
  ]);
  const largo = 'a'.repeat(MAX_TEXTO - 3) + 'FIN';
  assert.equal(lineasDelPayload({ borradorId: 4, numero: '+542233550684', texto: largo }).find((l) => l.valor.endsWith('FIN'))?.valor.length, MAX_TEXTO, 'el texto entero, hasta el final');
});
