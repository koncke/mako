// =============================================================================
// El webhook GUARDA los grupos de la lista (Makito), con la media bajada en el momento y en la plataforma (27/10/2026, MK-01)
// =============================================================================
// El pedido del 27/09 se dio por hecho: tests/grupos-guardados.test.ts prueba la puerta de lib/evolution-mensajes.ts, pero la
// RUTA separaba los grupos antes y sólo le pasaba los 1-a-1 a `guardarMensajeUpsert`: la puerta no se alcanzaba nunca. Este
// test lee la ruta. Y la trampa: el `ws` de la ruta para la línea de voz es OWNER_WS, el ws1 de Mauricio, un CLIENTE.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conMediaDelMomento, mediaSinBytes } from '../lib/grupos-guardados-media';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (t: string) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const MAKITO = '120363411300409914@g.us';

test('1. la ruta guarda los grupos de la lista, en el workspace de la PLATAFORMA y con la media del momento', () => {
  const ruta = sinComentarios(leer('app/api/webhooks/evolution/route.ts'));
  const i = ruta.indexOf('const aGuardar = grupos.filter(');
  assert.ok(i > 0, 'la ruta no separa los grupos que se guardan');
  const bloque = ruta.slice(i, ruta.indexOf('let errores = 0;', i));
  assert.match(bloque, /grupoSeGuarda\(/, 'sin la lista blanca: entraría cualquier grupo de la línea personal');
  assert.match(bloque, /const plataforma = await wsSuperAdmin\(\)/);
  assert.match(bloque, /await runWithWorkspace\(plataforma, async \(\) => \{[\s\S]*await guardarMensajeUpsert\(instance, \(await conMediaDelMomento\(instance, m, fetchMediaBase64EnInstancia\)\)/);
  // ⚠️ Nunca con el `ws` de la instancia (OWNER_WS = el ws1, un cliente), y sincrónico (no en `after`, que no es durable).
  assert.doesNotMatch(bloque, /runWithWorkspace\(ws\b/);
  assert.doesNotMatch(bloque, /after\(/);
});

test('2. la media sin bytes se baja en el momento; la que ya vino, o un texto, no se pide', async () => {
  const pedidos: string[] = [];
  const bajar = async (_i: string, jid: string, id: string) => { pedidos.push(`${jid}/${id}`); return { base64: 'T0dH', mimetype: 'audio/ogg' }; };
  const audio = { key: { remoteJid: MAKITO, id: 'A1', fromMe: false }, message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 12 } } };
  assert.ok(mediaSinBytes(audio));
  assert.equal((await conMediaDelMomento('mako_voz', audio, bajar)).base64, 'T0dH');
  const conBytes = { key: { remoteJid: MAKITO, id: 'A2' }, message: { audioMessage: { base64: 'YWJj' } } };
  const texto = { key: { remoteJid: MAKITO, id: 'T1' }, message: { conversation: 'MaKo no me deja agendar' } };
  assert.equal(await conMediaDelMomento('mako_voz', conBytes, bajar), conBytes);
  assert.equal(await conMediaDelMomento('mako_voz', texto, bajar), texto);
  assert.deepEqual(pedidos, [`${MAKITO}/A1`]);
  // Si no se pudo bajar, el mensaje se guarda igual (sin media): no se pierde el texto por el audio.
  const sinSuerte = await conMediaDelMomento('mako_voz', audio, async () => null);
  assert.equal(sinSuerte.base64, undefined);
});

test('3. el porqué dice los días que se midieron (~15-17), no los ~30 que se creyó', () => {
  const g = leer('lib/grupos-guardados.ts');
  assert.doesNotMatch(g, /~30 días/);
  assert.match(g, /~15-17 días/);
});
