// =============================================================================
// La respuesta al EQUIPO no es para MaKo, y MaKo no calla de más (28/10/2026, Leila, ws11; la verificación de 5b7a1917d)
// =============================================================================
// Martín: «Leila respondió al desarrollador y MaKo saltó a decirle cualquier cosa». El equipo le preguntó en el grupo, firmado,
// cuántas quincenas eran y en qué moneda. Leila contestó «Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000»,
// y MaKo le puso 👍 y le contestó una cuenta. El primer arreglo (5b7a1917d) calló a MaKo DE MÁS, y la verificación lo probó:
// cualquier «?» (el de un link) abría una ventana de 6 h, adentro TODO texto sin «mako» quedaba callado (otra persona, otro tema,
// un pedido), y la cita en la forma REAL de Evolution v2 (el `contextInfo` en el nivel de arriba) no se leía. Lo que fija:
//   1. la entrada REAL del grupo (tests/_respuesta-equipo-hijo.ts), en la forma v2: la respuesta de quien fue preguntado (citada
//      o no) va al equipo sin 👍 ni turno; otra persona, lo siguiente a la primera respuesta, un «?» de un link, un audio citado,
//      un «gracias» y lo que llega después de que MaKo habló van a MaKo; lo que además pide algo va a los dos; la re-entrega no
//      repite nada;
//   2. la regla pura (`respuestaAlEquipo`): pregunta de verdad, a quién, la ventana, cerrada con la primera respuesta;
//   3. las piezas: la cita y la pregunta donde vengan, a quién le habla, qué le pide a MaKo, la firma sólo al principio;
//   4. el cableado.
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { citaDelMensaje, conElNuevo, conLaAvisada, conLaRespondida, esPreguntaDelEquipo, paraDelEquipo, pideAlgoAMaKo, respuestaAlEquipo, textoCitado, VENTANA_RESPUESTA_AL_EQUIPO_MS, type DelEquipo } from '../lib/doer-equipo';
import { esFirmaDelEquipo, FIRMA_DESARROLLADOR, sinFirmaDelEquipo } from '../lib/aviso-arreglo-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_respuesta-equipo-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 280_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@EQUIPO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@EQUIPO@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const alEquipo = { engaged: false, skip: 'respuesta al equipo' };

test('1. por la entrada real (forma v2): al equipo sólo lo de quien fue preguntado; MaKo no calla de más; nada se repite', () => {
  const r = correr();
  // Al equipo: sin 👍, sin cola, con su aviso.
  for (const k of ['respuesta', 'citada']) {
    assert.deepEqual(r[k].r, alEquipo, `${k}: ${JSON.stringify(r[k])}`);
    assert.deepEqual([r[k].entro, r[k].reacciones, r[k].superAdmin], [false, 0, 1], `${k}: ${JSON.stringify(r[k])}`);
  }
  // A MaKo: entra a la cola (con su 👍, salvo el acuse) y sin aviso al equipo.
  for (const k of ['otraPersona', 'despues', 'link', 'audioCitado', 'makoHablo']) {
    assert.equal(r[k].entro, true, `${k}: MaKo calla de más (${JSON.stringify(r[k])})`);
    assert.equal(r[k].reacciones, 1, `${k}: sin 👍`);
    assert.equal(r[k].superAdmin, 0, `${k}: se tomó por respuesta al equipo`);
  }
  assert.deepEqual([r.gracias.superAdmin, r.gracias.reacciones], [0, 0], '«gracias» es un acuse: ni al equipo ni 👍');
  // Lo que además pide algo: al equipo Y a MaKo.
  assert.deepEqual([r.mezclada.entro, r.mezclada.superAdmin], [true, 1], `la respuesta con un pedido: ${JSON.stringify(r.mezclada)}`);
  // La re-entrega: ni otro aviso ni a MaKo.
  assert.deepEqual(r.reentrega.r, { engaged: false, skip: 'respuesta al equipo (re-entrega)' });
  assert.deepEqual([r.reentrega.entro, r.reentrega.superAdmin], [false, 0]);
  // El anillo: las preguntas contestadas, cerradas; a quién le hablaba cada una.
  assert.deepEqual(r.anillo.map((d: { id: string; respondida: boolean }) => [d.id, d.respondida]), [['EQ-1', true], ['EQ-2', true], ['EQ-3', false], ['EQ-4', false]]);
  assert.deepEqual(r.anillo[0].para, { nombre: 'leila' });
  assert.equal(r.anillo[2].para, null);
});

const AHORA = new Date('2026-10-28T20:00:00Z');
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();
const PREGUNTA: DelEquipo = { at: hace(1), texto: `${FIRMA_DESARROLLADOR}\nLeila, ¿cuántas quincenas eran y en qué moneda?`, id: 'EQ-1', para: { nombre: 'leila' } };
const LEILA = { jid: '5215500000000@s.whatsapp.net', nombre: 'Leila Gómez' };
const base = { citado: null, autor: LEILA, anillo: [PREGUNTA], ultimaDeMaKo: hace(3), ahora: AHORA, nombraAMaKo: false, esTexto: true };

test('2. la regla: quién fue preguntado, una pregunta de verdad, la ventana y su cierre', () => {
  assert.deepEqual(respuestaAlEquipo(base), { delEquipo: PREGUNTA, ventana: true });
  assert.equal(respuestaAlEquipo({ ...base, autor: { jid: '5215500000001@s.whatsapp.net', nombre: 'Sofi' } }), null, 'otra persona quedó callada');
  assert.ok(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, para: { jids: ['5215500000000@lid'] } }], autor: { jid: '5215500000000@s.whatsapp.net', nombre: null } }), 'por el número, aunque cambie el dominio');
  assert.equal(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, respondida: true }] }), null, 'la ventana no se cerró con la primera respuesta');
  assert.deepEqual(respuestaAlEquipo({ ...base, citado: { id: 'EQ-1', texto: null }, autor: { jid: null, nombre: 'Sofi' } }), { delEquipo: PREGUNTA, ventana: false }, 'citar es contestar, de quien sea');
  assert.equal(respuestaAlEquipo({ ...base, citado: { id: 'M-9', texto: 'Hoy entraron 4 leads.' } }), null, 'una cita a MaKo se tomó por respuesta al equipo');
  assert.equal(respuestaAlEquipo({ ...base, ultimaDeMaKo: hace(0.5) }), null, 'MaKo habló después de la pregunta');
  assert.equal(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, at: hace(7) }], ultimaDeMaKo: hace(10) }), null, 'fuera de la ventana');
  assert.ok(VENTANA_RESPUESTA_AL_EQUIPO_MS === 6 * 3_600_000);
  assert.equal(respuestaAlEquipo({ ...base, nombraAMaKo: true }), null, 'nombrar a MaKo no ganó');
  assert.equal(respuestaAlEquipo({ ...base, esTexto: false }), null, 'un audio sin citar se tomó por respuesta al equipo');
  assert.equal(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, texto: `${FIRMA_DESARROLLADOR}\nConecta Meta acá: https://hola-mako.com/integraciones?abrir=zernio` }] }), null, 'el «?» de un link abrió la ventana');
  assert.equal(respuestaAlEquipo({ ...base, anillo: [{ ...PREGUNTA, ticket: 18, texto: 'Listo: tu ticket #18 («¿Se pueden responder comentarios como ManyChat?») está resuelto.' }] }), null, 'el título de un ticket resuelto abrió la ventana');
});

test('3. las piezas: la cita en la forma v2, qué es pregunta, a quién le habla, qué le pide a MaKo, la firma, el registro', () => {
  const arriba = citaDelMensaje({ message: { conversation: 'Perfecto' }, contextInfo: { stanzaId: 'EQ-1', participant: 'x', quotedMessage: { conversation: '¿cuántas?' } } });
  assert.deepEqual(arriba, { id: 'EQ-1', texto: '¿cuántas?', participante: 'x' }, 'la cita del nivel de arriba (Evolution v2, la forma real) no se lee');
  assert.equal(citaDelMensaje({ message: { conversation: 'x' }, contextInfo: { stanzaId: 'AUD-1', quotedMessage: { audioMessage: { seconds: 94 } } } })?.id, 'AUD-1', 'citar un audio es citar');
  assert.equal(citaDelMensaje({ message: { audioMessage: { contextInfo: { stanzaId: 'EQ-2', quotedMessage: { conversation: '¿?' } } } } })?.id, 'EQ-2', 'una nota de voz que cita');
  assert.equal(textoCitado({ extendedTextMessage: { text: 'x', contextInfo: { quotedMessage: { conversation: 'la pregunta' } } } }), 'la pregunta');
  assert.equal(citaDelMensaje({ message: { conversation: 'x' } }), null);
  assert.equal(esPreguntaDelEquipo({ texto: 'Conecta: https://hola-mako.com/integraciones?abrir=zernio&ws=15' }), false);
  assert.equal(esPreguntaDelEquipo({ texto: 'Ya está. ¿Dudas? Responde aquí.' }), true);
  assert.equal(esPreguntaDelEquipo({ texto: 'Sobre tu ticket #4 («x»), el equipo te pregunta: ¿cuál?', ticket: 4 }), true);
  assert.equal(esPreguntaDelEquipo({ texto: 'Cerramos tu ticket #4 («¿se puede?»).', ticket: 4 }), false);
  assert.deepEqual(paraDelEquipo(`${FIRMA_DESARROLLADOR}\nLeila, ¿cuántas?`, []), { nombre: 'leila' });
  assert.equal(paraDelEquipo(`${FIRMA_DESARROLLADOR}\nHola, ¿cómo va?`, []), undefined, 'un saludo se tomó por un nombre');
  assert.deepEqual(paraDelEquipo('¿cuántas?', ['5215500000000@s.whatsapp.net']), { jids: ['5215500000000@s.whatsapp.net'] });
  for (const t of ['Cárgame el pago de hoy de Fabi Pedraza, 423 MXN', '¿cuántos leads entraron hoy?', 'Son 6 quincenas en mxn. Y pásame el resumen de cobros de la semana']) assert.equal(pideAlgoAMaKo(t), true, `«${t}»`);
  for (const t of ['Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000', 'Son 6 quincenas en mxn']) assert.equal(pideAlgoAMaKo(t), false, `«${t}»`);
  assert.equal(esFirmaDelEquipo(`${FIRMA_DESARROLLADOR}\nhola`), true);
  assert.equal(esFirmaDelEquipo(`Contesta a: «${FIRMA_DESARROLLADOR} ¿cuántas?»`), false, 'una cita de la firma en el medio');
  assert.equal(sinFirmaDelEquipo(`${FIRMA_DESARROLLADOR}\n¿Cuántas?`), '¿Cuántas?');
  const una = JSON.stringify(conElNuevo(null, PREGUNTA));
  assert.equal(conElNuevo(una, { ...PREGUNTA, at: hace(0) }).length, 1, 'el envío y su eco entraron dos veces');
  assert.equal(conLaRespondida(una, 'EQ-1')[0].respondida, true);
  assert.equal(conLaAvisada(JSON.stringify(['LE-1']), 'LE-1').yaEstaba, true);
});

test('4. el cableado: antes del 👍 y de la cola; la re-entrega; el cierre; lo que pide algo sigue; el anillo estricto', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const iEco = doer.indexOf("return { engaged: false, skip: 'eco de mi propia respuesta' };");
  const iRe = doer.indexOf("return { engaged: false, skip: 'respuesta al equipo (re-entrega)' };");
  const iEquipo = doer.indexOf('const alEquipo = await contestaAlEquipo(wsData, instance, jid, data, texto, !audio && !adjunto);');
  const iCola = doer.indexOf('const nuevo = await encolar(jid,');
  const iPulgar = doer.indexOf('reaccionarMensaje(jid, data.key, EMOJI_RECIBIDO)');
  assert.ok(iEco > 0 && iRe > iEco && iEquipo > iRe && iCola > iEquipo && iPulgar > iEquipo, 'la respuesta al equipo se mira después del 👍 o de la cola');
  assert.match(doer, /const cita = citaDelMensaje\(data as never\);/, 'la cita se lee sólo adentro del mensaje');
  assert.match(doer, /if \(esTexto && esAcusePuro\(texto\)\) return null;/);
  assert.match(doer, /if \(alEquipo\.ventana && alEquipo\.delEquipo\.id\) \{\n\s*const \{ cerrarLaPreguntaDelEquipo \} = await import\('@\/lib\/mako-grupo'\);/, 'la ventana no se cierra con la primera respuesta');
  assert.match(doer, /if \(!texto \|\| !pideAlgoAMaKo\(texto\)\) return \{ engaged: false, skip: 'respuesta al equipo' \};/, 'lo que además pide algo no llega a MaKo');
  assert.match(doer, /await anotarLoDelEquipo\(wsData, texto, msgId, undefined, paraDelEquipo\(texto, mencionesDelMensaje\(data\)\)\)/);
  assert.match(doer, /\.\.\.\(arriba \? mencionesDe\(\{ contextInfo: arriba \}\) : \[\]\)/, 'la @ del nivel de arriba no cuenta');
  assert.match(doer, /if \(a\.ticket && \(await sumarAlPedidoDelNegocio\(wsData, a\.ticket, `\$\{quien\}: \$\{texto\}`\)/);
  const grupo = sinComentarios(leer('lib/mako-grupo.ts'));
  assert.match(grupo, /export async function anotarLoDelEquipo\([^)]*\)[^{]*\{\n\s*const \{ CLAVE_EQUIPO_EN_EL_GRUPO, conElNuevo \} = await import\('\.\/doer-equipo'\);\n\s*await runWithWorkspace\(ws, async \(\) => \{\n\s*const antes = await getSettingEstricto\(CLAVE_EQUIPO_EN_EL_GRUPO\);/, 'una lectura que falla pisa el anillo');
  assert.match(leer('lib/tickets-cierre.ts'), /\{ de: 'equipo', ticket: Number\(f\.id\) \}/);
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   Q1 sin `contestaAlEquipo` en la entrada                                              → falla el 1 y el 4
//   Q2 el eco firmado no entra al anillo                                                 → falla el 1
//   Q3 sin la ventana                                                                    → falla el 2
//   Q4 sin mirar si MaKo habló después                                                   → falla el 1 y el 2
//   Q5 la firma en cualquier lugar del texto                                             → falla el 3
//   Q6 el anillo sin el dedup por id                                                     → falla el 3
//   Q7 el aviso a SuperAdmin con la firma                                                → (cubierto por Q5: su eco no pasa por equipo)
//   V1 cualquier «?» es pregunta (el de un link)                                         → falla el 1, el 2 y el 3
//   V2 la ventana para cualquiera (sin `esParaEl`)                                       → falla el 1 y el 2
//   V3 la ventana sin cerrarse con la primera respuesta                                  → falla el 1 y el 4
//   V4 lo que pide algo no sigue a MaKo                                                  → falla el 1 y el 4
//   V5 la cita sólo adentro del mensaje (sin el `contextInfo` de arriba)                 → falla el 1 y el 3
//   V6 sin frenar la re-entrega                                                          → falla el 1
//   V7 un acuse se toma por respuesta al equipo                                          → falla el 1 y el 4
//   V8 `anotarLoDelEquipo` lee sin estricto (una lectura que falla pisa el anillo)        → falla el 4
//   V9 la pregunta sin a quién le habla                                                  → falla el 1 y el 3
