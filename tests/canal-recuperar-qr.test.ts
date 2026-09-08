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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/mako-canal.ts', import.meta.url), 'utf8');
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('Ante una instancia zombi, suelta la sesión y pide el QR de nuevo', () => {
  assert.match(codigo, /instance\/logout\/\$\{INSTANCIA_SUPERADMIN\}/,
    'la recuperación dejó de soltar la sesión muerta: Evolution nunca va a dar un QR');
  assert.match(codigo, /c = await ev\(`\/instance\/connect\//,
    'no reintenta el connect después del logout');
});

test('⛔ El logout SOLO con el socket verificablemente muerto', () => {
  // Un logout sobre una sesión VIVA desvincula el número y deja a todos los
  // clientes sin MaKo. El guard va en positivo sobre una operación real, jamás
  // sobre el `state`, que miente en las dos direcciones.
  assert.match(codigo, /sinQr\(c\.body\) && !\(await socketVivo\(INSTANCIA_SUPERADMIN\)\)/,
    'el logout de recuperación dejó de exigir que el socket esté muerto');
});

test('Recuperar NO es desconectar: nunca borra la instancia', () => {
  // `desconectarCanalMaKo` hace logout + DELETE + devuelve la voz al default.
  // Eso es para desconectar a propósito; usarlo para recuperarse de una caída se
  // lleva puesta la instancia y su webhook.
  const i = codigo.indexOf('conectarCanalMaKo');
  const j = codigo.indexOf('usarCanalComoVoz');
  const cuerpo = codigo.slice(i, j > i ? j : undefined);
  assert.ok(!/instance\/delete/.test(cuerpo),
    'la recuperación empezó a borrar la instancia: eso es desconectar, no recuperar');
});

test('Cuando no hay QR, dice QUÉ pasó', () => {
  // «No se pudo generar el QR» no dice si el problema es de Evolution, de la
  // sesión, o si directamente no hacía falta reconectar nada.
  assert.match(codigo, /ya está conectada y respondiendo/,
    'se perdió el caso «no hacía falta reconectar»');
  assert.ok(!/error: 'No se pudo generar el QR'/.test(codigo),
    'volvió el mensaje que no dice nada');
});
