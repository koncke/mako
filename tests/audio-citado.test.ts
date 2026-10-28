// =============================================================================
// La nota de voz CITADA se escucha (28/10/2026, Leandro, ws10, en producción)
// =============================================================================
// Leandro contestó citando su audio de 1:34 («No me respondiste lo de este audio») y MaKo le dijo «en este mensaje no puedo
// escuchar audios ni tengo la transcripción del tuyo. Mándame el texto exacto». La cita traía el audio en
// `contextInfo.quotedMessage.audioMessage` (94 s), y el turno sólo transcribía el audio del mensaje NUEVO. Lo que fija este test:
//   1. `escucharElAudioCitado` REAL (tests/_audio-citado-hijo.ts), con el payload de Leandro: baja el audio por el id de la cita
//      y lo transcribe por la vía de la nota de voz del grupo (Groq); si Groq falla o WhatsApp no lo deja bajar, lo dice;
//   2. la cita se lee en sus tres lugares (el mensaje, su `contextInfo`, el nivel de arriba de Evolution v2), y su texto entra
//      al turno;
//   3. el cableado: el mensaje suelto y los dos lotes la escuchan, y si no se pudo, el aviso honesto con su ticket (nunca «no
//      puedo escuchar audios»); NUCLEO_GRUPO dice que MaKo escucha notas de voz.
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { audioCitadoDe, conElAudioCitado } from '../lib/audio-citado';
import { NUCLEO_GRUPO } from '../lib/nucleo-grupo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el caso de Leandro: el audio citado se baja por el id de la cita y se escucha con Groq; si no se puede, lo dice', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_audio-citado-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 280_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@CITADO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@CITADO@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.deepEqual(o.bien, { texto: 'Quiero que cuando comenten fiesta respondas el comentario en público y mandes el recurso por DM, como ManyChat.', segundos: 94 });
  assert.match(o.bienPedidos[0], /^evolution\.test\/chat\/getBase64FromMediaMessage\/mako-voz .*"id":"2A81E060BE438F478D26"/, 'no se bajó por el id de la cita');
  assert.equal(o.bienPedidos[1], 'api.groq.com/openai/v1/audio/transcriptions', 'no se escuchó por el Groq de la nota de voz del grupo');
  assert.equal(o.sinEscucha, 'fallo');
  assert.deepEqual(o.sinMedia, { sinAudio: true });
  assert.equal(o.sinCita, null);
});

test('2. la cita se lee donde venga, y lo que dice el audio entra al turno', () => {
  const quoted = { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 94 } };
  const arriba = audioCitadoDe({ message: { conversation: 'x' }, contextInfo: { stanzaId: 'A1', participant: 'p', quotedMessage: quoted } });
  assert.deepEqual(arriba, { id: 'A1', mime: 'audio/ogg; codecs=opus', segundos: 94, base64: null, participante: 'p' }, 'el nivel de arriba (Evolution v2, el payload real)');
  assert.equal(audioCitadoDe({ message: { extendedTextMessage: { text: 'x', contextInfo: { stanzaId: 'A2', quotedMessage: quoted } } } })?.id, 'A2');
  assert.equal(audioCitadoDe({ message: { conversation: 'x', contextInfo: { stanzaId: 'A3', quotedMessage: { pttMessage: { seconds: 3 } } } } })?.id, 'A3');
  assert.equal(audioCitadoDe({ message: { extendedTextMessage: { text: 'x', contextInfo: { stanzaId: 'A4', quotedMessage: { conversation: 'texto' } } } } }), null, 'una cita de texto no es un audio');
  assert.equal(audioCitadoDe({ message: { conversation: 'x' } }), null);
  assert.equal(conElAudioCitado('No me respondiste lo de este audio', 'Quiero X.', 94), 'No me respondiste lo de este audio\n\n(cita una nota de voz de 94 s; la escuchaste y dice: «Quiero X.»)');
});

test('3. el cableado: el suelto y los dos lotes la escuchan; si no se pudo, el aviso honesto con ticket; MaKo escucha audios', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.equal((doer.match(/= await escucharElAudioCitado\(/g) ?? []).length, 3, 'el mensaje suelto o un lote no escucha la nota de voz citada');
  assert.match(doer, /if \(citado && 'texto' in citado && citado\.texto\) texto = conElAudioCitado\(texto, citado\.texto, citado\.segundos\);\n\s*else if \(citado && !\('texto' in citado\)\) \{\n\s*return \{ engaged: true, reply: await avisarAudioSinEscuchar\(/);
  assert.equal((doer.match(/else if \(citado && !\('texto' in citado\)\) \{ avisoDelAudio \?\?= await avisarElAudioDelLote\(/g) ?? []).length, 2, 'un lote calla la nota de voz citada que no se escuchó');
  assert.match(doer, /notaDeVozDelGrupo: true \}\)\)\.trim\(\), segundos: c\.segundos \};/, 'la citada no va por la vía de la nota de voz del grupo');
  assert.match(NUCLEO_GRUPO, /Escuchas notas de voz: la del mensaje y la que te citan llegan transcritas\. Nunca digas que no puedes escuchar audios/);
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   C1 sin leer la cita del nivel de arriba (Evolution v2)                               → falla el 1 y el 2
//   C2 bajarla por el id del mensaje nuevo                                               → falla el 1
//   C3 sin `notaDeVozDelGrupo` (Gemini en la cadena)                                     → falla el 1 y el 3
//   C4 el mensaje suelto sin escucharla                                                  → falla el 3
//   C5 un lote calla la citada que no se escuchó                                         → falla el 3
