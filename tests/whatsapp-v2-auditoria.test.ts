// EL WHATSAPP DEL ONBOARDING V2 CONTRA LA MAQUETA: lo que quedaba de la auditoría del 20/11/2026 (el tramo «whatsapp», lado servidor).
//
//   wa-f2  el código llega en dos grupos («482 913»), como la maqueta.
//   wa-09  el pedido de guardar el contacto va pegado al código: solo, era el mismo texto para todos y el tope de «el mismo texto a
//          muchos» lo frenaba desde la sexta persona en una hora (y el error se descartaba).
//   wa-05  con la línea caída, el V2 no promete «lo resuelves después» (el WhatsApp es obligatorio).
//   wa-14  los errores del número son los de la maqueta y dicen qué hacer.
//   wa-04  el pedido desde otro número: MaKo contesta qué hacer y, si una sola verificación espera, se le anota `otroNumero`.
//   wa-f3  «Reenviar el código» escribe directo sólo dentro de las 24 horas del último mensaje de ella.
//   wa-15  un negocio del V2 no arma grupo al guardar sus números en Notificaciones.
//   wa-f4  los links del reto van al número publicado de MaKo, no al guardado en la verificación.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   W1 el código otra vez pegado                                → falla «el código en dos grupos»
//   W2 el pedido de guardar el contacto otra vez aparte         → falla «el código en dos grupos»
//   W3 pedirConfirmacionV2 con el MAKO_SIN_LINEA de antes       → falla «la línea caída»
//   W4 «Reenviar» sin mirar cuándo escribió                    → falla «Reenviar»
//   W5 la única que espera, contando también las vencidas       → falla «otro número»
//   W6 el «otro número» contesta en cualquier línea             → falla «otro número»
//   W7 setNumeroDuenoYSync arma el grupo a un negocio del V2   → falla «sin grupo»
//   W8 el link del reto vuelve a `numeroLinea`                  → falla «el número publicado»
//   O1 «Usar el +…» sin la ventana de 24 h                      → falla «Usar el +54…»
//   O2 el otro número sin la hora en que llegó                  → falla «Usar el +54…»
//   O3 se manda el código antes de guardarlo contestado         → falla «Usar el +54…»
//   O4 si no sale, queda «contestada» igual                     → falla «Usar el +54…»
//   O5 la ruta no pasa la hora del mensaje que llegó            → falla «Usar el +54…» (y el test de la tarjeta)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENDAR_V2, E_REESCRIBIR_V2, E_TEL_CORTO, E_TEL_NO_WA, MAKO_SIN_LINEA_V2, VENTANA_REENVIAR_MS, codigoEnGrupos, errorDelTelefono,
  escribioDesdeElOtro, mensajeDelCodigoV2, mensajeDelCodigoYAgendarV2, reenviarDirecto, respuestaOtroNumeroV2, unicaEsperandoV2, type EstadoVerificacion,
} from '../lib/verificacion-entrante';
import { codigoDeLoEscrito } from '../lib/onboarding-arranque';
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

test('«Reenviar el código»: directo dentro de las 24 horas de su mensaje; después, que escriba ella (wa-f3)', () => {
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  assert.equal(reenviarDirecto({ escribioAt: ahora - 2 * 3_600_000 }, ahora), true, 'el caso de Martín: volvió una hora después');
  assert.equal(reenviarDirecto({ escribioAt: ahora - VENTANA_REENVIAR_MS - 1 }, ahora), false);
  assert.equal(reenviarDirecto({}, ahora), true, 'una verificación de antes de la marca, como antes');
  const reenviar = bloque(grupo(), 'export async function reenviarCodigoV2(', 'export async function verificarCodigoV2(');
  const mira = reenviar.indexOf('if (!reenviarDirecto(v, Date.now())) return { ok: false, error: E_REESCRIBIR_V2 };');
  assert.ok(mira > 0 && mira < reenviar.indexOf('await mandarCodigoV2('), 'mira antes de mandar');
  assert.match(E_REESCRIBIR_V2, /Abrir WhatsApp/);
  const responder = bloque(grupo(), 'export async function responderPedidoV2(', 'export async function reenviarCodigoV2(');
  assert.match(responder, /respondido: true, escribioAt: Date\.now\(\), otroNumero: undefined \}/, 'anota cuándo escribió, y borra un «otro número» viejo');
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
  assert.match(pedir.slice(manda), /await guardarVerificacion\(ws, nueva\);\n  return \{ ok: true, yaVerificado: false, link, numeroLinea: linea\.numero, contestado: false \};/, 'si no sale, vuelve a «esperando»: que escriba');
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
