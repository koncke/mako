// EL MENSAJE DEL CÓDIGO: AL CHAT PRIVADO DE MAKO, CON EL NÚMERO QUE ABRE «ABRIR WHATSAPP» (20/11/2026, la llamada con Leila:
// «¿tienes que mandar el código? … Esto es el grupo, ¿verdad?», 00:23:52–00:25:07). El texto decía «mándale el mensaje a MaKo
// (+54 9 11 2505-2605)», con el número del sitio (`WHATSAPP_MAKO`), y el link va a la línea que recibe (`numeroLinea`): podían no
// coincidir. Ahora el texto dice el de la línea, y que va al chat privado, no al grupo.
// Roto a propósito el 20/11 (cada uno cae): el mensaje con el número del sitio aunque la línea sea otra (1 y 2), sin «no a tu grupo»
// (1), y la conversación sin la línea del pedido de la tarjeta (3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { V2_CODIGO, mensajesDeArranqueV2, v2Codigo, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';
import { WHATSAPP_MAKO } from '../app/vsl/_sitio/contacto';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const plano = (t: string) => t.replace(/ /g, ' ').replace(/⁠/g, '');
const H: HechosArranque = { modo: 'oferta', v2: true, nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false };

test('1. dice el chat PRIVADO de MaKo, no el grupo, y el número de la línea que abre «Abrir WhatsApp»', () => {
  assert.match(plano(V2_CODIGO), /mándale el mensaje al chat privado de MaKo \(\+54 9 11 2505-2605\), no a tu grupo\./);
  assert.equal(v2Codigo(WHATSAPP_MAKO.numero), V2_CODIGO, 'la línea es la del sitio: el mismo texto');
  const otra = plano(v2Codigo('5491133334444'));
  assert.match(otra, /al chat privado de MaKo \(\+54 911 3333 4444\), no a tu grupo/);
  assert.doesNotMatch(otra, /2505/, 'nunca el número del sitio si la línea es otra');
  assert.doesNotMatch(v2Codigo('5491133334444'), /\(\+54 911/, 'de una pieza: espacios que no cortan');
});

test('2. la conversación usa la línea de los hechos', () => {
  const e: EstadoArranque = { nombre: 'Leila', telefono: 'codigo', telefonoNumero: '+5215555550101', telefonoEntrante: true };
  const ultimo = mensajesDeArranqueV2(e, { ...H, lineaMaKo: '5491133334444' }).at(-1)!;
  assert.equal(ultimo.tarjeta, 'codigo');
  assert.match(plano(ultimo.texto), /\(\+54 911 3333 4444\)/);
  assert.equal(mensajesDeArranqueV2(e, H).at(-1)!.texto, V2_CODIGO, 'sin la línea, el del sitio');
});

test('3. la línea de los hechos es la MISMA del link de «Abrir WhatsApp» (`numeroLinea` de la verificación)', () => {
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  // La vista lee el pedido UNA vez, y el mensaje y la tarjeta usan lo mismo.
  assert.match(srv, /const whatsapp = etapa === 'codigo' && e\.telefonoEntrante\n\s*\? await getWorkspaceActual\(\)\.then\(\(ws\) => \(ws == null \? null : estadoVerificacionEntrante\(ws\)\)\)/);
  assert.match(srv, /const \{ antes, despues \} = mensajesDeArranque\(e, \{ \.\.\.h, lineaMaKo: whatsapp\?\.numeroLinea \?\? null \}\);/);
  assert.match(srv, /\n\s*whatsapp,\n/, 'la tarjeta recibe el mismo pedido');
  assert.match(sinComentarios(leer('lib/verificacion-entrante.ts')), /link: linkWaMe\(v\.numeroLinea, /);
});
