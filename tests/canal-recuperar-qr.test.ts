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
// PROBADO ROMPIÉNDOLO: corrido contra `lib/mako-canal.ts` y el webhook de HEAD
// (el arreglo del 08/09, el que le dijo «reintenta» a Martín), fallan 6 de 7.
// El único que pasa es «nunca borra la instancia», que esa versión ya cumplía.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const codigo = sinComentarios(readFileSync(new URL('../lib/mako-canal.ts', import.meta.url), 'utf8'));
const webhook = sinComentarios(readFileSync(new URL('../app/api/webhooks/evolution/route.ts', import.meta.url), 'utf8'));

const cuerpoConectar = codigo.slice(
  codigo.indexOf('export async function conectarCanalMaKo'),
  codigo.indexOf('async function crearInstanciaCanal'),
);

test('Ante una instancia zombi, primero intenta soltarla y pedir el QR de nuevo', () => {
  assert.match(cuerpoConectar, /instance\/logout\/\$\{inst\}/,
    'la recuperación dejó de soltar la sesión muerta');
  // Y LEE lo que contestó: el 11/09 el logout daba 500 y el código seguía como si nada.
  assert.match(cuerpoConectar, /if \(lo\.ok\)/,
    'volvió a ignorar el resultado del logout: un 500 se lee como «ya la solté»');
  assert.match(cuerpoConectar, /qrConEspera\(inst/, 'no reintenta el connect después del logout');
});

test('⛔ La sesión SOLO se toca con el socket verificablemente muerto', () => {
  // Un logout sobre una sesión VIVA desvincula el número y deja a todos los
  // clientes sin MaKo. El guard va en positivo sobre una operación real, jamás
  // sobre el `state`, que miente en las dos direcciones. Y «no pude preguntar»
  // no es «está muerta».
  const iSondeo = cuerpoConectar.indexOf('sondearSocket(inst');
  const iVivo = cuerpoConectar.indexOf("sondeo === 'vivo'");
  const iSinRespuesta = cuerpoConectar.indexOf("sondeo === 'sin_respuesta'");
  const iLogout = cuerpoConectar.indexOf('/instance/logout/');
  const iRotar = cuerpoConectar.indexOf('crearInstanciaCanal(nombreInstanciaNueva');
  assert.ok(iSondeo > 0, 'la recuperación dejó de preguntarle al socket');
  assert.ok(iVivo > iSondeo && iVivo < iLogout, 'con el socket vivo ya no se corta antes del logout');
  assert.ok(iSinRespuesta > iSondeo && iSinRespuesta < iLogout,
    '«no pude preguntar» volvió a seguir de largo hasta el logout');
  assert.ok(iRotar > iLogout, 'la línea nueva se crea sin haber intentado soltar la vieja');
});

test('Si Evolution no suelta la sesión, rota a una línea nueva en vez de rendirse', () => {
  assert.match(cuerpoConectar, /crearInstanciaCanal\(nombreInstanciaNueva\(\)\)/,
    'volvió a quedarse sin salida cuando el logout no suelta la instancia');
  // La línea nueva tiene que quedar registrada como EL canal: si no, el panel sigue
  // mirando la muerta y cada clic crea otra.
  assert.match(codigo, /setSetting\(KEY_CANAL_INSTANCIA, nombre\)/,
    'la línea nueva no queda guardada como la instancia vigente del canal');
  // Y nace escuchando: sin webhook ni grupos conecta, dice «conectado» y no oye nada.
  const crear = codigo.slice(codigo.indexOf('async function crearInstanciaCanal'), codigo.indexOf('export async function usarCanalComoVoz'));
  assert.match(crear, /prepararInstancia\(nombre\)/, 'la línea nueva nace sin webhook ni grupos');
});

test('Nadie usa el nombre fijo como si fuera la instancia', () => {
  assert.ok(!/\/\$\{INSTANCIA_SUPERADMIN\}/.test(codigo),
    'mako-canal volvió a llamar a Evolution con el nombre fijo: tras rotar, habla con la muerta');
  // El webhook reconoce la VIGENTE: con el nombre fijo, la línea nueva quedaba sorda.
  assert.match(webhook, /instanciaCanal\(\)/, 'el webhook dejó de preguntar cuál es la línea vigente');
  assert.ok(!/instance [!=]== INSTANCIA_SUPERADMIN/.test(webhook),
    'el webhook volvió a comparar contra el nombre fijo');
});

test('La voz se muda en el servidor al conectar, no solo con el panel abierto', () => {
  const i = webhook.indexOf("evento === 'connection.update'");
  const bloque = webhook.slice(i, webhook.indexOf("evento === 'qrcode.updated'"));
  assert.match(bloque, /usarCanalComoVoz\(true\)/,
    'la voz vuelve a depender de que alguien tenga /agencia abierto al escanear');
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
