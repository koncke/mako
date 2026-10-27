// =============================================================================
// Lo que no es para MaKo no dispara un turno, y MaKo sabe quién escribe (27/10/2026, P8; lib/doer-para-quien.ts)
// =============================================================================
// ~16 de 58 turnos contestaban un acuse o una charla entre personas; a «Esto habla solo ? @joan» MaKo dio una descripción
// falsa; a quien escribía la llamó por otro nombre.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueQuienEscribe, esAcusePuro, mencionesDe, noEsParaMaKo } from '../lib/doer-para-quien';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const base = { nombraAMaKo: false, makoPregunto: false, hayPendientes: false, menciones: [] as string[] };

test('1. un acuse puro o una mención a otro no es para MaKo', () => {
  for (const t of ['ok', 'Gracias!', 'genial gracias', 'jajaja', '👍', 'dale, gracias']) assert.equal(noEsParaMaKo({ ...base, texto: t }), 'acuse', t);
  // El literal del grupo: «Esto habla solo ? @joan».
  const msg = { extendedTextMessage: { text: 'Esto habla solo ? @5491100000000', contextInfo: { mentionedJid: ['5491100000000@s.whatsapp.net'] } } };
  assert.deepEqual(mencionesDe(msg), ['5491100000000@s.whatsapp.net']);
  assert.equal(noEsParaMaKo({ ...base, texto: 'Esto habla solo ? @joan', menciones: mencionesDe(msg) }), 'a-otro');
});

test('2. es para MaKo si lo nombran, si preguntó algo (el «ok» es un sí) o si hay algo pendiente; y un pedido, siempre', () => {
  assert.equal(noEsParaMaKo({ ...base, texto: 'ok', makoPregunto: true }), null);
  assert.equal(noEsParaMaKo({ ...base, texto: 'ok', hayPendientes: true }), null);
  assert.equal(noEsParaMaKo({ ...base, texto: 'gracias MaKo', nombraAMaKo: true }), null);
  for (const t of ['ok, pausala', 'gracias, ¿y los leads de hoy?', 'listo el presupuesto?']) assert.equal(noEsParaMaKo({ ...base, texto: t }), null, t);
  assert.ok(!esAcusePuro('ok, mandale el link a Juan'));
});

test('3. quién escribe: su nombre de WhatsApp, y nada si no hay nombre o es un número', () => {
  assert.match(bloqueQuienEscribe('Brigitte'), /^QUIÉN TE ESCRIBE AHORA: Brigitte \(su nombre de WhatsApp\)\./);
  assert.equal(bloqueQuienEscribe(''), '');
  assert.equal(bloqueQuienEscribe('92741379870892'), '');
});

test('4. el doer: lo saltea antes del turno (leyendo la memoria sólo si hace falta) y le pasa quién escribe al system', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /if \(!esMedia && !nombraAMaKo\(textoDirecto\) && !vigentes\.length\) \{\n\s*const menciones = mencionesDe\(/);
  assert.match(doer, /if \(!pregunto\) return \{ engaged: false, skip: `no es para MaKo \(\$\{candidato\}\)` \};/);
  assert.match(doer, /\[bloqueQuienEscribe\(data\.pushName\), ctxYaSeHablo, ctxMostrado\]/);
});
