// =============================================================================
// El número TAL COMO se le pasa a Evolution: el país de la línea se completa en el ENVÍO (ws11, Leila, 20/10/2026)
// =============================================================================
// Martín: «Otro error que Leila me envía». En la ficha del lead #2313, «WhatsApp no oficial» → «Ese número no tiene
// WhatsApp». El lead tiene el número en 10 dígitos, sin el 52; `enviarTexto` sólo sacaba lo que no es dígito y lo mandaba
// tal cual, y Evolution contesta `exists:false` (medido el 21/08/2026: 542233550684 existe, 2233550684 no).
// Medido en producción (sólo lectura, 20/10 21:40Z): 53 de los 70 leads del ws11 están en 10 dígitos, 7 con 52+10, 9 con
// 521+10 y 1 con 54; 27 de los 32 borradores pendientes (los recordatorios de la sesión de mañana) fallarían igual, y uno
// empieza con «00». La línea del ws11 es 521… (México). Los datos del cliente no se tocan: se completa al enviar.
//
// Lo puro (lib/numero-whatsapp.ts) se prueba con datos; el cableado de lib/evolution.ts (que es `server-only` y habla con
// Evolution) se fija leyendo el código: los CUATRO caminos que le pasan un número a Evolution (texto, media, audio y la
// consulta del @lid) tienen que pasar por la función, con el número de la línea que manda.
//
// Probado rompiéndolo (20/10/2026): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { numeroParaWhatsApp, codigoDePaisDeLinea, motivoConPista, SIN_CODIGO_DE_PAIS } from '../lib/numero-whatsapp';
import { motivoDeEvolution } from '../lib/evolution-sonda';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** El número de la línea de cada país, con la forma en que Evolution lo guarda (`ownerJid` sin el @…). */
const LINEA = {
  MX: '5212212345678', // la del ws11 (52 + 1 + 10, la forma vieja de los móviles de México)
  MX_NUEVA: '522212345678',
  AR: '5491122334455',
  US: '14155551234',
  DO: '18095551234',
  ES: '34644123456',
  BR: '5511987654321',
};
const mandar = (telefono: string, linea: string | null) => {
  const r = numeroParaWhatsApp(telefono, linea);
  return r.ok ? r.numero : `ERROR: ${r.error}`;
};

test('un teléfono de 10 dígitos se completa con el país de la LÍNEA que manda (el caso de Leila)', () => {
  assert.equal(mandar('5512345678', LINEA.MX), '525512345678', 'MX + 10 dígitos → 52 + 10');
  assert.equal(mandar('5512345678', LINEA.MX_NUEVA), '525512345678', 'la línea en 52 + 10 (sin el 1) es la misma lada');
  assert.equal(mandar('4155551234', LINEA.US), '14155551234', 'una línea de EE.UU. + 10 → 1 + 10');
  assert.equal(mandar('8095551234', LINEA.DO), '18095551234', 'República Dominicana (+1809) es el «1», no el «1809»');
  assert.equal(mandar('1122334455', LINEA.AR), '541122334455', 'Argentina + 10 → 54 + 10');
  assert.equal(mandar('644123456', LINEA.ES), '34644123456', 'España: el largo local es 9');
  // Los símbolos del teléfono no cuentan.
  assert.equal(mandar('(55) 1234-5678', LINEA.MX), '525512345678', 'los paréntesis, espacios y guiones no cuentan');
});

test('lo que ya trae país NO se toca: 52, 521, 54 y 1', () => {
  for (const [tel, linea] of [
    ['525512345678', LINEA.MX], ['5215512345678', LINEA.MX], ['5491122334455', LINEA.MX], ['541122334455', LINEA.MX],
    ['14155551234', LINEA.MX], ['34644123456', LINEA.MX], ['525512345678', null], ['5215512345678', null],
  ] as Array<[string, string | null]>) {
    assert.equal(mandar(tel, linea), tel, `${tel} (línea ${linea}) cambió`);
  }
});

test('el «00» del principio es el prefijo de salida y se saca; un solo 0 no se toca', () => {
  assert.equal(mandar('00525512345678', LINEA.MX), '525512345678', 'el borrador del ws11 que empieza con 00');
  assert.equal(mandar('005512345678', LINEA.MX), '525512345678', '00 + 10 dígitos: sin el 00 es un número local');
  assert.equal(mandar('00521 55 1234 5678', null), '5215512345678', 'sin línea, igual se saca el 00');
  assert.equal(mandar('02233550684', LINEA.AR), '02233550684', 'el 0 de tránsito argentino no es un «00»: no se toca');
});

test('sin línea conocida, o de un país donde el largo no alcanza, NO se adivina: el error, no un número inventado', () => {
  assert.equal(mandar('5512345678', null), `ERROR: ${SIN_CODIGO_DE_PAIS}`, 'la fila de la línea no tiene número (la de MaKo)');
  assert.equal(mandar('5512345678', ''), `ERROR: ${SIN_CODIGO_DE_PAIS}`);
  // Un número de línea que no es de ningún país de la tabla NO es México (`splitTelefono` cae a México para un selector).
  assert.equal(mandar('5512345678', '99912345678'), `ERROR: ${SIN_CODIGO_DE_PAIS}`);
  // Brasil: el largo local es 10 u 11; completar sería adivinar.
  assert.equal(mandar('1187654321', LINEA.BR), `ERROR: ${SIN_CODIGO_DE_PAIS}`);
  // Una línea de España con un número de 10 dígitos (no es local de España): se manda como viene y, si no existe, Evolution lo dice.
  assert.equal(mandar('5512345678', LINEA.ES), '5512345678');
  // Otros largos, sin línea, se pasan: ya traen país o no hay forma de saberlo.
  assert.equal(mandar('541122334455', null), '541122334455');
  assert.equal(mandar('55123456', null), '55123456');
});

test('vacío o sin dígitos es «teléfono inválido», como decían los envíos', () => {
  for (const t of ['', '   ', 'sin número', '+', '00']) assert.deepEqual(numeroParaWhatsApp(t, LINEA.MX), { ok: false, error: 'teléfono inválido' }, `«${t}»`);
  assert.deepEqual(numeroParaWhatsApp(null, LINEA.MX), { ok: false, error: 'teléfono inválido' });
});

test('el país de la línea sale de su número, y un número que no es de ningún país es null (no México)', () => {
  assert.equal(codigoDePaisDeLinea(LINEA.MX), '52');
  assert.equal(codigoDePaisDeLinea(LINEA.AR), '54');
  assert.equal(codigoDePaisDeLinea(LINEA.US), '1');
  assert.equal(codigoDePaisDeLinea(LINEA.DO), '1');
  assert.equal(codigoDePaisDeLinea(LINEA.ES), '34');
  assert.equal(codigoDePaisDeLinea('+52 1 221 234 5678'), '52');
  assert.equal(codigoDePaisDeLinea('99912345678'), null);
  assert.equal(codigoDePaisDeLinea(null), null);
  assert.equal(codigoDePaisDeLinea(''), null);
});

test('el modal dice «Revisa que tenga el código de país» cuando el número igual no existe', () => {
  const sin = motivoDeEvolution(400, { response: { message: [{ exists: false, jid: 'x@s.whatsapp.net', number: '525512345678' }] } });
  assert.equal(sin, 'Ese número no tiene WhatsApp', 'motivoDeEvolution es de todas las pantallas: no cambia');
  assert.equal(motivoConPista(sin), 'Ese número no tiene WhatsApp. Revisa que tenga el código de país.');
  assert.equal(motivoConPista('Connection Closed'), 'Connection Closed', 'otros motivos pasan intactos');
  assert.equal(motivoConPista('Evolution 500'), 'Evolution 500');
});

test('los cuatro caminos que le pasan un número a Evolution pasan por numeroParaWhatsApp, con el número de la línea que manda', () => {
  const src = leer('lib/evolution.ts');
  const cuerpo = (firma: string) => {
    const i = src.indexOf(firma);
    assert.ok(i > 0, `no encuentro ${firma}`);
    const j = src.indexOf('\nexport ', i + firma.length);
    return src.slice(i, j > 0 ? j : undefined);
  };
  for (const firma of ['export async function enviarTexto(', 'export async function enviarMedia(', 'export async function enviarAudio(']) {
    const c = cuerpo(firma);
    assert.match(c, /numeroParaWhatsApp\(telefono, l\.numeroLinea\)/, `${firma} no completa el país de la línea`);
    assert.doesNotMatch(c, /\(telefono \|\| ''\)\.replace\(\/\\D\/g, ''\)/, `${firma} sigue sacando los dígitos a mano`);
    assert.match(c, /motivoConPista\(r\.motivo \?\? r\.error\)/, `${firma} no le pone la pista al error de «no tiene WhatsApp»`);
  }
  const lid = cuerpo('export async function fetchLidDeNumero(');
  assert.match(lid, /numeroParaWhatsApp\(telefono, numeroLinea\)/, 'la consulta del @lid no completa el país');
  assert.match(lid, /numbers: \[n\.numero\]/, 'la consulta del @lid pregunta por el número crudo');
  // La línea que manda lleva su número desde la fila (`lineaDeEnvio`).
  const linea = cuerpo('async function lineaDeEnvio(');
  assert.match(linea, /numeroLinea: lineas\.find\(\(x\) => x\.instance_name === e\.instance\)\?\.numero \?\? null/, 'lineaDeEnvio no devuelve el número de la línea');
});

// Probado rompiéndolo (20/10/2026), una rotura por vez con todo en verde antes (8 de 8): ver scratchpad/roturas-numero.json.
//   · el «00» sin sacar · el 52 fuera de la tabla de largos · un número de línea desconocido que cae a México ·
//     el +1809 que da «1809» · el largo local de España · el error de «sin línea» convertido en pasar el número ·
//     enviarTexto / enviarMedia / enviarAudio / fetchLidDeNumero con los dígitos a mano · lineaDeEnvio sin el número ·
//     el error de Evolution sin la pista.
