// EL WHATSAPP DEL ONBOARDING V2 CONTRA LA MAQUETA: lo que quedaba de la auditoría del 20/11/2026 (el tramo «whatsapp», lado servidor).
//
//   wa-f2  el código llega en dos grupos («482 913»), como la maqueta.
//   wa-09  el pedido de guardar el contacto va pegado al código: solo, era el mismo texto para todos y el tope de «el mismo texto a
//          muchos» lo frenaba desde la sexta persona en una hora (y el error se descartaba).
//   wa-05  con la línea caída, el V2 no promete «lo resuelves después» (el WhatsApp es obligatorio).
//   wa-14  los errores del número son los de la maqueta y dicen qué hacer.
//   wa-04  el pedido desde otro número: MaKo contesta qué hacer y, si una sola verificación espera, se le anota `otroNumero`.
//   wa-f3  «Reenviar el código» abre SIEMPRE WhatsApp con el pedido escrito (el Cerebro, 20/11 a la tarde): no manda nada.
//   wa-15  un negocio del V2 no arma grupo al guardar sus números en Notificaciones.
//   wa-f4  los links del reto van al número publicado de MaKo, no al guardado en la verificación.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   W1 el código otra vez pegado                                → falla «el código en dos grupos»
//   W2 el pedido de guardar el contacto otra vez aparte         → falla «el código en dos grupos»
//   W3 pedirConfirmacionV2 con el MAKO_SIN_LINEA de antes       → falla «la línea caída»
//   W4 «Reenviar» vuelve a mandar el código directo             → falla «Reenviar»
//   W5 la única que espera, contando también las vencidas       → falla «otro número»
//   W6 el «otro número» contesta en cualquier línea             → falla «otro número»
//   W7 setNumeroDuenoYSync arma el grupo a un negocio del V2   → falla «sin grupo»
//   W8 el link del reto vuelve a `numeroLinea`                  → falla «el número publicado»
//   O1 «Usar el +…» sin la ventana de 24 h                      → falla «Usar el +54…»
//   O2 el otro número sin la hora en que llegó                  → falla «Usar el +54…»
//   O3 se manda el código antes de guardarlo contestado         → falla «Usar el +54…»
//   O4 si no sale, queda «contestada» igual                     → falla «Usar el +54…»
//   O5 la ruta no pasa la hora del mensaje que llegó            → falla «Usar el +54…» (y el test de la tarjeta)
// La verificación independiente del Cerebro (20/11, tarde): wa-12 con la caja vacía y wa-04 cuando MaKo no pudo contestar.
//   L1 la caja vacía vuelve a «Faltan números»                 → falla «la caja vacía»
//   L2 la caja vacía dice «Todavía no…» aunque ya lo mandó      → falla «la caja vacía»
//   L3 la ruta otra vez sin la caja vacía (`texto &&`, `> 0`)    → falla «la caja vacía»
//   L4 el aviso sigue después de que MaKo contestó             → falla «no pudo contestar»
//   L5 la vista sin el aviso                                   → falla «no pudo contestar»
//   L6 la línea no manda y no se anota `sinLineaAt`             → falla «no pudo contestar»
//   L7 «Usar el +…» no sale y no se anota                      → falla «no pudo contestar»
//   L8 el @lid sin número no se cuenta                         → falla «no pudo contestar»
//   L9 el @lid sin número se anota sin ver si espera UNA        → falla «no pudo contestar»
//   L10 la cuenta suma dos veces el mismo mensaje               → falla «no pudo contestar»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENDAR_V2, AVISO_SIN_LINEA_V2, AVISO_SIN_NUMERO_V2, E_CODIGO_LARGO_V2, E_ESCRIBE_CODIGO_V2, E_SIN_CODIGO_V2, KEY_LID_SIN_NUMERO,
  avisoDelPedidoV2, decidirCodigoV2, sumarLidSinNumero, vistaDeEntrante,
  E_REESCRIBIR_V2, E_TEL_CORTO, E_TEL_NO_WA, MAKO_SIN_LINEA_V2, VENTANA_REENVIAR_MS, codigoEnGrupos, errorDelTelefono,
  escribioDesdeElOtro, mensajeDelCodigoV2, mensajeDelCodigoYAgendarV2, reenviarDirecto, respuestaOtroNumeroV2, unicaEsperandoV2, type EstadoVerificacion,
} from '../lib/verificacion-entrante';
import { codigoDeLoEscrito, reenviarAbreWhatsapp } from '../lib/onboarding-arranque';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}
const grupo = () => fuenteSinComentarios('lib/mako-grupo.ts');

test('el código en dos grupos, y el pedido de guardar el contacto pegado a él (wa-f2, wa-09)', () => {
  assert.equal(codigoEnGrupos('482913'), '482 913');
  assert.equal(codigoEnGrupos('48291'), '48291', 'lo que no son 6 números queda igual');
  assert.equal(mensajeDelCodigoV2('Valentina', '482913'), 'Hola Valentina, soy MaKo.\nTu código para confirmar tu WhatsApp es 482 913.');
  const m = mensajeDelCodigoYAgendarV2('Valentina', '482913');
  assert.ok(m.startsWith(mensajeDelCodigoV2('Valentina', '482913')) && m.endsWith(AGENDAR_V2));
  assert.notEqual(mensajeDelCodigoYAgendarV2('Ana', '111111'), mensajeDelCodigoYAgendarV2('Ana', '222222'), 'cada uno es distinto: no lo frena el tope');
  // Lo pegado del mensaje (el código con el espacio, o el mensaje entero) queda en sus 6 números en el campo de la app.
  assert.equal(codigoDeLoEscrito('482 913'), '482913');
  assert.equal(codigoDeLoEscrito(mensajeDelCodigoYAgendarV2('Valentina', '482913')), '482913');
  assert.ok(fuenteSinComentarios('app/onboarding/ChatArranqueV2.tsx').includes('codigoDeLoEscrito(e.target.value)'), 'el campo limpia lo pegado');
  const mandar = bloque(grupo(), 'async function mandarCodigoV2(', 'export async function responderPedidoV2(');
  assert.match(mandar, /enviarAPersonaMaKo\(destino, mensajeDelCodigoYAgendarV2\(v\.nombre \?\? '', v\.codigo\)\)/);
  assert.doesNotMatch(mandar, /AGENDAR_V2/, 'el pedido aparte vuelve a chocar con el tope del mismo texto');
});

test('la línea caída, sin «lo resuelves después»; los errores del número dicen qué hacer (wa-05, wa-14)', () => {
  assert.doesNotMatch(MAKO_SIN_LINEA_V2, /después|pendiente/);
  assert.match(MAKO_SIN_LINEA_V2, /de nuestro lado/);
  const pedir = bloque(grupo(), 'export async function pedirConfirmacionV2(', 'async function mandarCodigoV2(');
  const reenviar = bloque(grupo(), 'export async function reenviarCodigoV2(', 'export async function verificarCodigoV2(');
  for (const [b, nombre] of [[pedir, 'pedirConfirmacionV2'], [reenviar, 'reenviarCodigoV2']] as const) {
    assert.doesNotMatch(b, /MAKO_SIN_LINEA\b(?!_V2)/, `${nombre} con el texto de antes`);
  }
  assert.equal(errorDelTelefono('1155'), E_TEL_CORTO);
  assert.equal(errorDelTelefono('5491155550101'), null);
  assert.equal(errorDelTelefono('54911555501019999'), E_TEL_NO_WA);
  assert.match(E_TEL_CORTO, /Revísalo y toca «Seguir»/);
  assert.match(pedir, /const malo = errorDelTelefono\(num\);\n  if \(malo\) return \{ ok: false, error: malo \};/);
  assert.doesNotMatch(pedir, /El número no es válido/);
  assert.match(fuenteSinComentarios('app/api/onboarding/arranque/route.ts'), /const malo = errorDelTelefono\(digitos\);\n\s+if \(malo\) return no\(422, malo\);/);
});

test('«Reenviar el código» abre SIEMPRE WhatsApp: no manda nada, tampoco dentro de las 24 horas (wa-f3, el Cerebro, 20/11 a la tarde)', () => {
  const reenviar = bloque(grupo(), 'export async function reenviarCodigoV2(', 'export async function verificarCodigoV2(');
  assert.ok(reenviar.includes('if (v?.verificado) return { ok: true };\n  return { ok: false, error: E_REESCRIBIR_V2 };\n}'), 'sin confirmar, siempre E_REESCRIBIR_V2');
  assert.doesNotMatch(reenviar, /mandarCodigoV2|enviarAPersonaMaKo|reenviarDirecto/, 'volvió a mandar el código directo');
  assert.equal(reenviarAbreWhatsapp(E_REESCRIBIR_V2), true, 'con eso la tarjeta abre WhatsApp con el pedido escrito');
  assert.match(E_REESCRIBIR_V2, /Abrir WhatsApp/);
  // La ventana de 24 h queda para «Usar el +…»: un mensaje suyo que YA llegó (el test de abajo).
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  assert.equal(reenviarDirecto({ escribioAt: ahora - 2 * 3_600_000 }, ahora), true);
  assert.equal(reenviarDirecto({ escribioAt: ahora - VENTANA_REENVIAR_MS - 1 }, ahora), false);
  assert.equal(reenviarDirecto({}, ahora), true, 'una verificación de antes de la marca, como antes');
  const responder = bloque(grupo(), 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.match(responder, /respondido: true, escribioAt: Date\.now\(\), otroNumero: undefined, sinLineaAt: undefined, sinNumeroAt: undefined \}/, 'anota cuándo escribió, y borra un «otro número» y los avisos viejos');
});

test('el pedido desde otro número: MaKo contesta qué hacer, sólo en la línea que recibe (wa-04)', () => {
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  const v = (x: Partial<EstadoVerificacion>): EstadoVerificacion => ({
    telefono: '5491155550101', codigo: '123456', expira: ahora + 600_000, verificado: false, entrante: true, v2: true, linea: 'mako_l1', ...x,
  });
  const fila = (ws: number, x: Partial<EstadoVerificacion>) => ({ workspace_id: ws, value: '', v: v(x) });
  assert.equal(unicaEsperandoV2([fila(3, {})], 'mako_l1', ahora)?.workspace_id, 3);
  assert.equal(unicaEsperandoV2([fila(3, {}), fila(9, {})], 'mako_l1', ahora), null, 'con dos no se sabe de quién es');
  assert.equal(unicaEsperandoV2([fila(3, {}), fila(9, { expira: ahora - 1 })], 'mako_l1', ahora)?.workspace_id, 3, 'la vencida no cuenta');
  assert.equal(unicaEsperandoV2([fila(3, {}), fila(9, { verificado: true })], 'mako_l1', ahora)?.workspace_id, 3);
  assert.equal(unicaEsperandoV2([fila(3, { linea: 'mako_otra' })], 'mako_l1', ahora), null, 'la de otra línea no');
  assert.match(respuestaOtroNumeroV2('5491166660202'), /^Me escribiste desde \+5491166660202, pero en MaKo pusiste otro número\..*«Usar el \+5491166660202» en MaKo y te mando el código aquí/);
  const responder = bloque(grupo(), 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  const tras = responder.slice(responder.indexOf("if (d === 'ya-verificado')"));
  assert.match(tras, /if \(instancia !== \(await instanciaVoz\(\)\)\) return null;/, 'contesta sólo la línea que recibe');
  const yaConfirmo = tras.indexOf('const ya = await yaConfirmoV2(tel);');
  const contesta = tras.indexOf('respuestaOtroNumeroV2(tel)');
  assert.ok(yaConfirmo > 0 && contesta > yaConfirmo, 'a quien ya confirmó no le dice «otro número»');
  assert.match(tras, /const suya = unicaEsperandoV2\(filas, instancia, Date\.now\(\)\);/);
  assert.match(tras, /cambiarSettingSi\(KEY_VERIFICACION, suya\.value, JSON\.stringify\(\{ \.\.\.suya\.v!, otroNumero: tel, otroNumeroAt: Date\.now\(\) \}\)\)/);
});

test('«Usar el +54…»: con el mensaje que YA llegó de ese número, MaKo le contesta el código ahí mismo (dentro de las 24 h)', () => {
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  const v: EstadoVerificacion = {
    telefono: '5491155550101', codigo: '123456', expira: ahora + 600_000, verificado: false, entrante: true, v2: true,
    otroNumero: '5491166660202', otroNumeroAt: ahora - 3_600_000,
  };
  assert.deepEqual(escribioDesdeElOtro(v, ahora), { telefono: '5491166660202', escribioAt: ahora - 3_600_000 });
  assert.equal(escribioDesdeElOtro({ ...v, otroNumeroAt: ahora - VENTANA_REENVIAR_MS - 1 }, ahora), null, 'pasadas las 24 h, que vuelva a escribir');
  assert.equal(escribioDesdeElOtro({ ...v, otroNumeroAt: undefined }, ahora), null, 'sin la marca (de antes), como antes');
  assert.equal(escribioDesdeElOtro({ ...v, verificado: true }, ahora), null);
  assert.equal(escribioDesdeElOtro({ ...v, v2: undefined }, ahora), null);
  const g = grupo();
  const responder = bloque(g, 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.match(responder, /JSON\.stringify\(\{ \.\.\.suya\.v!, otroNumero: tel, otroNumeroAt: Date\.now\(\) \}\)/, 'anota CUÁNDO llegó del otro número');
  const pedir = bloque(g, 'export async function pedirConfirmacionV2(', 'async function mandarCodigoV2(');
  const guarda = pedir.indexOf('const contestada: EstadoVerificacion = { ...nueva, respondido: true, escribioAt: opts.escribioAt };\n  await guardarVerificacion(ws, contestada);');
  const manda = pedir.indexOf('const r = await mandarCodigoV2(contestada, num);');
  assert.ok(guarda > 0 && manda > guarda, 'se guarda contestada y DESPUÉS se manda: el código que llega es el que la app espera');
  assert.match(pedir, /if \(opts\.escribioAt == null \|\| !reenviarDirecto\(\{ escribioAt: opts\.escribioAt \}, Date\.now\(\)\)\) \{/, 'fuera de las 24 h, el pedido de siempre');
  assert.match(pedir.slice(manda), /await guardarVerificacion\(ws, \{ \.\.\.nueva, sinLineaAt: Date\.now\(\) \}\);\n  return \{ ok: true, yaVerificado: false, link, numeroLinea: linea\.numero, contestado: false \};/, 'si no sale, vuelve a «esperando»: que escriba');
  const r = fuenteSinComentarios('app/api/onboarding/arranque/route.ts');
  const caso = bloque(r, "case 'usar-otro-numero': {", "case 'reenviar':");
  const lee = caso.indexOf('const llego = await otroNumeroQueEscribioV2(g.ws);');
  assert.ok(lee > 0 && lee < caso.indexOf('await guardarEstadoArranque({ telefono: undefined'), 'lo lee ANTES de rehacer el pedido, que lo pisa');
  assert.match(caso, /pedirCodigo\(e2, h2, await hechosConfirmados\(h2\), otro, llego\?\.telefono === otro \? llego\.escribioAt : undefined\)/);
  assert.match(r, /pedirConfirmacionV2\(g\.ws, digitos, e\.nombre \? primerNombre\(e\.nombre\) : '', \{ escribioAt \}\)/);
  assert.match(r, /return listo\(contestado \? \{ aviso: 'Te mandé el código a ese WhatsApp\.' \} : \{\}\);/);
});

test('un negocio del V2 no arma grupo al guardar sus números (wa-15)', () => {
  const sync = bloque(grupo(), 'export async function setNumeroDuenoYSync(', '\n}\n');
  const v2 = sync.indexOf('if (await esNegocioDelV2(ws)) return { ok: true, accion: \'sin_cambios\' };');
  assert.ok(v2 > 0 && v2 < sync.indexOf('asegurarGrupoMaKo('), 'mira el V2 antes de armar el grupo');
  const dest = fuenteSinComentarios('lib/notif-destinatarios.ts');
  const corta = dest.indexOf("if (!teniaGrupo && (await esNegocioDelV2(ws))) return { ok: true, destinatarios: dest, grupo: 'sin_cambios' };");
  assert.ok(corta > 0 && corta < dest.indexOf('agregarParticipanteGrupo(ws, t)'), 'ni suma a los demás a un grupo que no existe');
});

test('los links del reto, al número publicado de MaKo (wa-f4)', () => {
  const r = fuenteSinComentarios('app/api/reto/route.ts');
  assert.match(r, /async function linea\(\): Promise<string \| null> \{\n  return WHATSAPP_MAKO\.numero;\n\}/);
  assert.doesNotMatch(r, /numeroLinea/);
});

test('la caja vacía: sin el código mandado, «Todavía no tienes el código…»; con el código en su WhatsApp, que lo escriba (wa-12)', () => {
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  const v: EstadoVerificacion = { telefono: '5491155550101', codigo: '482913', expira: ahora + 600_000, verificado: false, entrante: true, v2: true, respondido: false };
  assert.deepEqual(decidirCodigoV2(v, '', ahora), { ok: false, error: E_SIN_CODIGO_V2 }, 'MaKo todavía no le mandó nada');
  assert.equal(E_SIN_CODIGO_V2, 'Todavía no tienes el código: toca «Abrir WhatsApp» y te lo mando.', 'el texto de la maqueta');
  assert.deepEqual(decidirCodigoV2(v, 'hola', ahora), { ok: false, error: E_SIN_CODIGO_V2 }, 'sin números es lo mismo');
  assert.deepEqual(decidirCodigoV2({ ...v, respondido: true }, '', ahora), { ok: false, error: E_ESCRIBE_CODIGO_V2 }, 'ya se lo mandó');
  assert.deepEqual(decidirCodigoV2({ ...v, respondido: true }, '4829', ahora), { ok: false, error: E_CODIGO_LARGO_V2 }, 'incompleto, como antes');
  // La ruta lleva la caja vacía a la verificación (antes caía en «Escribe el código…» aunque MaKo no hubiera mandado nada).
  const r = fuenteSinComentarios('app/api/onboarding/arranque/route.ts');
  // (Desde la verificación de OA-06, 20/11, con `codigoEnLaCaja`: «482 913» como lo manda MaKo. Vacía o sin números va a la
  // verificación con ''; un teléfono, no. tests/onboarding-v2-verificacion.test.ts, 1.)
  assert.ok(r.includes("const codigoEscrito = h.v2 && etapa === 'codigo' && opcion === undefined && texto !== undefined ? (codigoEnLaCaja(texto) ?? (telefonoEscrito(texto) ? null : '')) : null;"));
  assert.ok(r.includes('const r = await verificarCodigoV2(g.ws, codigoEscrito);'), 'la caja vacía va con 0 números');
});

test('su mensaje llegó y MaKo no pudo contestar: la tarjeta lo dice, y los @lid sin número se cuentan (wa-04)', () => {
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  const v: EstadoVerificacion = { telefono: '5491155550101', codigo: '482913', expira: ahora + 600_000, verificado: false, entrante: true, v2: true, respondido: false, linea: 'mako_l1' };
  assert.equal(avisoDelPedidoV2(v), null, 'mientras no pasó nada, nada');
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: ahora }), AVISO_SIN_LINEA_V2);
  assert.equal(avisoDelPedidoV2({ ...v, sinNumeroAt: ahora }), AVISO_SIN_NUMERO_V2);
  assert.equal(avisoDelPedidoV2({ ...v, sinNumeroAt: ahora - 60_000, sinLineaAt: ahora }), AVISO_SIN_LINEA_V2, 'de los dos, el último');
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: ahora - 60_000, sinNumeroAt: ahora }), AVISO_SIN_NUMERO_V2);
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: ahora, respondido: true }), null, 'cuando MaKo le contesta, se va');
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: ahora, verificado: true }), null);
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: ahora, v2: undefined }), null, 'sólo el V2');
  // La vista lo trae SIN cambiar el estado: la tarjeta sigue preguntando cada 4 s ('esperando'), y cuando MaKo contesta el aviso se va.
  const vista = vistaDeEntrante({ ...v, sinLineaAt: ahora }, ahora)!;
  assert.equal(vista.estado, 'esperando');
  assert.equal(vista.aviso, AVISO_SIN_LINEA_V2);
  assert.equal(vistaDeEntrante(v, ahora)!.aviso, null);
  // Dónde se anota: la línea no mandó el código (el webhook y «Usar el +…»), y el @lid sin número con UNA esperando.
  const g = grupo();
  const responder = bloque(g, 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.ok(responder.includes('JSON.stringify({ ...anotado, respondido: false, sinLineaAt: Date.now() })'), 'el webhook: no salió el código');
  assert.ok(bloque(g, 'export async function pedirConfirmacionV2(', 'async function mandarCodigoV2(').includes('await guardarVerificacion(ws, { ...nueva, sinLineaAt: Date.now() });'), '«Usar el +…»: no salió');
  const lid = bloque(responder, 'if (!chat.telefono) {', 'return null;');
  const suya = lid.indexOf('const suya = unicaEsperandoV2(filas, instancia, Date.now());');
  assert.ok(suya > 0 && lid.indexOf('await contarLidSinNumero(String(key.id || chat.jid), !!suya);') > suya, 'se cuenta cada uno');
  assert.ok(lid.includes('if (suya) {\n      await runWithWorkspace(Number(suya.workspace_id), () => cambiarSettingSi(KEY_VERIFICACION, suya.value, JSON.stringify({ ...suya.v!, sinNumeroAt: Date.now() })))'), 'sólo con UNA esperando');
  assert.ok(g.includes('const nueva = sumarLidSinNumero(crudo, id, conUna, Date.now());\n      if (!nueva || (await cambiarSettingSi(KEY_LID_SIN_NUMERO, crudo, JSON.stringify(nueva)))) return;'), 'con compare-and-set');
  // La cuenta: una vez por mensaje (llega por las dos líneas de la cuenta, o Evolution lo reenvía), con los últimos 20 ids.
  assert.equal(KEY_LID_SIN_NUMERO, 'mako.v2.lid_sin_numero');
  const c1 = sumarLidSinNumero(null, 'A1', true, ahora)!;
  assert.deepEqual(c1, { n: 1, conUna: 1, desde: '2026-11-20T15:00:00.000Z', ultimo: '2026-11-20T15:00:00.000Z', ids: ['A1'] });
  assert.equal(sumarLidSinNumero(JSON.stringify(c1), 'A1', true, ahora + 1_000), null, 'el mismo mensaje no suma dos veces');
  const c2 = sumarLidSinNumero(JSON.stringify(c1), 'B2', false, ahora + 60_000)!;
  assert.deepEqual([c2.n, c2.conUna, c2.desde, c2.ultimo], [2, 1, '2026-11-20T15:00:00.000Z', '2026-11-20T15:01:00.000Z']);
  let c: unknown = null;
  for (let i = 0; i < 25; i++) c = sumarLidSinNumero(c, 'M' + i, false, ahora);
  assert.equal((c as { ids: string[] }).ids.length, 20);
  assert.equal((c as { n: number }).n, 25);
});
