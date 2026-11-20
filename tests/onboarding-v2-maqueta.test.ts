// =============================================================================
// EL ONBOARDING V2 = LA MAQUETA (19/11/2026)
// =============================================================================
// Martín, probándolo en producción el 19/11: «primero te pide el WhatsApp en lugar de preguntarte cómo te llamas… la criatura… es un
// circulito en lugar de la estrella… está el botón de ahora no… ese onboarding debería ser obligatorio… los mensajes no están
// exactamente igual… mejor que sea [un video] solo, el que aparece al principio… le envié el mensaje a MaKo y me creó un grupo de
// WhatsApp, que eso ya no debería hacerlo… directamente por el chat privado». Lo que fija:
//   1. el orden de la maqueta: nombre → WhatsApp → código → contacto de MaKo → negocio → cómo llegó → qué resolver → cierre; sin
//      «Ahora no» (y un «postergado» de antes no salta el paso);
//   2. los textos, los de la maqueta (cuerpo.html → `T`);
//   3. cómo se leen las respuestas (el nombre sin «¿te llamo así?», el contacto con su segunda pregunta, hasta 3 intereses);
//   4. el WhatsApp: el link lleva el pedido y NUNCA el código; MaKo le contesta con el código al número que dio; el código pegado se
//      revisa (y un tope de intentos);
//   5. el webhook contesta el pedido del V2 y el código pegado NO arma ningún grupo;
//   6. la pantalla: la del V2 sólo con el interruptor; la estrella, la caja del Ops Center, UN video (el de la bienvenida) y la
//      pantalla oscura con MaKo escribiendo.
// Probado rompiéndolo (19/11/2026, una rotura por vez y restaurada): con el WhatsApp antes del nombre cae el 1; con el código en el
// link del V2, el 4. Lo aprendido, en docs/hallazgos-onboarding.md («El onboarding V2 en la app = la maqueta»).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  etapaDeArranque, mensajesDeArranque, leerRespuesta, INTERESES_V2, V2_NOMBRE, V2_TELEFONO, V2_CODIGO, V2_AGENDADO, V2_NEGOCIO, V2_INTERES,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import {
  TEXTO_CONFIRMAR_V2, codigoNumerico, decidirCodigoV2, decidirPedidoV2, esPedidoDeConfirmacion, mensajeDelCodigoV2, vistaDeEntrante,
  E_SIN_CODIGO_V2, E_CODIGO_V2, E_CODIGO_TOPE_V2, TOPE_INTENTOS_V2, type EstadoVerificacion,
} from '../lib/verificacion-entrante';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const H: HechosArranque = { modo: 'oferta', v2: true, nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false };
const TEL = { telefono: 'verificado' as const, telefonoNumero: '+54 9 11 5555 0101' };

test('1. el orden de la maqueta, sin «Ahora no»', () => {
  const pasos: Array<[EstadoArranque, string]> = [
    [{}, 'nombre'],
    [{ nombre: 'Valentina' }, 'telefono'],
    [{ nombre: 'Valentina', telefono: 'postergado' }, 'telefono'],
    [{ nombre: 'Valentina', telefono: 'codigo', telefonoEntrante: true }, 'codigo'],
    [{ nombre: 'Valentina', ...TEL }, 'agendado'],
    [{ nombre: 'Valentina', ...TEL, agendado: 'no' }, 'agendado'],
    [{ nombre: 'Valentina', ...TEL, agendado: 'despues' }, 'negocio'],
    [{ nombre: 'Valentina', ...TEL, agendado: 'si', negocio: 'Nutri Vale' }, 'origen'],
    [{ nombre: 'Valentina', ...TEL, agendado: 'si', negocio: 'Nutri Vale', origen: 'Instagram' }, 'interes'],
    [{ nombre: 'Valentina', ...TEL, agendado: 'si', negocio: 'Nutri Vale', origen: 'Instagram', intereses: ['Armar mi landing'] }, 'cierre'],
  ];
  for (const [e, etapa] of pasos) {
    assert.equal(etapaDeArranque(e, H), etapa, JSON.stringify(e));
    const todo = mensajesDeArranque(e, H);
    assert.equal(todo.despues.length, 0);
    assert.ok(!todo.antes.some((m) => (m.opciones ?? []).includes('Ahora no')), `sin «Ahora no» en ${etapa}`);
  }
  // Sin el V2, el de siempre (el WhatsApp primero): nada cambió para los demás.
  assert.equal(etapaDeArranque({}, { ...H, v2: false }), 'telefono');
});

test('2. los textos de la maqueta, en su orden', () => {
  const e: EstadoArranque = { nombre: 'Valentina', ...TEL, agendado: 'si', negocio: 'Nutri Vale', origen: 'Instagram' };
  const mako = mensajesDeArranque(e, H).antes.filter((m) => m.de === 'mako').map((m) => m.texto);
  // Sin «Soy MaKo» (Martín, 19/11), y el WhatsApp dice A QUÉ NÚMERO va el mensaje: el de MaKo, el del sitio.
  assert.equal(V2_NOMBRE, '¡Hola! Para empezar, ¿cómo te llamas?');
  // Al CHAT PRIVADO de MaKo, no a su grupo (20/11, la llamada con Leila: «Esto es el grupo, ¿verdad?»; tests/whatsapp-codigo-chat-privado).
  assert.match(V2_CODIGO.replace(/\u00a0/g, ' ').replace(/\u2060/g, ''), /mándale el mensaje al chat privado de MaKo \(\+54 9 11 2505-2605\), no a tu grupo/);
  assert.match(V2_CODIGO, /\(\+54\u00a09\u00a011\u00a02505-\u20602605\)/, 'el número, de una pieza: no se corta en dos renglones');
  assert.deepEqual(mako, [V2_NOMBRE, V2_TELEFONO('Valentina'), V2_CODIGO, V2_AGENDADO, V2_NEGOCIO, '¿Cómo llegaste a MaKo, Valentina?', V2_INTERES]);
  assert.equal(V2_TELEFONO('Valentina'), 'Un gusto, Valentina. ¿A qué WhatsApp te escribo con los avisos y los reportes?');
  assert.match(V2_CODIGO, /toca «Abrir WhatsApp» y mándale el mensaje al chat privado de MaKo \([^)]+\), no a tu grupo\. Te contesto con un código y lo pegas aquí abajo\./);
  assert.equal(V2_NEGOCIO, 'Listo, tu WhatsApp quedó confirmado. ¿Cómo se llama tu negocio?');
  // Qué resolver primero: las 11 de la maqueta, hasta 3, en el recuadro.
  const interes = mensajesDeArranque(e, H).antes.at(-1)!;
  assert.equal(interes.opciones?.length, 11);
  assert.deepEqual(interes.recuadro, { tema: 'Qué resolver primero', varias: 3, libre: true, ayuda: 'Elige hasta 3.' });
  // Al terminar: «¡Listo, Valentina! Tu MaKo ya está armado.» con «Entrar a MaKo».
  const listo = mensajesDeArranque({ ...e, intereses: ['Armar mi landing'] }, { ...H, terminado: true }).antes.at(-1)!;
  assert.equal(listo.texto, '¡Listo, Valentina! Tu MaKo ya está armado.');
  assert.equal(listo.tarjeta, 'listo');
});

test('3. cómo se leen las respuestas', () => {
  const ok = (e: EstadoArranque, r: Parameters<typeof leerRespuesta>[2]) => {
    const l = leerRespuesta(e, H, r);
    assert.ok(l.ok, JSON.stringify(l));
    return (l as { patch: Partial<EstadoArranque> }).patch;
  };
  // El nombre, sin «¿te llamo así?».
  assert.equal(ok({}, { texto: 'Me llamo Valentina' }).nombre, 'Valentina');
  // El contacto de MaKo: «No» lleva a la segunda pregunta.
  const base: EstadoArranque = { nombre: 'Valentina', ...TEL };
  assert.equal(ok(base, { opcion: 1, opcionTexto: 'No' }).agendado, 'no');
  assert.equal(ok({ ...base, agendado: 'no' }, { opcion: 0, opcionTexto: 'Ya lo guardé' }).agendado, 'guardado');
  assert.equal(ok({ ...base, agendado: 'no' }, { texto: 'lo hago después' }).agendado, 'despues');
  // Hasta 3 intereses; el cuarto no.
  const conOrigen: EstadoArranque = { ...base, agendado: 'si', negocio: 'Nutri Vale', origen: 'Instagram' };
  const tres = INTERESES_V2.slice(0, 3).map((i) => i.label);
  assert.deepEqual(ok(conOrigen, { opciones: tres }).intereses, tres);
  const cuatro = leerRespuesta(conOrigen, H, { opciones: INTERESES_V2.slice(0, 4).map((i) => i.label) });
  assert.equal(cuatro.ok, false);
  // Escrito con sus palabras, también vale.
  assert.deepEqual(ok(conOrigen, { texto: 'Vender más por Instagram' }).intereses, ['Vender más por Instagram']);
});

const PEDIDO: EstadoVerificacion = {
  telefono: '5491155550101', destino: '5491155550101', nombre: 'Valentina', codigo: '482913', expira: Date.now() + 60_000, verificado: false,
  entrante: true, v2: true, respondido: false, intentos: 0, linea: 'mako', numeroLinea: '5491100000000',
};

test('4. el WhatsApp: el pedido sin el código, MaKo contesta con el código, y el código pegado se revisa', () => {
  // El link lleva el pedido, NUNCA el código (lo que prueba el número es que le llegó a SU WhatsApp).
  const v = vistaDeEntrante(PEDIDO, Date.now())!;
  assert.ok(v.link?.includes(encodeURIComponent(TEXTO_CONFIRMAR_V2)));
  assert.ok(!v.link?.includes(PEDIDO.codigo), 'el código no viaja en el link');
  assert.equal(TEXTO_CONFIRMAR_V2, 'Hola, quiero confirmar mi WhatsApp.');
  assert.ok(esPedidoDeConfirmacion('Hola, quiero confirmar mi WhatsApp.'));
  assert.ok(esPedidoDeConfirmacion('quiero confirmar mi whatsapp'));
  assert.ok(!esPedidoDeConfirmacion('Hola MaKo, ¿cómo estás?'));
  assert.match(codigoNumerico(), /^\d{6}$/);
  // En dos grupos, como la maqueta (20/11/2026, la auditoría wa-f2: decía «482913»).
  assert.equal(mensajeDelCodigoV2('Valentina', '482913'), 'Hola Valentina, soy MaKo.\nTu código para confirmar tu WhatsApp es 482 913.');
  // MaKo contesta sólo al número que dio, por la línea del link, mientras esté vigente.
  const ahora = Date.now();
  assert.equal(decidirPedidoV2(PEDIDO, { instancia: 'mako', telefono: '5491155550101', ahora }), 'responder');
  assert.equal(decidirPedidoV2(PEDIDO, { instancia: 'mako', telefono: '5491166660202', ahora }), 'no-es-este');
  assert.equal(decidirPedidoV2(PEDIDO, { instancia: 'otra', telefono: '5491155550101', ahora }), 'no-es-este');
  // Vencido o con el tope lleno: un código NUEVO, nunca el silencio (19/11/2026, tests/codigo-v2-vencido.test.ts).
  assert.equal(decidirPedidoV2({ ...PEDIDO, expira: ahora - 1 }, { instancia: 'mako', telefono: '5491155550101', ahora }), 'renovar');
  assert.equal(decidirPedidoV2({ ...PEDIDO, intentos: TOPE_INTENTOS_V2 }, { instancia: 'mako', telefono: '5491155550101', ahora }), 'renovar');
  assert.equal(decidirPedidoV2({ ...PEDIDO, v2: undefined }, { instancia: 'mako', telefono: '5491155550101', ahora }), 'no-es-este', 'el flujo de antes no se toca');
  // El código pegado: antes de que MaKo conteste, no; equivocado, suma un intento; al tope, pide otro; el bueno, sí.
  assert.deepEqual(decidirCodigoV2(PEDIDO, '482913', ahora), { ok: false, error: E_SIN_CODIGO_V2 });
  const respondido = { ...PEDIDO, respondido: true };
  assert.deepEqual(decidirCodigoV2(respondido, '111111', ahora), { ok: false, error: E_CODIGO_V2, suma: true });
  // Cada caso, el suyo (Martín, 19/11: «pegué un código incorrecto… me dice: el código tiene 6 números… no tiene sentido»).
  assert.equal(E_CODIGO_V2, 'Ese código no es el que te mandó MaKo. Revísalo en WhatsApp o toca «Reenviar el código».');
  assert.deepEqual(decidirCodigoV2(respondido, '4829', ahora), { ok: false, error: 'Faltan números: el código tiene 6.' }, 'incompleto');
  assert.deepEqual(decidirCodigoV2(respondido, '4829131', ahora), { ok: false, error: E_CODIGO_V2, suma: true }, 'con uno de más es equivocado');
  assert.deepEqual(decidirCodigoV2({ ...respondido, expira: ahora - 1 }, '482913', ahora), { ok: false, error: 'Ese código venció: toca «Reenviar el código».' });
  assert.deepEqual(decidirCodigoV2({ ...respondido, intentos: TOPE_INTENTOS_V2 }, '482913', ahora), { ok: false, error: E_CODIGO_TOPE_V2 });
  assert.deepEqual(decidirCodigoV2(respondido, '482 913', ahora), { ok: true });
});

test('5. el webhook contesta el pedido del V2, y el código pegado NO arma ningún grupo', () => {
  const hook = sinComentarios(leer('app/api/webhooks/evolution/route.ts'));
  assert.match(hook, /const v2 = await responderPedidoV2\(instance, m\)/);
  assert.match(hook, /if \(v2\.responder\) after\(v2\.responder\);/);
  const grupo = sinComentarios(leer('lib/mako-grupo.ts'));
  const verificar = grupo.slice(grupo.indexOf('export async function verificarCodigoV2'), grupo.indexOf('// ── Grupo del SuperAdmin'));
  assert.ok(verificar.length > 100, 'está verificarCodigoV2');
  assert.doesNotMatch(verificar, /sincronizarConfirmado|setNumeroDuenoYSync|asegurarGrupoMaKo|sumarAlGrupo/, 'sin grupo');
  assert.match(verificar, /await guardarNumeroDueno\(ws, num\)/, 'el número del dueño queda guardado');
  const responder = grupo.slice(grupo.indexOf('export async function responderPedidoV2'), grupo.indexOf('export async function reenviarCodigoV2'));
  assert.doesNotMatch(responder, /sincronizarConfirmado|setNumeroDuenoYSync|asegurarGrupoMaKo|sumarAlGrupo|verificado: true/, 'contestar no confirma ni arma grupo');
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /const r = h\.v2\n\s*\? await pedirConfirmacionV2\(g\.ws, digitos,/);
  // 20/11 (OA-06 y su verificación): lo escrito en la caja va a la verificación si es un código (codigoEnLaCaja: «482 913» como lo
  // manda MaKo, o su mensaje pegado); un teléfono o un texto sin números siguen como cualquier respuesta. Vacía también (wa-12: sin
  // código mandado dice E_SIN_CODIGO_V2, tests/whatsapp-v2-auditoria.test.ts, V1). tests/onboarding-v2-verificacion.test.ts, 1.
  assert.match(ruta, /if \(codigoEscrito !== null\) \{\n\s*const r = await verificarCodigoV2\(g\.ws, codigoEscrito\);/);
});

test('6. la pantalla del V2: la estrella, la caja del Ops Center, los dos videos y la pantalla oscura', () => {
  const page = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(page, /if \(vista\.v2 && !vista\.bloqueo\) \{\n\s*return <ChatArranqueV2 /);
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.doesNotMatch(v2, /Ahora no/, 'el onboarding es obligatorio');
  // Sin «Pega aquí el código» ni «Pegar» (Martín, 19/11).
  assert.doesNotMatch(v2, /[>"']Pega aquí el código|>Pegar</);
  // El primer mensaje sale a su momento del video (desde el 20/11, tarde: cuando la voz dice «unas preguntas cortas…», o al terminar,
  // pausarlo, sin play o sin video) o al tocar la caja, con MaKo escribiendo antes (Martín, 19/11). La espera y sus desvíos:
  // app/_ui/tutorial/useMensajeDelVideo.ts, tests/onboarding-mensaje-del-video.test.ts.
  assert.match(v2, /lugar: filaBienvenida, activo: fase === 'chat', inicial: inicial\.etapa === 'nombre' \? 'espera' : 'listo',/);
  // Desde el 20/11 (tarde), por la cola de salida: de a uno, con sus puntitos, y su pieza después (tests/cola-de-salida.test.ts).
  assert.match(v2, /\{cola\.visibles\.map\(\(f\) => \{/);
  assert.match(v2, /\{escribe && escribiendo\('arr-pensando'\)\}/);
  assert.match(leer('app/_ui/tutorial/VideoDelMomento.tsx'), /onEnded=\{\(\) => \{ setEstado\('terminado'\); soltarMarca\(\); onTermina\?\.\(\); \}\}/);
  assert.match(v2, /<CriaturaMako size=\{36\}/, 'la estrella en la cabecera');
  assert.match(v2, /<CriaturaMako size=\{26\}/, 'la estrella al lado de cada mensaje');
  assert.match(v2, /<div className=\{`co-caja\$\{etapa === 'listo' && enTelefono \? ' arr-v2__caja--dos' : ''\}`\} onFocusCapture=\{soltarPrimero\} onPointerDownCapture=\{soltarPrimero\}>\s*<CajaChat /, 'la caja de una línea del Ops Center');
  assert.equal((v2.match(/<VideoDelMomento /g) ?? []).length, 2, 'dos videos: la bienvenida y el del WhatsApp (el de 38 s, cortado en dos el 19/11)');
  assert.match(v2, /const VIDEO_BIENVENIDA = 'onboarding-bienvenida';/);
  // Sólo si el video existe de verdad: nunca un «no está grabado» en producción (el Cerebro, 19/11).
  // (20/11, V5: quieto, marcado con «dale play»: tests/tutorial-entrada.test.ts.)
  assert.match(v2, /\{videoBienvenida && filaMako\('arr-video', <VideoDelMomento clave=\{VIDEO_BIENVENIDA\} titulo="Bienvenida a MaKo" revision=\{false\} dalePlay \/>, \{ lugar: filaBienvenida \}\)\}/);
  // El video, cortado en dos (Martín, 19/11: «que tenga cortes como los pasos»): la bienvenida arriba, y el del WhatsApp como su propio
  // mensaje justo antes del paso del código. No es `onboarding-whatsapp`, el de la pantalla vieja.
  assert.match(v2, /const VIDEO_WHATSAPP = 'onboarding-bienvenida-whatsapp';/);
  // (Desde el 20/11, tarde, el mensaje del código sale a su momento del video, con sus puntitos: tests/onboarding-mensaje-del-video.test.ts.)
  assert.match(v2, /if \(f\.id === FILA_VIDEO_WHATSAPP\) return filaMako\(f\.id, <VideoDelMomento clave=\{VIDEO_WHATSAPP\} [^>]*\/>, \{ lugar: filaWhatsapp \}\);/);
  assert.equal(mensajesDeArranque({ nombre: 'Vale', telefono: 'codigo', telefonoNumero: '+54 9 11 5555 0101', telefonoEntrante: true }, H).antes.at(-1)?.id, 'arr-codigo', 'el id del mensaje del código');
  // En el teléfono (o una pantalla angosta), el final es «Continuar el onboarding desde la PC», como la maqueta (18/11).
  assert.match(v2, /window\.matchMedia\('\(max-width: 640px\)'\)\.matches\) setEnTelefono\(true\)/);
  assert.match(v2, /\{enTelefono\s*\? <button type="button" onClick=\{\(\) => setEnPc\(true\)\} className="arr-link arr-link--principal">Continuar el onboarding desde la PC<\/button>/);
  // (20/11, OA-13: con su ref, para centrar el barrido en MaKo escribiendo: tests/onboarding-v2-auditoria.test.ts, el 17.)
  assert.match(v2, /\{fase === 'escribe' && <div ref=\{velo\} className="arr-v2__velo" aria-hidden="true" \/>\}/, 'la pantalla oscura');
  assert.match(v2, /\{fase === 'escribe' && escribiendo\('arr-escribe', true\)\}/, 'con MaKo escribiendo, a la vista');
  assert.match(v2, /setFase\('escribe'\);/, 'al tocar la entrada');
  assert.match(v2, /<InterruptorModo variante="sitio" \/>/, 'el sol y la luna adentro del bloque');
  // El reproductor (Martín, 19/11: «se ve mal el recuadro del video»): un ancho FIJO, así el globo mide lo que el video y no el ancho
  // natural del archivo; sin los controles del navegador; y al terminar, otra vez la portada.
  const vm = leer('app/_ui/tutorial/VideoDelMomento.tsx');
  assert.match(vm, /\.mk-vmom \{ width: 400px; max-width: 100%;/);
  assert.match(vm, /<video ref=\{ref\} className="mk-vmom__video" src=\{v\.archivo\} poster=\{v\.poster\} playsInline preload="metadata"\s/, 'sin los controles del navegador');
  assert.match(vm, /\{terminado && v\.poster && <img className="mk-vmom__portada" src=\{v\.poster\} alt="" \/>\}/);
});
