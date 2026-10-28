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
//   es de quien la manda ANTES de escucharla, y una clave dictada no deja el audio;
//   5. lo guardado de un chat que se SIGUE con `antes` (uno de antes o el de una tab: el CRM, la ficha de un lead) se abre: la
//      foto, el PDF y la nota daban 404, aun recién mandados. Con la regla que deja seguirlo, en el servidor (Cerebro, 22/10).
//
// Correr: node --import tsx --test tests/ops-center-voz-chat.test.ts
// PROBADO ROMPIÉNDOLO (base 5/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bloqueDeVoz, rutaDeAdjunto, rutaDeVozDelChat, sanearBloques, vozDeBloques } from '../lib/chat-mako-bloques';
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
  // El GET la firma sólo si la conversación es de quien pide (como un adjunto: `quienAbre`, test 5).
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /export async function urlDeVozDelChat\([\s\S]{0,500}?if \(!m \|\| !\(await quienAbre\(persona, m\.session_id, deOtroChat\)\)\) return null;\n\s*const v = vozDeBloques\(persona\.ws, m\.bloques\);\n\s*return v \? urlFirmadaDeAdjunto\(v\.path\) : null;/);
  assert.match(sinComentarios(leer('app/api/mako/chat/route.ts')), /if \(sp\.has\('voz'\)\) \{\n\s*const url = await urlDeVozDelChat\(persona, sp\.get\('voz'\), deOtroChat\);/);
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
  // ⚠️ La lista se llama `conElPedido` desde el 24/10/2026: una const local `aGuardar` TAPABA la función `aGuardar` importada de
  // lib/chat-bloques, y el `conElMensaje.map(aGuardar)` de la respuesta recibía un array y reventaba en ejecución. Este test
  // fijaba el nombre viejo y quedó rojo en main (27/10/2026, df08aa5f9); cuida lo mismo con el nombre nuevo. Probado
  // rompiéndolo, 1 fallo cada una: la nota al principio · sin borrar si el mensaje no quedó · sin borrar si quedó sin sus
  // bloques · una const local que vuelve a llamarse `aGuardar`.
  assert.match(turno, /const voz = entrada\.voz && entrada\.guardarAdjuntos && !tapado\.tapadas \? await subirNotaDeVozDelChat\(ws, entrada\.voz\) : null;\n\s*const conElPedido = voz \? \[\.\.\.bloques, voz\] : bloques;/, 'la nota no va AL FINAL, con el mensaje');
  assert.match(turno, /msg = await appendMessage\(s\.id, 'user', conDesde\(textoMemoria, desde\), conElPedido\);/, 'la nota no se guarda con el mensaje');
  assert.match(turno, /\} catch \(e\) \{\n\s*await borrarAdjuntos\(conElPedido\.map\(\(b\) => b\.path\)\);/, 'si el mensaje no quedó, su nota tampoco');
  assert.match(turno, /if \(conElPedido\.length && !msg\.conBloques\) await borrarAdjuntos\(conElPedido\.map\(\(b\) => b\.path\)\);/, 'si el mensaje quedó sin sus bloques, la nota queda huérfana');
  assert.doesNotMatch(turno, /\bconst aGuardar\b/, 'una const local `aGuardar` tapa la función importada y la respuesta revienta');
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

test('5. lo guardado de un chat que se sigue con `antes` se abre, con la regla que deja seguirlo (404 si no es suyo)', () => {
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Primero SU chat; si no, la regla de los chats que se siguen (la de `?sessionId=N&antes=1`), y la sesión otra vez con ESA
  // persona. Nunca una clave armada a mano.
  assert.match(turno, /async function quienAbre\(persona: PersonaChat, sesion: number, deOtroChat\?: ReglaDeOtroChat\): Promise<PersonaChat \| null> \{\n\s*if \(await sesionDe\(persona, sesion\)\) return persona;\n\s*const otro = deOtroChat \? await deOtroChat\(sesion\) : null;\n\s*return otro && \(await sesionDe\(otro, sesion\)\) \? otro : null;\n\}/);
  // El adjunto (la foto, el PDF) y la nota la usan los dos, ANTES de firmar.
  const adjunto = turno.slice(turno.indexOf('export async function urlDeAdjunto('), turno.indexOf('export async function urlDeVozDelChat('));
  assert.ok(adjunto.indexOf('quienAbre(persona, m.session_id, deOtroChat)') > 0 && adjunto.indexOf('quienAbre(') < adjunto.indexOf('urlFirmadaDeAdjunto('), 'el adjunto, con la regla');
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.match(ruta, /const deOtroChat = \(sesion: number\) => personaDelChat\(persona, sesion, '1'\);\n\s*if \(sp\.has\('adjunto'\)\) \{\n\s*const url = await urlDeAdjunto\(persona, sp\.get\('adjunto'\), deOtroChat\);/);
  // La regla es la de seguir el chat: la de antes, o un chat de una tab de ESTA persona.
  assert.match(ruta, /const chartKey = \(q \? await claveDeAntes\(q, sessionId\) : null\) \?\? await claveDeTab\(persona, sessionId\);/);
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
// Y lo de los chats que se siguen con `antes` (22/10/2026, base 5/0; reemplaza al `&antes=1` del navegador, que no protegía nada):
//   · el adjunto sin la regla (sólo el chat propio)    → 4/1 (5)
//   · la nota sin la regla                             → 4/1 (1)
//   · la regla sin volver a mirar la sesión            → 4/1 (5)
//   · el GET del adjunto no le pasa la regla           → 4/1 (5)
