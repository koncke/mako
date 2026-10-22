// =============================================================================
// La nota de voz en los chats de MaKo del Ops Center (22/10/2026, OC7)
// =============================================================================
// El micrófono del Ops Center del cliente sólo dictaba: /api/mako/chat no recibía audio. Ahora, en el Cerebro y en los demás
// chats de MaKo (también en la estrella de cada tab y en el teléfono), el micrófono GRABA como en Offer:
//   1. la nota se guarda como un adjunto (`<ws>/chat/<uuid>`, por su firma de MP3) y se pide POR SU MENSAJE, nunca por su path;
//   2. la ruta la escucha con la IA del NEGOCIO (D6b) ANTES de guardar nada: lo que se entendió es el mensaje del turno. Sin
//      voz, 422; ninguna IA pudo, 424 (un 4xx: con un 5xx la pantalla no sabría que no se guardó y la nota no volvería);
//   3. el turno guarda el MP3 con el mensaje (al final: las posiciones de los adjuntos no cambian) y lo devuelve para escucharlo;
//   4. la pantalla: la nota va a SU motor (Offer o la ruta del chat), y cómo termina decide si vuelve a la barra;
//   y lo que dejó la revisión de privacidad de Integración (22/10/2026): `pii: true` (nunca a la red gratis que entrena), el chat
//   es de quien la manda ANTES de escucharla, una clave dictada no deja el audio, y la de un chat que se sigue con `antes` se
//   escucha con la misma regla que deja seguirlo.
//
// Correr: node --import tsx --test tests/ops-center-voz-chat.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bloqueDeVoz, rutaDeAdjunto, rutaDeVozDelChat, sanearBloques, vozDeBloques, vozDeChatDeAntes } from '../lib/chat-mako-bloques';
import { esMp3 } from '../lib/mako-adjuntos';
import { leerRespuesta } from '../app/m/mako/chat-ui';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PATH = rutaDeAdjunto(3, '0f8fad5b-d9cb-469f-a165-70867728950e');

test('1. la nota se guarda como un adjunto, por su firma, y se pide por su mensaje', () => {
  assert.deepEqual(vozDeBloques(3, [bloqueDeVoz(PATH, 4.6)]), { k: 'voz', path: PATH, secs: 5 });
  assert.equal(vozDeBloques(4, [bloqueDeVoz(PATH, 4)]), null, 'la de otro workspace no se firma');
  assert.equal(vozDeBloques(3, [{ k: 'voz', path: `${PATH}/../otro`, secs: 3 }]), null, 'un path raro tampoco');
  assert.equal(bloqueDeVoz(PATH, 0).secs, 1);
  assert.equal(bloqueDeVoz(PATH, 99_999).secs, 3600);
  assert.deepEqual(sanearBloques(3, [bloqueDeVoz(PATH, 4)]), [], 'no es un archivo para El Archivero');
  assert.equal(rutaDeVozDelChat(812), '/api/mako/chat?voz=812');
  assert.ok(esMp3(new Uint8Array([0x49, 0x44, 0x33, 4])), 'con su etiqueta ID3');
  assert.ok(esMp3(new Uint8Array([0xff, 0xfb, 0x90])), 'el primer cuadro, como la arma lamejs');
  assert.ok(!esMp3(new Uint8Array([0x25, 0x50, 0x44, 0x46])), 'un PDF no');
  assert.ok(!esMp3(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), 'el webm de Chrome tampoco');
  // El GET la firma sólo si la conversación es de quien pide (como un adjunto).
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /export async function urlDeVozDelChat\([\s\S]{0,600}?const quien = deOtroChat \? await deOtroChat\(m\.session_id\) : persona;\n\s*if \(!quien \|\| !\(await sesionDe\(quien, m\.session_id\)\)\) return null;\n\s*const v = vozDeBloques\(persona\.ws, m\.bloques\);\n\s*return v \? urlFirmadaDeAdjunto\(v\.path\) : null;/);
  // La de un chat que se sigue con `antes`: con la MISMA regla que deja seguirlo (personaDelChat), y su URL lo dice.
  assert.match(sinComentarios(leer('app/api/mako/chat/route.ts')), /if \(sp\.has\('voz'\)\) \{\n\s*const url = await urlDeVozDelChat\(persona, sp\.get\('voz'\), sp\.get\('antes'\) \? \(sesion\) => personaDelChat\(persona, sesion, '1'\) : undefined\);/);
  assert.equal(vozDeChatDeAntes('/api/mako/chat?voz=812'), '/api/mako/chat?voz=812&antes=1');
  assert.equal(vozDeChatDeAntes('/api/mako/chat?voz=812&antes=1'), '/api/mako/chat?voz=812&antes=1', 'una sola vez');
  assert.equal(vozDeChatDeAntes('/api/offer/audio?sesion=3&m=a'), '/api/offer/audio?sesion=3&m=a', 'la de Offer, igual');
  assert.match(sinComentarios(leer('app/second-brain/useChatCliente.ts')), /const deOtroChat = !!elegido && 'antes' in elegido;\n\s*const conWsDeAudio = useCallback\(\(url: string\) => conWs\(deOtroChat \? vozDeChatDeAntes\(url\) : url, ws\), \[ws, deOtroChat\]\);/);
});

test('2. la ruta la escucha con la IA del negocio ANTES de guardar nada; sin voz 422, sin IA 424', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /if \(notaDeVoz && archivos\.length\) return json\(\{ ok: false, error: 'La nota de voz va sola: manda los archivos en otro mensaje\.' \}, 400\);/);
  assert.match(ruta, /if \(bytesDeVoz && !esMp3\(bytesDeVoz\)\) return json\(\{ ok: false, error: '[^']+' \}, 415\);/);
  assert.match(ruta, /const oido = await escucharNotaDelChat\(quien, sessionId, bytesDeVoz\);\n\s*if \(!oido\.ok\) return json\(\{ ok: false, error: oido\.error \}, oido\.status\);\n\s*mensaje = \[escrito\.trim\(\), oido\.texto\]\.filter\(Boolean\)\.join\('\\n\\n'\);/);
  assert.ok(ruta.indexOf('escucharNotaDelChat(quien') < ruta.indexOf('await turnoApp(quien'), 'se escucha antes del turno');
  assert.match(ruta, /turnoApp\(quien, sessionId, \{ mensaje, adjuntos: v\.adjuntos, voz, /);
  // Adentro de la decisión del negocio (D6b): «sólo su IA» se prende ANTES de escuchar.
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  const escuchar = turno.slice(turno.indexOf('export async function escucharNotaDelChat('), turno.indexOf("return texto ? { ok: true, texto }"));
  assert.ok(escuchar.indexOf('entrarSoloSuIA(negocio.suIA);') > 0 && escuchar.indexOf('entrarSoloSuIA(negocio.suIA);') < escuchar.indexOf('transcribirAudio('), 'D6b antes de escuchar');
  // Nunca a la red gratis de la agencia (el Gemini gratis entrena): `pii: true`, como las notas de WhatsApp.
  assert.match(escuchar, /\{ language: 'es', feature: FEATURE, motivo: 'MaKo: escuchar una nota de voz del chat', pii: true \}\)\)\.trim\(\);/);
  // El chat es de quien la manda ANTES de escucharla (si no, una nota a un chat ajeno gastaba la IA).
  assert.match(escuchar, /if \(!\(await sesionDe\(persona, sessionId\)\)\) return \{ ok: false, error: 'No encuentro ese chat\.', status: 404 \};/);
  assert.ok(escuchar.indexOf('sesionDe(persona, sessionId)') < escuchar.indexOf('transcribirAudio('), 'el dueño, antes');
  assert.match(escuchar, /status: 424 \};/);
  assert.match(turno, /return texto \? \{ ok: true, texto \} : \{ ok: false, error: NOTA_SIN_VOZ, status: 422 \};/);
  // Un 4xx dice su status (la pantalla decide con él), y un 5xx sigue siendo «no sé si llegó».
  const sinIA = leerRespuesta(424, JSON.stringify({ ok: false, error: 'Tu OpenAI no tiene crédito.' }));
  assert.deepEqual(sinIA, { ok: false, error: 'Tu OpenAI no tiene crédito.', reintentable: true, status: 424 });
  assert.equal(!leerRespuesta(422, '{"ok":false,"error":"x"}').ok && (leerRespuesta(422, '{"ok":false,"error":"x"}') as { status?: number }).status, 422);
  const cayo = leerRespuesta(502, '{"ok":false,"error":"x"}');
  assert.deepEqual(!cayo.ok && [cayo.reintentable, 'status' in cayo], [false, false]);
});

test('3. el turno guarda el MP3 con el mensaje (al final) y lo devuelve para escucharlo', () => {
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Con una clave DICTADA (tapada en el texto), el audio que la dice no se guarda.
  assert.match(turno, /const voz = entrada\.voz && entrada\.guardarAdjuntos && !tapado\.tapadas \? await subirNotaDeVozDelChat\(ws, entrada\.voz\) : null;\n\s*const aGuardar = voz \? \[\.\.\.bloques, voz\] : bloques;/);
  assert.match(turno, /msg = await appendMessage\(s\.id, 'user', conDesde\(textoMemoria, desde\), aGuardar\);/);
  assert.match(turno, /await borrarAdjuntos\(aGuardar\.map\(\(b\) => b\.path\)\);/, 'si el mensaje no quedó, su nota tampoco');
  assert.match(turno, /const conArchivos = msg\.conBloques && msg\.id != null \? adjuntosVisibles\(msg\.id, bloques\) : \[\];/, 'los adjuntos, sin la nota');
  assert.match(turno, /const conVoz = voz && msg\.conBloques && msg\.id != null \? \{ audio: \{ url: rutaDeVozDelChat\(msg\.id\), secs: voz\.secs \} \} : \{\};/);
  assert.match(turno, /\.\.\.\(voz && !audio \? \{ audio: \{ url: rutaDeVozDelChat\(m\.id\), secs: voz\.secs \} \} : \{\}\),/, 'y vuelve al recargar');
});

test('4. la pantalla: la nota va a SU motor, y cómo termina decide si vuelve a la barra', () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /if \(voz\) \{ fd\.append\('voz', voz\.mp3, 'nota-de-voz\.mp3'\); fd\.append\('vozSecs', String\(voz\.secs\)\); \}/);
  assert.match(motor, /const fin = idOffer != null \? await mandarAOffer\(idU, '', \[\], a\) : await mandarNotaAlChat\(idU, a\);/);
  assert.match(motor, /if \(!l\.reintentable\) \{ marcar\(idU, \{ estado: 'incierto', error: l\.error \}\); return 'quedo'; \}\n\s*sacar\(l\.error\);\n\s*return l\.status != null && NOTA_DEFINITIVA\.has\(l\.status\) \? 'tirar' : 'volver';/);
  assert.match(motor, /const NOTA_DEFINITIVA = new Set\(\[413, 415, 422\]\);/);
  assert.match(motor, /if \(fin === 'volver'\) setNotaEnEspera\(a\); else if \(fin !== 'quedo'\) URL\.revokeObjectURL\(a\.url\);/);
  // En todos los chats que tienen caja, no sólo en Offer.
  assert.match(motor, /const vozCaja = \{\n\s*onAudio:/);
  assert.doesNotMatch(motor, /const vozCaja = idOffer/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 4/0):
//   · la nota de otro workspace se firma              → 3/1 (1)
//   · el GET firma sin mirar de quién es               → 3/1 (1)
//   · se guarda sin escucharla antes                   → 3/1 (2)
//   · «ninguna IA pudo» con un 502                     → 3/1 (2)
//   · un 4xx sin su status                             → 3/1 (2)
//   · la nota antes de los adjuntos (corre los `<id>:<n>`) → 3/1 (3)
//   · un 422 vuelve a la barra                         → 3/1 (4)
//   · la nota sólo en Offer                            → 3/1 (4)
// Y lo de la revisión de privacidad (22/10/2026, base 4/0):
//   · sin `pii: true`                                  → 3/1 (2)
//   · escucha antes de mirar de quién es el chat       → 3/1 (2)
//   · guarda el audio de una clave dictada             → 3/1 (3)
//   · la nota de un chat de antes sin `&antes=1`       → 3/1 (1)
//   · el GET de un chat de antes sin su regla          → 3/1 (1)
