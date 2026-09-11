// =============================================================================
// «No se pudo generar el QR»: el botón de recuperar, roto en su propio caso
// =============================================================================
// 08/09/2026. La voz de MaKo llevaba seis días ZOMBI (`state: open`, socket
// muerto). Martín fue a reconectarla y le salió «No se pudo generar el QR».
//
// Evolution NO emite QR si cree que la instancia ya está conectada:
// `/instance/connect/` devolvía {"instance":{"state":"open"}} —sin base64 ni
// code— y el código leía `b.base64 ?? null`. El mismo campo mentiroso que causó
// la caída bloqueaba la salida de la caída.
//
// 11/09/2026. Con el arreglo desplegado, el botón pasó a decir «Evolution no
// devolvió el QR». Medido sobre la instancia trabada:
//
//   DELETE /instance/logout ..... 500 «Error: Connection Closed» (state sigue open)
//   POST   /instance/restart .... 200 {"state":"open"} — socket muerto a los 30 s
//   GET    /instance/connect .... {"instance":{"state":"open"}} ×5 — nunca un QR
//
// Evolution 2.3.7 guarda el estado en memoria y solo lo cambia el evento del
// socket, que está muerto y no emite. Ninguna ruta de la API la saca de `open`.
// La salida es una línea NUEVA, y todo lo que comparaba contra el nombre fijo
// tiene que preguntar cuál es la vigente.
//
// Ese mismo día una revisión adversarial le encontró a la rotación cinco huecos:
// rotaba encima de la línea viva si fallaba la lectura de la base, dos clics abrían
// dos líneas, soltaba la sesión con un 403 viejo sin sondear, rotaba aunque el logout
// SÍ hubiera soltado, y la voz viva quedaba sorda entre la rotación y el escaneo.
// Cada uno tiene su test abajo.
//
// PROBADO ROMPIÉNDOLO, contra tres versiones de `lib/mako-canal.ts` + el webhook:
//   · la del 08/09 (b25f8e2f~1, la que le dijo «reintenta» a Martín), con la versión
//     anterior de este archivo (8 tests): fallan 7. Pasa solo «nunca borra la instancia».
//   · la primera rotación (b25f8e2f, sin el corte de `open`), misma versión: falla 1 de 8,
//     justo «sin `open` no se toca la sesión», el que evita una línea nueva por clic.
//   · la rotación desplegada antes de la revisión (2ae26f80), con este archivo: fallan 8
//     de 10. Pasan «nunca borra la instancia» y «dice QUÉ pasó», que ya cumplía.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const codigo = sinComentarios(readFileSync(new URL('../lib/mako-canal.ts', import.meta.url), 'utf8'));
const webhook = sinComentarios(readFileSync(new URL('../app/api/webhooks/evolution/route.ts', import.meta.url), 'utf8'));

const cuerpoConectar = codigo.slice(
  codigo.indexOf('export async function conectarCanalMaKo'),
  codigo.indexOf('async function rotarCanal'),
);
const cuerpoRotar = codigo.slice(
  codigo.indexOf('async function rotarCanal'),
  codigo.indexOf('async function crearInstanciaCanal'),
);

test('Ante una instancia zombi, primero intenta soltarla y pedir el QR de nuevo', () => {
  assert.match(cuerpoConectar, /instance\/logout\/\$\{inst\}/,
    'la recuperación dejó de soltar la sesión muerta');
  // Y LEE lo que contestó: el 11/09 el logout daba 500 y el código seguía como si nada.
  assert.match(cuerpoConectar, /if \(lo\.ok\)/,
    'volvió a ignorar el resultado del logout: un 500 se lee como «ya la solté»');
  // El QR se pide DESPUÉS del logout, adentro del `if (lo.ok)`. La primera versión de este
  // assert buscaba `qrConEspera(inst` en todo el cuerpo, y lo cumplía la espera de la rama
  // sin `open`, que va ANTES del logout (revisión del 11/09/2026).
  const iLoOk = cuerpoConectar.indexOf('if (lo.ok)');
  const iQr = cuerpoConectar.indexOf('qrConEspera(inst', iLoOk);
  const iRotar = cuerpoConectar.indexOf('rotarCanal(inst', iLoOk);
  assert.ok(iLoOk > 0 && iQr > iLoOk && iQr < iRotar, 'se perdió el pedido de QR después del logout');
});

test('⛔ La sesión SOLO se toca con el socket verificablemente muerto, en las DOS ramas', () => {
  // Un logout sobre una sesión VIVA desvincula el número y deja a todos los
  // clientes sin MaKo. El guard va en positivo sobre una operación real, jamás
  // sobre el `state`, que miente en las dos direcciones. Y «no pude preguntar»
  // no es «está muerta».
  const iDice = cuerpoConectar.indexOf("dice !== 'open'");
  const iMotivo = cuerpoConectar.indexOf('motivoCaida(inst');
  const iSondeo = cuerpoConectar.indexOf('sondearSocket(inst');
  const iVivo = cuerpoConectar.indexOf("sondeo === 'vivo'");
  const iSinRespuesta = cuerpoConectar.indexOf("sondeo === 'sin_respuesta'");
  const iLogout = cuerpoConectar.indexOf('/instance/logout/');
  const iRotar = cuerpoConectar.indexOf('rotarCanal(inst');
  assert.ok(iSondeo > 0, 'la recuperación dejó de preguntarle al socket');
  // El sondeo va DESPUÉS de la rama sin `open`, así la cruzan las dos. Esa rama iba directo al
  // logout con el 401/403 GUARDADO de la última caída, que no es una medición de ahora.
  assert.ok(iDice > 0 && iMotivo > iDice && iSondeo > iMotivo,
    'la rama sin `open` volvió a soltar la sesión sin sondear justo antes');
  assert.ok(iVivo > iSondeo && iVivo < iLogout, 'con el socket vivo ya no se corta antes del logout');
  assert.ok(iSinRespuesta > iSondeo && iSinRespuesta < iLogout,
    '«no pude preguntar» volvió a seguir de largo hasta el logout');
  assert.ok(iRotar > iLogout, 'la línea nueva se crea sin haber intentado soltar la vieja');
});

test('Sin `open` no se toca la sesión: se espera el QR (si no, una línea nueva por clic)', () => {
  // Una instancia recién creada o esperando escaneo TAMPOCO tiene socket: sondearla da
  // «Connection Closed» igual que a una zombi. La primera versión de la rotación no
  // miraba esto, así que cada clic mientras Evolution armaba el QR hacía logout y
  // creaba otra línea. Solo se toca con `open` (la zombi) o con WhatsApp habiéndola
  // cerrado (401/403, que se queda en `connecting` para siempre).
  const iDice = cuerpoConectar.indexOf("dice !== 'open'");
  const iMotivo = cuerpoConectar.indexOf('motivoCaida(inst');
  const iLogout = cuerpoConectar.indexOf('/instance/logout/');
  assert.ok(iDice > 0 && iDice < iLogout, 'volvió a sondear y soltar sin mirar si Evolution dice open');
  assert.ok(iMotivo > iDice && iMotivo < iLogout,
    'sin `open` se toca la sesión aunque WhatsApp no la haya cerrado');
  assert.match(cuerpoConectar, /!motivo\?\.desvinculado/, 'se perdió el corte para la instancia que solo va lenta');
  // Y la espera corta si la línea pasa a `open`: no hay QR que esperar sobre una que conectó.
  const espera = codigo.slice(codigo.indexOf('async function qrConEspera'), codigo.indexOf('async function prepararInstancia'));
  assert.match(espera, /state === 'open'\) return null/, 'la espera del QR sigue girando sobre una línea que ya conectó');
});

test('Si Evolution no suelta la sesión, rota — y SOLO entonces', () => {
  assert.match(cuerpoConectar, /rotarCanal\(inst, crudo\)/,
    'volvió a quedarse sin salida cuando el logout no suelta la instancia');
  // Con el logout OK no se rota: si Evolution soltó la sesión, la instancia sirve y solo hay
  // que esperar su QR. Antes caía igual a la rotación si el QR tardaba 6 s.
  assert.match(cuerpoConectar, /if \(lo\.ok\) \{\s*return \(await qrConEspera\(inst/,
    'un logout que SÍ soltó la sesión vuelve a abrir una línea nueva');
  // Y nace escuchando: sin webhook ni grupos conecta, dice «conectado» y no oye nada.
  const crear = codigo.slice(codigo.indexOf('async function crearInstanciaCanal'), codigo.indexOf('export async function usarCanalComoVoz'));
  assert.match(crear, /prepararInstancia\(nombre\)/, 'la línea nueva nace sin webhook ni grupos');
});

test('⛔ Dos clics a la vez no abren dos líneas: la nueva se RESERVA antes de crearla', () => {
  // La barra roja sale en todas las pestañas y para todos los admins. Con un setSetting ciego
  // después del create, cada request creaba su línea y ganaba la última: el QR de la otra
  // quedaba huérfano y sordo.
  const iReserva = cuerpoRotar.indexOf('cambiarSettingSi(KEY_CANAL_INSTANCIA, crudo, nueva)');
  const iCrear = cuerpoRotar.indexOf('crearInstanciaCanal(nueva)');
  assert.ok(iReserva > 0 && iCrear > iReserva, 'la línea nueva se crea sin reservarla antes (compare-and-set)');
  // El que pierde la carrera no crea nada: devuelve el QR de la que ganó.
  assert.match(cuerpoRotar, /if \(!gane\) \{[\s\S]*?qrConEspera\(vigente/, 'el que pierde la carrera no devuelve el QR de la ganadora');
  assert.ok(!/setSetting\(KEY_CANAL_INSTANCIA/.test(codigo),
    'volvió un setSetting ciego sobre el canal: gana el último y el otro QR queda huérfano');
});

test('⛔ No saber cuál es la línea corta todo: un 5xx de la base no es «es la zombi»', () => {
  // `getSetting` devuelve null ante un error, y `|| 'mako_superadmin'` lo convertía en la
  // zombi: «Conectar por QR» verificaba —bien— que esa estaba muerta y rotaba encima de la viva.
  assert.match(codigo, /getSettingEstricto\(KEY_CANAL_INSTANCIA\)/,
    'el canal volvió a leerse con getSetting: un error de la base se lee como «no hay setting»');
  const iLectura = cuerpoConectar.indexOf('instanciaCanalCruda()');
  const iCorte = cuerpoConectar.indexOf('No pude leer cuál es la línea de MaKo');
  const iExiste = cuerpoConectar.indexOf('existeInstancia(inst)');
  assert.ok(iLectura > 0 && iCorte > iLectura && iCorte < iExiste,
    'conectar sigue adelante sin saber cuál es la línea');
});

test('Nadie usa el nombre fijo como si fuera la instancia, y el webhook oye las DOS vigentes', () => {
  assert.ok(!/\/\$\{INSTANCIA_SUPERADMIN\}/.test(codigo),
    'mako-canal volvió a llamar a Evolution con el nombre fijo: tras rotar, habla con la muerta');
  assert.match(webhook, /instanciaCanal\(\)/, 'el webhook dejó de preguntar cuál es la línea vigente');
  assert.ok(!/instance [!=]== INSTANCIA_SUPERADMIN/.test(webhook),
    'el webhook volvió a comparar contra el nombre fijo');
  // Canal Y voz: entre la rotación y el escaneo difieren, y oyendo solo el canal la voz viva
  // quedaba sorda (revisión del 11/09/2026). El doble recibo lo deduplica ux_doer_buffer_msg.
  assert.match(webhook, /instanciaVoz\(\{ estricto: true \}\)/, 'el webhook dejó de reconocer la línea de la voz');
  assert.match(webhook, /vigentes\.includes\(instance\)/, 'el webhook dejó de aceptar las dos líneas vigentes');
});

test('La voz se muda en el servidor al conectar, con la línea que abrió', () => {
  const i = webhook.indexOf("evento === 'connection.update'");
  const bloque = webhook.slice(i, webhook.indexOf("evento === 'qrcode.updated'"));
  assert.match(bloque, /usarCanalComoVoz\(true, instance\)/,
    'la voz vuelve a depender de que alguien tenga /agencia abierto, o de una relectura del canal');
});

test('Recuperar NO es desconectar: nunca borra la instancia', () => {
  // `desconectarCanalMaKo` hace logout + DELETE + devuelve la voz al default.
  // Eso es para desconectar a propósito. Además, sobre una trabada ni funciona:
  // `delete` hace logout adentro y se cae igual.
  const hastaUsar = codigo.slice(codigo.indexOf('conectarCanalMaKo'), codigo.indexOf('usarCanalComoVoz'));
  assert.ok(!/instance\/delete/.test(hastaUsar),
    'la recuperación empezó a borrar la instancia: eso es desconectar, no recuperar');
});

test('Cuando no hay QR, dice QUÉ pasó y no manda a un callejón', () => {
  assert.match(codigo, /ya está conectada y respondiendo/, 'se perdió el caso «no hacía falta reconectar»');
  assert.ok(!/error: 'No se pudo generar el QR'/.test(codigo), 'volvió el mensaje que no dice nada');
  // «Desconecta la línea y vuelve a vincularla»: con la línea en `error` el panel no
  // muestra el botón Desconectar (solo aparece en `conectado`).
  assert.ok(!/desconecta la línea y vuelve a vincularla/.test(codigo),
    'volvió el consejo que apunta a un botón que no existe en ese estado');
});
