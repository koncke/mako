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
import { bloqueQuienEscribe, esAcusePuro, mencionesDe, noEsParaMaKo, quienesMencionados } from '../lib/doer-para-quien';

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
  assert.match(doer, /if \(!esMedia\) \{\n\s*const noEs = await noEsParaMaKoAhora\(wsData, jid, textoDirecto, quien, async \(\) => vigentes\.length > 0\);\n\s*if \(noEs\) return \{ engaged: false, skip: `no es para MaKo \(\$\{noEs\}\)` \};/);
  assert.match(doer, /if \(nombraAMaKo\(texto\) \|\| quien\.aMaKo\) return null;/, 'una @mención a MaKo dejó de contar como nombrarla');
  assert.match(doer, /return pregunto \? null : candidato;/, 'el «ok» después de una pregunta de MaKo dejó de ser un sí');
  assert.match(doer, /\[bloqueQuienEscribe\(data\.pushName\), (?:ctxContacto, )?ctxYaSeHablo, ctxMostrado\]/);
});

// La revisión adversarial de 92d23e11d: elegir a MaKo con la @ manda el jid de su línea, no la palabra «mako», y quedaba callado.
const LINEA = '5493764002605';
const conMencion = (jid: string) => ({ extendedTextMessage: { text: '@5493764002605 ¿cuántos leads entraron hoy?', contextInfo: { mentionedJid: [jid] } } });

test('5. una @mención a la línea de MaKo es para MaKo; a otra persona, no; un @lid o sin la línea, no se sabe y contesta', () => {
  const aMaKo = quienesMencionados(mencionesDe(conMencion(`${LINEA}@s.whatsapp.net`)), LINEA);
  assert.deepEqual(aMaKo, { aMaKo: true, aOtros: [] });
  assert.equal(noEsParaMaKo({ ...base, texto: '@5493764002605 ¿cuántos leads entraron hoy?', menciones: aMaKo.aOtros }), null);
  // Con `:device` y sin el 9 de Argentina, la misma línea.
  assert.equal(quienesMencionados(['543764002605:12@s.whatsapp.net'], LINEA).aMaKo, true);
  // A otra persona: «a otro».
  const aJoan = quienesMencionados(['5491100000000@s.whatsapp.net'], LINEA);
  assert.deepEqual(aJoan, { aMaKo: false, aOtros: ['5491100000000@s.whatsapp.net'] });
  assert.equal(noEsParaMaKo({ ...base, texto: '@Joan pasame el presupuesto', menciones: aJoan.aOtros }), 'a-otro');
  // Un @lid no se compara con un teléfono, y sin el número de la línea no se sabe: MaKo contesta, como antes de P8.
  for (const q of [quienesMencionados(['70781665022126@lid'], LINEA), quienesMencionados(['5491100000000@s.whatsapp.net'], null),
    quienesMencionados(['5491100000000@s.whatsapp.net', '70781665022126@lid'], LINEA)]) {
    assert.deepEqual(q, { aMaKo: false, aOtros: [] });
  }
});

test('6. el 👍 sigue la MISMA regla que el turno: a lo que no es para MaKo no le reacciona', () => {
  const doer = leer('lib/mako-doer-in.ts');
  const fn = doer.slice(doer.indexOf('async function enganchaElTexto('), doer.indexOf('/** Lo que dejó el acuse del que ganó el candado'));
  assert.match(fn, /nombraAMaKo\(texto\) \|\| quien\.aMaKo/);
  assert.match(fn, /return engancha && !\(await noEsParaMaKoAhora\(wsData, jid, texto, quien, pendientes\)\);/);
  assert.match(doer, /await enganchaElTexto\(wsData, jid, texto, await mencionadosEn\(instance, data\)\)/);
  assert.match(doer, /const enganchaTexto = modo === 'libre' \|\| nombraAMaKo\(textoDirecto\) \|\| quien\.aMaKo \|\| abierta/);
});

test('7. el lote conserva las @menciones: una mención a MaKo seguida de otro mensaje no queda en el 👍 y silencio', () => {
  // La revisión de 36e06b35f: el mensaje sintético del lote era texto plano, y en modo «ventana» la mención se perdía.
  const doer = leer('lib/mako-doer-in.ts');
  assert.equal((doer.match(/message: \{ conversation: unirMensajes\(textos\.map\(\(t\) => \(\{ texto: t \}\)\)\), \.\.\.mencionesDelLote\(cola\) \},/g) ?? []).length, 2,
    'uno de los dos lotes (el del turno o el del cron) pierde las menciones');
  assert.match(doer, /const todas = \[\.\.\.new Set\(cola\.flatMap\(\(m\) => mencionesDe\(/);
  // Y lo que arma, `mencionesDe` lo lee igual que en un mensaje de WhatsApp.
  assert.deepEqual(mencionesDe({ conversation: 'hola\nmako, ¿y los leads?', contextInfo: { mentionedJid: [`${LINEA}@s.whatsapp.net`] } }), [`${LINEA}@s.whatsapp.net`]);
});
